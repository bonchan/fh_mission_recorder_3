import React, { createContext, useContext } from 'react';
import { createLogger } from '@/utils/logger';
import { Annotation, Drone, Waypoint, FlatDevice, SimulatorConnectParams } from '@/utils/interfaces';
import { getProjectTopologiesStorageKey } from '@/utils/utils';
import { toDockDrone, toAnnotation, toWaypoint, toFlatDevice } from '@/utils/mapper';
import { getCachedOrFetch } from '@/utils/storageCache';
import { useDjiSimulator } from '@/hooks/useDjiSimulator'


interface DataContextType {
  getTopologies: (orgId: string, projectId: string, tabId?: number) => Promise<any[]>;
  getAnnotations: (orgId: string, projectId: string, tabId?: number) => Promise<any[]>;
  getDroneTelemetry: (orgId: string, projectId: string, droneDeviceSn: string) => Promise<Waypoint>;
  getStorageUploadCredentials: (orgId: string, projectId: string, tabId?: number) => Promise<any>;
  duplicateNameStorageCheck: (orgId: string, projectId: string, missionName: string, tabId?: number) => Promise<any>;
  importCallbackStorage: (orgId: string, projectId: string, fileName: string, objectKey: string, tabId?: number) => Promise<any>;
  getFreshTopologies: (orgId: string, projectId: string, tabId?: number) => Promise<any[]>;

  simData: LiveDroneData | null;
  isSimConnected: boolean;
  connectSim: (params?: SimulatorConnectParams) => void;
  disconnectSim: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

const FIVE_MIN_MS = 5 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const log = createLogger('ExtensionDataProvider');

export function ExtensionDataProvider({ children }: { children: React.ReactNode }) {

  const { data: simData, isConnected: isSimConnected, connect: connectSim, disconnect: disconnectSim } = useDjiSimulator();

  const getTargetTabId = async (orgId: string, projectId: string, tabId?: number): Promise<number> => {
    if (tabId) return tabId;

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
  }

  const getDroneTelemetry = async (orgId: string, projectId: string, droneDeviceSn: string) => {
    const targetTabId = await getTargetTabId(orgId, projectId);
    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_TOPOLOGIES", orgId, projectId });
    let topologies = res.topologies.data.list

    if (isSimConnected) {
      const simRes = await fetch('http://localhost:8080/api/osd');
      const simPayload = await simRes.json();
      topologies = simPayload.data.list;
    }

    let waypoint = null
    for (const item of topologies) {
      waypoint = toWaypoint(item, droneDeviceSn)
      if (waypoint) break
    }
    return waypoint

  }

  // --- TOPOLOGIES ---
  const getTopologies = async (orgId: string, projectId: string, tabId?: number) => {
    const key = getProjectTopologiesStorageKey(orgId, projectId)

    const targetTabId = await getTargetTabId(orgId, projectId, tabId);

    return await getCachedOrFetch(key, TWELVE_HOURS_MS, async () => {
      // 1. Fetch fresh from the active tab
      const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_TOPOLOGIES", orgId, projectId });
      const topologies = res.topologies.data.list

      const deviceList: Drone[] = [];
      for (const item of topologies) {
        const drone = toDockDrone(item);
        // Only add to the list if the mapper returned a valid object
        if (drone && drone.deviceSn && drone.parent.deviceSn) {
          deviceList.push(drone);
        }
      }
      const deviceListSorted = [...deviceList].sort((a, b) => {
        const indexA = a.parent?.index ?? 999;
        const indexB = b.parent?.index ?? 999;
        return indexA - indexB;
      });

      return deviceListSorted
    });
  };

  const getFreshTopologies = async (orgId: string, projectId: string, tabId?: number) => {
    const key = getProjectTopologiesStorageKey(orgId, projectId)

    const targetTabId = await getTargetTabId(orgId, projectId, tabId);

    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_TOPOLOGIES", orgId, projectId });
    const topologies = res.topologies.data.list

    const deviceList: FlatDevice[] = [];
    for (const item of topologies) {
      const flatDevice = toFlatDevice(item);
      // Only add to the list if the mapper returned a valid object
      if (flatDevice) {
        deviceList.push(flatDevice);
      }
    }
    
    const deviceListSorted = [...deviceList].sort((a, b) => {
        const indexA = a.parentIndex ?? 999;
        const indexB = b.parentIndex ?? 999;
        return indexA - indexB;
      });
      console.log('deviceListSorted', deviceListSorted)
      return deviceListSorted
  };

  // --- ANNOTATIONS ---
  const getAnnotations = async (orgId: string, projectId: string, tabId?: number) => {
    const key = getProjectAnnotationsStorageKey(orgId, projectId)

    const targetTabId = await getTargetTabId(orgId, projectId, tabId);

    return await getCachedOrFetch(key, FIVE_MIN_MS, async () => {
      // 1. Fetch fresh from the active tab
      const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_ANNOTATIONS", orgId, projectId });
      const annotationList: Annotation[] = [];
      for (const elementList of res.annotations.data) {
        for (const element of elementList.elements) {
          const annotation = toAnnotation(element);
          if (annotation) {
            annotationList.push(annotation);
          }
        }
      }

      return annotationList;
    });
  };

  const getStorageUploadCredentials = async (orgId: string, projectId: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(orgId, projectId, tabId);
    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_STORAGE_UPLOAD_CREDENTIALS", orgId, projectId });
    return res;
  };

  const duplicateNameStorageCheck = async (orgId: string, projectId: string, missionName: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(orgId, projectId, tabId);
    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "DUPLICATE_NAME_STORAGE_CHECK", orgId, projectId, duplicateName: missionName });
    return res;
  };

  const importCallbackStorage = async (orgId: string, projectId: string, fileName: string, objectKey: string, tabId?: number) => {
    const targetTabId = await getTargetTabId(orgId, projectId, tabId);
    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "IMPORT_CALLBACK_STORAGE", orgId, projectId, fileName: fileName, objectKey: objectKey });
    return res;
  };

  return (
    <DataContext.Provider value={{
      getTopologies,
      getAnnotations,
      getDroneTelemetry,
      getStorageUploadCredentials,
      duplicateNameStorageCheck,
      importCallbackStorage,
      getFreshTopologies,

      simData,
      isSimConnected,
      connectSim,
      disconnectSim,
    }}>
      {children}
    </DataContext.Provider>
  );
}

// The new, clean hook for your UI components!
export const useExtensionData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useExtensionData must be used within ExtensionDataProvider");
  return context;
};