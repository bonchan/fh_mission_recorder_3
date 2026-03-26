import { DJI_PROJECT_BASE_REGEX, ICONS_ON, ICONS_OFF } from '@/utils/constants'
import { LiveDroneData } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';

const log = createLogger('background');

export default defineBackground(() => {
  const registry = new Map<number, number>(); // Key: FH_TabId, Value: Dashboard_TabId
  const activeDebugSessions = new Set<number>(); // Set of FH_TabIds

  const generalListener = async (tabId: number, url: string | undefined) => {
    if (!url) return;

    // Use .exec() instead of .match() so we can grab the capture groups
    const match = DJI_PROJECT_BASE_REGEX.exec(url);

    if (match) {
      // match[1] is the orgId, match[2] is the projectId based on your Regex
      const orgId = match[1];
      const projectId = match[2];

      await browser.action.setIcon({ tabId, path: ICONS_ON });

      // Append the extracted IDs to the URL!
      await browser.sidePanel.setOptions({
        tabId,
        path: `sidepanelview.html?orgId=${orgId}&projectId=${projectId}&tabId=${tabId}`,
        enabled: true
      });
    } else {
      await browser.action.setIcon({ tabId, path: ICONS_OFF });
      await browser.sidePanel.setOptions({
        tabId,
        enabled: false
      });
    }
  };

  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url) return;

    // We still have to open it, but the path is already set correctly by generalListener!
    const isMatch = !!DJI_PROJECT_BASE_REGEX.exec(tab.url);

    if (isMatch) {
      await browser.sidePanel.open({ tabId: tab.id });
    }
  });

  browser.tabs.onActivated.addListener(async (info) => {
    const tab = await browser.tabs.get(info.tabId);
    await generalListener(info.tabId, tab.url);
  });

  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'complete' || info.url) {
      generalListener(tabId, tab.url);
    }
  });










  browser.runtime.onMessage.addListener(async (message, sender) => {
    // 1. Handling Dashboard Creation
    if (message.type === 'OPEN_DASHBOARD') {
      const { missionId, orgId, projectId, sourceTabId, statusOverlay } = message;
      const url = browser.runtime.getURL(
        `/dashboard.html?missionId=${missionId}&orgId=${orgId}&projectId=${projectId}&sourceTabId=${sourceTabId}&statusOverlay=${statusOverlay}`
      );

      const dashboardTab = await browser.tabs.create({ url });
      registry.set(sourceTabId, dashboardTab.id!);
      return;
    }

    if (message.type === 'OPEN_ADMIN_DASHBOARD') {
      const { orgId, projectId, sourceTabId } = message;
      const url = browser.runtime.getURL(`/adminview.html?orgId=${orgId}&projectId=${projectId}&sourceTabId=${sourceTabId}`);

      const adminDashboardTab = await browser.tabs.create({ url });
      registry.set(sourceTabId, adminDashboardTab.id!);
      return;
    }

    // 2. Handling Debugger Toggles
    // Note: message.tabId here should be the sourceTabId (FlightHub) 
    // passed from your Dashboard's URL parameters
    if (message.action === 'ENABLE_WS_DEBUG') {
      const fhTabId = message.tabId;
      if (fhTabId) attachDebugger(fhTabId);
    }

    if (message.action === 'DISABLE_WS_DEBUG') {
      const fhTabId = message.tabId;
      if (fhTabId) detachDebugger(fhTabId);
    }
  });





  // --- DEBUGGER CORE LOGIC ---
  function attachDebugger(fhTabId: number) {
    if (activeDebugSessions.has(fhTabId)) return;

    chrome.debugger.attach({ tabId: fhTabId }, "1.3", () => {
      chrome.debugger.sendCommand({ tabId: fhTabId }, "Network.enable");
      activeDebugSessions.add(fhTabId);
      log.info(`Debugger attached to FlightHub Tab: ${fhTabId}`);
    });
  }

  function detachDebugger(fhTabId: number) {
    chrome.debugger.detach({ tabId: fhTabId }, () => {
      activeDebugSessions.delete(fhTabId);
      log.info(`Debugger detached from FlightHub Tab: ${fhTabId}`);
    });
  }

  // Monitor Network Frames
  chrome.debugger.onEvent.addListener((source, method, params: any) => {
    const fhTabId = source.tabId;
    if (!fhTabId || !activeDebugSessions.has(fhTabId)) return;

    if (method === "Network.webSocketFrameReceived") {
      const payload = params.response.payloadData;
      const dashboardTabId = registry.get(fhTabId);

      if (dashboardTabId) {
        processAndForwardData(fhTabId, dashboardTabId, payload);
      }
    }
  });

  function processAndForwardData(fhTabId: number, dashboardTabId: number, rawPayload: string) {
    try {
      // Decode and parse DJI Telemetry (simplified example)
      const jsonPayload = JSON.parse(rawPayload);

      if (jsonPayload.biz_code === 'device_osd') {
        // drone
        try {
          const host = jsonPayload.data?.host

          const camera = host.cameras[0]

          const payload = host[camera.payload_index]

          const liveDroneData: LiveDroneData = {
            timestamp: jsonPayload.timestamp,
            sn: jsonPayload.data.sn,
            latitude: host.latitude,
            longitude: host.longitude,
            altitude: host.elevation,
            heading: host.attitude_head,
            gimbalPitch: payload.gimbal_pitch,
            zoomFactor: payload.zoom_factor,
            cameraMode: camera.camera_mode,
            trigger: camera.photo_state,
          }

          browser.tabs.sendMessage(dashboardTabId, {
            action: 'LIVE_TELEMETRY_UPDATE',
            liveDroneData: liveDroneData,
            sourceTabId: fhTabId
          }).catch(() => {
            // If dashboard is closed but registry wasn't cleaned yet
            detachDebugger(fhTabId);
          });

        } catch (e) { }


      }

      // Check if it's the telemetry we want
      // if (data.type === 'telemetry') {
      // Send specifically to the associated Dashboard tab

      // }
    } catch (e) { /* Ignore non-JSON frames */ }
  }

  // --- CLEANUP ---
  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId) {
      activeDebugSessions.delete(source.tabId);
      const dashboardId = registry.get(source.tabId);
      if (dashboardId) {
        browser.tabs.sendMessage(dashboardId, { action: 'DEBUGGER_DETACHED' }).catch(() => { });
      }
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    // If FlightHub tab is closed
    if (registry.has(tabId)) {
      const dashboardId = registry.get(tabId);
      detachDebugger(tabId); // Stop debugging the dead tab
      browser.tabs.remove(dashboardId!).catch(() => { });
      registry.delete(tabId);
    }

    // If Dashboard tab is closed directly
    for (const [fhId, dashId] of registry.entries()) {
      if (dashId === tabId) {
        detachDebugger(fhId);
        registry.delete(fhId);
        break;
      }
    }
  });
});