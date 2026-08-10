import { Annotation } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';

const log = createLogger('useMessage');

export function useMessage(orgId: string, projectId: string) {

  // --- INTERNAL HELPER ---
  const getTargetTabId = async (tabId?: number): Promise<number> => {
    if (tabId) return tabId;
    // TODO move this to an env file or  config
    const tabs = await browser.tabs.query({ url: "*://fh.dji.com/*" });

    const exactProjectTab = tabs.find(t => {
      if (!t.url || t.status !== "complete" || t.discarded) return false;

      const match = t.url.match(DJI_PROJECT_BASE_REGEX);
      if (!match) return false;

      const [_, tabOrgId, tabProjectId] = match;
      return tabOrgId === orgId && tabProjectId === projectId;
    });

    if (exactProjectTab && exactProjectTab.id) {
      return exactProjectTab.id;
    } else {
      throw new Error(`Could not find an open tab for this specific project. Please open it in FlightHub.`);
    }
  };

  const getCockpitTabId = async (deviceSn: string, tabId?: number): Promise<number> => {
    if (tabId) return tabId;

    const tabs = await browser.tabs.query({ url: "*://fh.dji.com/*" });

    const cockpitTabs = tabs.filter(t => {
      if (!t.url || t.status !== "complete" || t.discarded) return false;

      const match = t.url.match(DJI_COCKPIT_REGEX);
      if (!match) return false;

      const [_, tabOrgId, tabProjectId] = match;
      return tabOrgId === orgId && tabProjectId === projectId;
    });

    if (cockpitTabs.length > 1) {
      log.warn(`Found ${cockpitTabs.length} open cockpit tabs for this project - matching on droneSn to pick the right one`, cockpitTabs.map(t => t.url));
    }

    const cockpitTab = cockpitTabs.find(t => {
      const match = t.url!.match(DJI_COCKPIT_REGEX)!;
      const tabDroneSn = match[3];
      return tabDroneSn === deviceSn;
    });

    if (cockpitTab && cockpitTab.id) {
      return cockpitTab.id;
    } else {
      throw new Error(`Could not find an open cockpit tab for drone ${deviceSn} in this project. Open that drone's cockpit view in FlightHub first.`);
    }
  };

  // --- HELPERS ---
  const openPage = async (type: string, extraData: Record<string, any> = {}, tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    browser.runtime.sendMessage({
      type: type,
      orgId: orgId,
      projectId: projectId,
      sourceTabId: targetTabId,
      debugMode: false,
      ...extraData,
    });
  }

  const toggleDebugger = async (nextState: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    await browser.runtime.sendMessage({ action: nextState ? 'ENABLE_WS_DEBUG' : 'DISABLE_WS_DEBUG', tabId: targetTabId });
  }

  // --- TOPOLOGIES ---
  const getTopologies = async (tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_TOPOLOGIES", orgId, projectId });

    const rawList = res.topologies?.data?.list || [];

    return rawList.map((item: any) => ({
      ...item,
      deviceSn: item.host?.device_sn || item.index || `unknown_${Math.random()}`,
      projectId: projectId
    }));
  };

  // --- ANNOTATIONS ---
  const getAnnotations = async (tabId?: number): Promise<Annotation[]> => {
    const targetTabId = await getTargetTabId(tabId);

    const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_ANNOTATIONS", orgId, projectId });
    const annotationList: any[] = []; // Type this as Annotation[]

    for (const elementList of res.annotations.data) {
      for (const element of elementList.elements) {
        const annotation = toAnnotation(element, projectId);
        if (annotation) annotationList.push(annotation);
      }
    }

    return annotationList;
  };



  // --- FLIGHT ROUTES ---
  const getFlightRoutes = async (searchQuery: string, page: number, size: number, tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    return await browser.tabs.sendMessage(targetTabId, { action: "GET_FLIGHT_ROUTES", orgId, projectId, searchQuery, page, size });
  };

  const getAllRoutesForPrefix = async (searchQuery: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    return await browser.tabs.sendMessage(targetTabId, { action: "GET_ALL_ROUTES_FOR_PREFIX", orgId, projectId, searchQuery });
  };

  const getFlightRouteDetails = async (waylineId: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    return await browser.tabs.sendMessage(targetTabId, { action: "GET_FLIGHT_ROUTE_DETAILS", orgId, projectId, waylineId });
  };

  const getBatchedRouteDetails = async (routeIds: string[], tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    return await browser.tabs.sendMessage(targetTabId, {
      action: "GET_BATCHED_ROUTE_DETAILS",
      orgId,
      projectId,
      routeIds
    });
  };

  const getStorageUploadCredentials = async (tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_STORAGE_UPLOAD_CREDENTIALS", orgId, projectId });
    return res;
  };

  const duplicateNameStorageCheck = async (missionName: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "DUPLICATE_NAME_STORAGE_CHECK", orgId, projectId, duplicateName: missionName });
    return res;
  };

  const importCallbackStorage = async (fileName: string, objectKey: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "IMPORT_CALLBACK_STORAGE", orgId, projectId, fileName: fileName, objectKey: objectKey });
    return res;
  };

  // --- COCKPIT ---
  // getCockpitData reads pitch/zoom/rng straight off the cockpit page's DOM
  // (handleGetCockpitData in global.content.ts), so it's only meaningful when the
  // target tab is actually on the cockpit route - same reasoning as getCockpitTabId
  // above, even though global.content.ts's listener technically exists on every FH tab.
  const getCockpitData = async (deviceSn: string, tabId?: number) => {
    const targetTabId = await getCockpitTabId(deviceSn, tabId);
    const cockpitData = await browser.tabs.sendMessage(targetTabId, { action: "GET_COCKPIT_DATA", orgId, projectId });
    return cockpitData
  };

  const captureStill = async (deviceSn: string, tabId?: number) => {
    const targetTabId = await getCockpitTabId(deviceSn, tabId);
    log.info('captureStill: sending CAPTURE_STILL', { targetTabId, orgId, projectId });
    const res = await browser.tabs.sendMessage(targetTabId, { action: "CAPTURE_STILL", deviceSn, orgId, projectId });
    log.info('captureStill: response', res);
    return res?.still ?? null;
  };


  return {
    openPage,
    toggleDebugger,

    getTopologies,

    getAnnotations,

    getFlightRoutes,
    getAllRoutesForPrefix,
    getFlightRouteDetails,
    getBatchedRouteDetails,

    getStorageUploadCredentials,
    duplicateNameStorageCheck,
    importCallbackStorage,
    getCockpitData,
    
    captureStill,
  };
}