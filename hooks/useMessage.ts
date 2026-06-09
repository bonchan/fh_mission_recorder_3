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
  const getCockpitData = async (tabId?: number) => {
    const targetTabId = await getTargetTabId(tabId);
    const cockpitData = await browser.tabs.sendMessage(targetTabId, { action: "GET_COCKPIT_DATA", orgId, projectId });
    return cockpitData
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
  };
}