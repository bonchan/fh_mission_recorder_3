// entrypoints/background/index.ts

import { LiveDroneData } from "@/utils/interfaces";

export default defineBackground(() => {
  const registry = new Map<number, number>(); // Key: FH_TabId, Value: Dashboard_TabId
  const activeDebugSessions = new Set<number>(); // Set of FH_TabIds

  browser.runtime.onMessage.addListener(async (message, sender) => {
    // 1. Handling Dashboard Creation
    if (message.type === 'OPEN_DASHBOARD') {
      const { missionId, orgId, projectId, sourceTabId } = message;
      const url = browser.runtime.getURL(
        `/dashboard.html?missionId=${missionId}&orgId=${orgId}&projectId=${projectId}&sourceTabId=${sourceTabId}`
      );

      const dashboardTab = await browser.tabs.create({ url });
      registry.set(sourceTabId, dashboardTab.id!);
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
      console.log(`Debugger attached to FlightHub Tab: ${fhTabId}`);
    });
  }

  function detachDebugger(fhTabId: number) {
    chrome.debugger.detach({ tabId: fhTabId }, () => {
      activeDebugSessions.delete(fhTabId);
      console.log(`Debugger detached from FlightHub Tab: ${fhTabId}`);
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

      // console.log('jsonPayload', jsonPayload)

      if (jsonPayload.biz_code === 'device_osd') {
        console.log('device_osd')
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

  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId) {
      activeDebugSessions.delete(source.tabId);
      const dashboardId = registry.get(source.tabId);
      if (dashboardId) {
        browser.tabs.sendMessage(dashboardId, { action: 'DEBUGGER_DETACHED' }).catch(() => { });
      }
    }
  });
});