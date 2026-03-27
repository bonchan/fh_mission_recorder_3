import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/utils/logger';
import { MissionMap, Mission } from '@/utils/interfaces';
import { getProjectMissionsStorageKey } from '@/utils/utils';

const log = createLogger('useLiveMissions');

export function useLiveMissions(orgId: string, projectId: string) {
  const [missions, setMissions] = useState<MissionMap>({});
  const [isLoadingMissions, setIsLoadingMissions] = useState(true);

  const storageKey = getProjectMissionsStorageKey(orgId, projectId);


  const saveMission = useCallback(async (mission: Mission) => {
    const dockSn = mission.device?.parent?.deviceSn;
    if (!orgId || !projectId || !dockSn) return;
    const currentData = await browser.storage.local.get(storageKey);
    const currentMap: MissionMap = (currentData[storageKey] || {}) as MissionMap;

    // Get current missions for this dock, or default to an empty array
    const dockMissions = currentMap[dockSn] || [];

    // Check if it already exists (Upsert logic)
    const existingIndex = dockMissions.findIndex((m: Mission) => m.id === mission.id);
    let updatedDockMissions;

    if (existingIndex >= 0) {
      // Replace existing
      updatedDockMissions = [...dockMissions];
      updatedDockMissions[existingIndex] = mission;
    } else {
      // Add new
      updatedDockMissions = [...dockMissions, mission];
    }

    const newMap = { ...currentMap, [dockSn]: updatedDockMissions };
    await browser.storage.local.set({ [storageKey]: newMap });
  }, [orgId, projectId, storageKey]);

  const updateMission = useCallback(async (mission: Partial<Mission>) => {
    const dockSn = mission.device?.parent?.deviceSn;
    const missionId = mission.id
    if (!orgId || !projectId || !dockSn || !missionId) return;
    const currentData = await browser.storage.local.get(storageKey);
    const currentMap: MissionMap = (currentData[storageKey] || {}) as MissionMap;

    const dockMissions = currentMap[dockSn] || [];

    // Map over the array and apply the partial updates to the matching mission
    const updatedDockMissions = dockMissions.map((m: Mission) =>
      m.id === missionId ? { ...m, ...mission } : m
    );

    const newMap = { ...currentMap, [dockSn]: updatedDockMissions };
    await browser.storage.local.set({ [storageKey]: newMap });
  }, [orgId, projectId, storageKey]);

  const deleteMission = useCallback(async (mission: Mission) => {
    const dockSn = mission.device?.parent?.deviceSn;
    const missionId = mission.id
    if (!orgId || !projectId || !dockSn || !missionId) return;
    const currentData = await browser.storage.local.get(storageKey);
    const currentMap: MissionMap = (currentData[storageKey] || {}) as MissionMap;

    const dockMissions = currentMap[dockSn] || [];

    // Filter out the mission with the matching ID
    const updatedDockMissions = dockMissions.filter((m: Mission) => m.id !== missionId);

    const newMap = { ...currentMap, [dockSn]: updatedDockMissions };
    await browser.storage.local.set({ [storageKey]: newMap });
  }, [orgId, projectId, storageKey]);


  const addWaypoints = useCallback(async (mission: Mission, waypoints: Waypoint | Waypoint[]) => {
    const dockSn = mission.device?.parent?.deviceSn;
    const missionId = mission.id;

    if (!orgId || !projectId || !dockSn || !missionId) return;

    const currentData = await browser.storage.local.get(storageKey);
    const currentMap = (currentData[storageKey] || {}) as MissionMap;
    const dockMissions = currentMap[dockSn] || [];

    // Normalize the input: force it to be an array even if they only passed one
    const waypointsToAdd = Array.isArray(waypoints) ? waypoints : [waypoints];

    // Map over missions, find the target, and push the new waypoint(s)
    const updatedMissions = dockMissions.map((m: Mission) => {
      if (m.id === missionId) {
        const currentWaypoints = m.waypoints || []; // Safety fallback
        // Spread both the existing waypoints AND our new array of waypoints
        return { ...m, waypoints: [...currentWaypoints, ...waypointsToAdd] };
      }
      return m;
    });

    const newMap = { ...currentMap, [dockSn]: updatedMissions };
    await browser.storage.local.set({ [storageKey]: newMap });
  }, [orgId, projectId, storageKey]);

  const updateWaypoint = useCallback(async (mission: Mission, waypointId: string, updates: Partial<Waypoint>) => {
    const dockSn = mission.device?.parent?.deviceSn;
    const missionId = mission.id
    if (!orgId || !projectId || !dockSn || !missionId) return;
    const currentData = await browser.storage.local.get(storageKey);
    const currentMap = (currentData[storageKey] || {}) as MissionMap;
    const dockMissions = currentMap[dockSn] || [];

    const updatedMissions = dockMissions.map((m: Mission) => {
      if (m.id === missionId) {
        // Map over the waypoints inside this specific mission
        const updatedWaypoints = (m.waypoints || []).map(wp =>
          wp.id === waypointId ? { ...wp, ...updates } : wp
        );
        return { ...m, waypoints: updatedWaypoints };
      }
      return m;
    });

    const newMap = { ...currentMap, [dockSn]: updatedMissions };
    await browser.storage.local.set({ [storageKey]: newMap });
  }, [orgId, projectId, storageKey]);

  const deleteWaypoint = useCallback(async (mission: Mission, waypointId: string) => {
    const dockSn = mission.device?.parent?.deviceSn;
    const missionId = mission.id
    if (!orgId || !projectId || !dockSn || !missionId) return;
    const currentData = await browser.storage.local.get(storageKey);
    const currentMap = (currentData[storageKey] || {}) as MissionMap;
    const dockMissions = currentMap[dockSn] || [];

    const updatedMissions = dockMissions.map((m: Mission) => {
      if (m.id === missionId) {
        // Filter out the waypoint that matches the ID
        const updatedWaypoints = (m.waypoints || []).filter(wp => wp.id !== waypointId);
        return { ...m, waypoints: updatedWaypoints };
      }
      return m;
    });

    const newMap = { ...currentMap, [dockSn]: updatedMissions };
    await browser.storage.local.set({ [storageKey]: newMap });
  }, [orgId, projectId, storageKey]);

  
  useEffect(() => {
    if (!orgId || !projectId) {
      setIsLoadingMissions(false);
      return;
    }

    const loadInitialData = async () => {
      setIsLoadingMissions(true);
      const data = await browser.storage.local.get(storageKey);
      if (data[storageKey]) {
        setMissions(data[storageKey] as MissionMap);
      }
      setIsLoadingMissions(false);
    };

    loadInitialData();

    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes[storageKey]) {
        log.debug(`[Sync] Missions updated across tabs!`);
        setMissions(changes[storageKey].newValue || {});
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [orgId, projectId, storageKey]);

  // Export all the new functions!
  return {
    missions,
    isLoadingMissions,
    saveMission,
    updateMission,
    deleteMission,
    addWaypoints,
    updateWaypoint,
    deleteWaypoint
  };
}