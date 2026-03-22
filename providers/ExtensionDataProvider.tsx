// providers/ExtensionDataProvider.tsx
import React, { createContext, useContext } from 'react';
// import { Annotation, Drone } from '@/utils/interfaces';
import { getProjectTopologiesStorageKey } from '@/utils/utils';
import { toDockDrone, toAnnotation } from '@/utils/mapper';
import { getCachedOrFetch } from '@/utils/storageCache';

interface DataContextType {
  getTopologies: (orgId: string, projectId: string, tabId: number) => Promise<any[]>;  // TODO Replace any[] with Drone[]
  getAnnotations: (orgId: string, projectId: string, tabId: number) => Promise<any[]>; // TODO Replace any[] with Annotation[]
  // Add loadMissions and saveMissions here as you migrate them!
}

const DataContext = createContext<DataContextType | null>(null);

const FIVE_MIN_MS = 5 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function ExtensionDataProvider({ children }: { children: React.ReactNode }) {



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