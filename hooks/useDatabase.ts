import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/utils/db';
import { FlightRouteHeader, FlightRouteData, Mission, Waypoint } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';

const log = createLogger('useDatabase');

export function useDatabase(projectId: string) {

  // ==========================================
  // 1. REACTIVE QUERIES
  // ==========================================

  const projectRoutes = useLiveQuery(
    () => db.flight_routes.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  const pendingRoutes = useLiveQuery(
    () => db.flight_routes
      .where('[projectId+syncStatus]')
      .equals([projectId, 'PENDING'])
      .toArray(),
    [projectId]
  ) || [];

  const projectAnnotations = useLiveQuery(
    () => db.compromised_annotations
      .where('projectId')
      .equals(projectId)
      .toArray(),
    [projectId]
  ) || [];

  const executionRoutesWithData = useLiveQuery(async () => {
    const headers = await db.flight_routes
      .where('projectId').equals(projectId)
      .filter(r => r.isExecutionRoute)
      .toArray();

    const fullRoutes = await Promise.all(
      headers.map(async (header) => {
        const data = await db.flight_route_data.get(header.id);
        return {
          ...header,
          waypoints: data?.parsedWaypoints || []
        };
      })
    );

    return fullRoutes;
  }, [projectId]);

  // ==========================================
  // LIVE MISSIONS (Nested Array / Document Approach)
  // ==========================================

  // QUERIES
  const projectMissions = useLiveQuery(
    () => db.missions.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  // MISSIONS
  const createMission = async (mission: Mission) => {
    // Just save the whole thing exactly as it is!
    await db.missions.put(mission);
  };

  const updateMission = async (missionId: string, updates: Partial<Mission>) => {
    await db.missions.update(missionId, updates);
  };

  const deleteMission = async (missionId: string) => {
    await db.missions.delete(missionId);
  };

  // WAYPOINTS
  const createWaypoints = async (missionId: string, waypoints: Waypoint | Waypoint[], insertIndex?: number) => {
    const waypointsToAdd = Array.isArray(waypoints) ? waypoints : [waypoints];

    // 1. Grab the mission and its list
    const mission = await db.missions.get(missionId);
    if (!mission) return;

    const currentList = mission.waypoints || [];
    let newList;

    // 2. Splice it (the "Sandwich") or Append it
    if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= currentList.length) {
      newList = [
        ...currentList.slice(0, insertIndex),
        ...waypointsToAdd,
        ...currentList.slice(insertIndex)
      ];
    } else {
      newList = [...currentList, ...waypointsToAdd];
    }

    // 3. Commit the list again
    await db.missions.update(missionId, { waypoints: newList });
  };

  const updateWaypoint = async (missionId: string, waypointId: string, updates: Partial<Waypoint>) => {
    const mission = await db.missions.get(missionId);
    if (!mission || !mission.waypoints) return;

    // Grab the list, map it, commit it again
    const newList = mission.waypoints.map(wp =>
      wp.id === waypointId ? { ...wp, ...updates } : wp
    );

    await db.missions.update(missionId, { waypoints: newList });
  };

  const deleteWaypoint = async (missionId: string, waypointId: string) => {
    const mission = await db.missions.get(missionId);
    if (!mission || !mission.waypoints) return;

    // Grab the list, filter it, commit it again
    const newList = mission.waypoints.filter(wp => wp.id !== waypointId);

    await db.missions.update(missionId, { waypoints: newList });
  };


  // ==========================================
  // 3. FLIGHT ROUTES & ANNOTATIONS (Unchanged)
  // ==========================================

  const getRoutesCollidingWithAnnotation = async (annoLat: number, annoLng: number, buffer = 0.001) => {
    const routes = await db.flight_routes.where('projectId').equals(projectId).toArray();
    return routes.filter(route => {
      if (!route.minLat || !route.maxLat || !route.minLng || !route.maxLng) return false;
      return (
        annoLat >= (route.minLat - buffer) &&
        annoLat <= (route.maxLat + buffer) &&
        annoLng >= (route.minLng - buffer) &&
        annoLng <= (route.maxLng + buffer)
      );
    });
  };

  const getMissionData = async (routeId: string) => {
    return await db.flight_route_data.get(routeId);
  };

  const saveFlightRoute = async (header: FlightRouteHeader, data: FlightRouteData) => {
    if (header.projectId !== projectId) {
      throw new Error("Attempted to save a route to the wrong project workspace.");
    }
    try {
      await db.transaction('rw', db.flight_routes, db.flight_route_data, async () => {
        await db.flight_routes.put(header);
        await db.flight_route_data.put(data);
      });
      log.info(`Saved route: ${header.name} to project: ${projectId}`);
    } catch (error) {
      log.error('Failed to save to database', error);
      throw error;
    }
  };

  const deleteFlightRoute = async (routeId: string) => {
    await db.transaction('rw', db.flight_routes, db.flight_route_data, async () => {
      await db.flight_routes.delete(routeId);
      await db.flight_route_data.delete(routeId);
    });
  };

  const addRouteHeader = async (apiRoute: any) => {
    const header: FlightRouteHeader = {
      id: apiRoute.id,
      projectId: projectId,
      name: apiRoute.name,
      updateTime: apiRoute.update_time,
      syncStatus: 'PENDING',
      isExecutionRoute: false,
      minLat: null, maxLat: null, minLng: null, maxLng: null,
    };
    try {
      await db.flight_routes.put(header);
      log.info(`Staged route header: ${header.name}`);
    } catch (error) {
      log.error('Failed to stage route header', error);
      throw error;
    }
  };

  const processAndSaveRoute = async (routeId: string, data: FlightRouteData, headerUpdates: Partial<FlightRouteHeader>) => {
    try {
      await db.transaction('rw', db.flight_routes, db.flight_route_data, async () => {
        await db.flight_routes.update(routeId, headerUpdates);
        await db.flight_route_data.put(data);
      });
      log.info(`Successfully processed and synced route: ${routeId}`);
    } catch (error) {
      log.error(`Failed to process and sync route ${routeId}`, error);
      throw error;
    }
  };

  const toggleExecutionRoute = async (routeId: string, isExecution: boolean) => {
    try {
      await db.flight_routes.update(routeId, { isExecutionRoute: isExecution });
    } catch (error) {
      log.error('Failed to update execution status', error);
    }
  };

  const saveCompromisedAnnotation = async (annotation: any) => {
    try {
      await db.compromised_annotations.put({ ...annotation, projectId: projectId });
      log.info(`Saved compromised annotation: ${annotation.name}`);
    } catch (error) {
      log.error('Failed to save compromised annotation', error);
    }
  };

  const deleteCompromisedAnnotation = async (id: string) => {
    await db.compromised_annotations.delete(id);
  };


  // ==========================================
  // 4. RETURN
  // ==========================================
  return {
    // Queries
    projectRoutes,
    pendingRoutes,
    projectAnnotations,
    executionRoutesWithData,
    projectMissions,

    // Routes
    getRoutesCollidingWithAnnotation,
    getMissionData,
    saveFlightRoute,
    deleteFlightRoute,
    addRouteHeader,
    processAndSaveRoute,
    toggleExecutionRoute,

    // Annotations
    saveCompromisedAnnotation,
    deleteCompromisedAnnotation,

    // Live Missions
    createMission,
    updateMission,
    deleteMission,
    createWaypoints,
    updateWaypoint,
    deleteWaypoint
  };
}