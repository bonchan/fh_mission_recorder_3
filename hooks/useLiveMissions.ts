import { useState, useEffect, useCallback } from 'react';
import { MissionMap, Mission } from '@/utils/interfaces';
import { getProjectMissionsStorageKey } from '@/utils/utils';

export function useLiveMissions(orgId: string, projectId: string) {
  const [missions, setMissions] = useState<MissionMap>({});
  const [isLoadingMissions, setIsLoadingMissions] = useState(true);

  const storageKey = getProjectMissionsStorageKey(orgId, projectId);

  // --- THE WRITE FUNCTION ---
  // We use useCallback so this function doesn't recreate itself on every render
  const saveMissions = useCallback(async (dockSn: string, updatedMissions: Mission[]) => {
    if (!orgId || !projectId) return;

    // 1. Get the absolute latest data from storage directly
    // (This prevents race conditions if two tabs try to save at the exact same millisecond)
    const currentData = await browser.storage.local.get(storageKey);
    const currentMap = currentData[storageKey] || {};

    // 2. Merge the specific dock's new missions into the map
    const newMap = { ...currentMap, [dockSn]: updatedMissions };

    // 3. Save it back to the browser storage
    await browser.storage.local.set({ [storageKey]: newMap });

    // Note: We DO NOT need to call setMissions(newMap) here! 
    // Why? Because browser.storage.local.set will instantly trigger the 
    // onChanged listener below, which updates the React state automatically.
  }, [orgId, projectId]);


  // --- THE READ & SYNC LISTENER ---
  useEffect(() => {
    if (!orgId || !projectId) {
      setIsLoadingMissions(false);
      return;
    }

    // Initial load
    const loadInitialData = async () => {
      setIsLoadingMissions(true);
      const data = await browser.storage.local.get(storageKey);
      if (data[storageKey]) {
        setMissions(data[storageKey] as MissionMap);
      }
      setIsLoadingMissions(false);
    };

    loadInitialData();

    // Live sync
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes[storageKey]) {
        // console.log(`[Sync] Missions updated across tabs!`);
        setMissions(changes[storageKey].newValue || {});
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [orgId, projectId]);

  // Return both the data and the mutator!
  return { missions, isLoadingMissions, saveMissions };
}