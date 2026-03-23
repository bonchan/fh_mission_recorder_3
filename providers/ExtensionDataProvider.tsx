// providers/ExtensionDataProvider.tsx
import React, { createContext, useContext } from 'react';
import { Annotation, Drone, Waypoint } from '@/utils/interfaces';
import { getProjectTopologiesStorageKey } from '@/utils/utils';
import { toDockDrone, toAnnotation, toWaypoint } from '@/utils/mapper';
import { getCachedOrFetch } from '@/utils/storageCache';

interface DataContextType {
  getTopologies: (orgId: string, projectId: string, tabId: number) => Promise<any[]>;
  getAnnotations: (orgId: string, projectId: string, tabId: number) => Promise<any[]>;
  getDroneTelemetry: (orgId: string, projectId: string, droneDeviceSn: string) => Promise<Waypoint>;
}

const DataContext = createContext<DataContextType | null>(null);

const FIVE_MIN_MS = 5 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function ExtensionDataProvider({ children }: { children: React.ReactNode }) {

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
    const key = getProjectTopologiesStorageKey(orgId, projectId)

    const targetTabId = await getTargetTabId(orgId, projectId);

    // 1. Fetch fresh from the active tab
    const res = await browser.tabs.sendMessage(targetTabId, { action: "GET_TOPOLOGIES", orgId, projectId });
    const topologies = res.topologies.data.list
    let waypoint = null
    for (const item of topologies) {
      waypoint = toWaypoint(item, droneDeviceSn)
      if (waypoint) break
    }
    return waypoint

  }

  // --- TOPOLOGIES ---
  const getTopologies = async (orgId: string, projectId: string, tabId: number) => {
    const key = getProjectTopologiesStorageKey(orgId, projectId)

    return await getCachedOrFetch(key, TWELVE_HOURS_MS, async () => {
      // 1. Fetch fresh from the active tab
      const res = await browser.tabs.sendMessage(tabId, { action: "GET_TOPOLOGIES", orgId, projectId });
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

  // --- ANNOTATIONS ---
  const getAnnotations = async (orgId: string, projectId: string, tabId: number) => {
    const key = getProjectAnnotationsStorageKey(orgId, projectId)

    return await getCachedOrFetch(key, FIVE_MIN_MS, async () => {
      // 1. Fetch fresh from the active tab
      const res = await browser.tabs.sendMessage(tabId, { action: "GET_ANNOTATIONS", orgId, projectId });
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

  return (
    <DataContext.Provider value={{
      getTopologies,
      getAnnotations,
      getDroneTelemetry,
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