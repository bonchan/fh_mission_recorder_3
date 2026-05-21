import { CIRCLE_BUFFER, FIVE_MIN_MS } from '@/utils/constants';
import { db } from '@/utils/db';
import { get3DDistanceInMeters } from '@/utils/geo';
import { AnnotationFlag, FlightRoute, FlightRouteData, FlightRouteHeader, Mission, RouteSafetyStatus, Waypoint } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { toWaypointMini } from '@/utils/mapper';
import { useLiveQuery } from 'dexie-react-hooks';
import { type DjiKmzData } from 'dji-kmz-parser';

const log = createLogger('useDatabase');

export function useDatabase(orgId: string, projectId: string) {


  const RESET_ROUTE_PAYLOAD = {
    syncStatus: 'PENDING' as const,
    safetyStatus: 'UNKNOWN' as const,
    startLat: null,
    startLon: null,
    distance: null,
    url: null,
    kmzWithoutResUrl: null,
    waylinePointNums: null,
  };

  // ==========================================
  // REACTIVE QUERIES
  // ==========================================

  const projectRoutes = useLiveQuery(
    () => db.flight_routes
      .where('projectId')
      .equals(projectId)
      .sortBy('name'), // 👈 Replaces .toArray()
    [projectId]
  ) || [];

  const projectTopologies = useLiveQuery(
    () => db.topologies
      .where('projectId')
      .equals(projectId)
      .toArray(),
    [projectId]
  ) || [];

  // Inside useDatabase.ts
  const projectAnnotations = useLiveQuery(
    async () => {
      if (!projectId) return [];

      // 1. Fetch BOTH tables at the exact same time using Promise.all (much faster)
      const [rawAnnotations, flags] = await Promise.all([
        db.annotations.where('projectId').equals(projectId).sortBy('name'),
        db.annotations_flags.where('projectId').equals(projectId).toArray()
      ]);

      // 2. Create a quick lookup Set of the compromised IDs
      // We check f.isCompromised just in case you ever save a flag as false
      const compromisedIds = new Set(
        flags.filter(f => f.isCompromised).map(f => f.id)
      );

      // 3. Merge them on the fly!
      return rawAnnotations.map(anno => ({
        ...anno,
        isCompromised: compromisedIds.has(anno.id)
      }));
    },
    [projectId]
  ) || [];

  const executionRoutesWithData = useLiveQuery(async (): Promise<FlightRoute[]> => {
    const headers = await db.flight_routes
      .where('projectId').equals(projectId)
      .filter(r => r.isExecutionRoute)
      .sortBy('name');

    const [rawAnnotations, flags] = await Promise.all([
      db.annotations.where('projectId').equals(projectId).toArray(),
      db.annotations_flags.where('projectId').equals(projectId).toArray()
    ]);

    const compromisedIds = new Set(flags.filter(f => f.isCompromised).map(f => String(f.id)));
    const compromisedAnnotations = rawAnnotations
      .filter(a => compromisedIds.has(String(a.id)) && a.latitude && a.longitude);

    const fullRoutes = await Promise.all(
      headers.map(async (header): Promise<FlightRoute> => {
        const data = await db.flight_route_data.get(header.id);

        let safetyStatus: RouteSafetyStatus = 'UNKNOWN';
        let modifiedData: DjiKmzData | null = null;

        if (header.startLat != null && header.startLon != null && header.distance != null) {
          const isAreaCompromised = compromisedAnnotations.some(anno => {
            const dist = get3DDistanceInMeters(
              header.startLat!, header.startLon!, 0,
              anno.latitude, anno.longitude, 0
            );
            return dist <= header.distance!;
          });

          if (!isAreaCompromised) {
            safetyStatus = 'SAFE';
          } else {
            safetyStatus = 'AREA_WARNING';

            if (data?.originalData) {
              const collisionResult = calculateRouteCollision(
                data.originalData,
                compromisedAnnotations,
                CIRCLE_BUFFER
              );

              safetyStatus = collisionResult.compromised ? 'PATH_COMPROMISED' : 'AREA_WARNING';
              modifiedData = collisionResult.modifiedData;
            }
          }
        }

        return {
          ...header,
          safetyStatus,

          originalWaypoints: data?.originalData ? toWaypointMini(data.originalData) : [],
          modifiedWaypoints: modifiedData ? toWaypointMini(modifiedData) : [],

          data: data ? {
            routeId: data.routeId,
            originalData: data.originalData,
            modifiedData,
          } : undefined,
        };
      })
    );

    return fullRoutes;
  }, [projectId]);

  // ==========================================
  // LIVE MISSIONS
  // ==========================================

  const projectMissions = useLiveQuery(
    () => db.missions.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  const checkIsCacheFresh = async (cacheKey: string, maxAgeMs = FIVE_MIN_MS) => {
    const metadata = await db.sync_metadata.get(cacheKey);
    if (!metadata) return false;
    return (Date.now() - metadata.lastUpdated) < maxAgeMs;
  };

  const markCacheUpdated = async (cacheKey: string) => {
    await db.sync_metadata.put({ id: cacheKey, lastUpdated: Date.now() });
  };

  const createMission = async (mission: Mission) => {
    await db.missions.put(mission);
  };

  const updateMission = async (missionId: string, updates: Partial<Mission>) => {
    await db.missions.update(missionId, updates);
  };

  const deleteMission = async (missionId: string) => {
    await db.missions.delete(missionId);
  };

  const createWaypoints = async (missionId: string, waypoints: Waypoint | Waypoint[], insertIndex?: number) => {
    const waypointsToAdd = Array.isArray(waypoints) ? waypoints : [waypoints];
    const mission = await db.missions.get(missionId);
    if (!mission) return;

    const currentList = mission.waypoints || [];
    let newList;

    if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= currentList.length) {
      newList = [
        ...currentList.slice(0, insertIndex),
        ...waypointsToAdd,
        ...currentList.slice(insertIndex)
      ];
    } else {
      newList = [...currentList, ...waypointsToAdd];
    }

    await db.missions.update(missionId, { waypoints: newList });
  };

  const updateWaypoint = async (missionId: string, waypointId: string, updates: Partial<Waypoint>) => {
    const mission = await db.missions.get(missionId);
    if (!mission || !mission.waypoints) return;

    const newList = mission.waypoints.map(wp =>
      wp.id === waypointId ? { ...wp, ...updates } : wp
    );

    await db.missions.update(missionId, { waypoints: newList });
  };

  const deleteWaypoint = async (missionId: string, waypointId: string) => {
    const mission = await db.missions.get(missionId);
    if (!mission || !mission.waypoints) return;

    const newList = mission.waypoints.filter(wp => wp.id !== waypointId);
    await db.missions.update(missionId, { waypoints: newList });
  };

  // ==========================================
  // FLIGHT ROUTES
  // ==========================================

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
    const header = createBaseRouteHeader(apiRoute.id, apiRoute.name, apiRoute.update_time, false);
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
        await db.flight_routes.update(routeId, { syncStatus: 'READY' });
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

  const markRouteFailed = async (routeId: string) => {
    try {
      await db.flight_routes.update(routeId, { syncStatus: 'FAILED' });
    } catch (error) {
      log.error(`Failed to mark route ${routeId} as FAILED`, error);
    }
  };

  const markRouteStale = async (routeId: string, newUpdateTime: number) => {
    try {
      await db.transaction('rw', db.flight_routes, db.flight_route_data, async () => {
        await db.flight_routes.update(routeId, {
          ...RESET_ROUTE_PAYLOAD,
          updateTime: newUpdateTime,
        });
        await db.flight_route_data.delete(routeId);
      });
      log.info(`Route ${routeId} marked as stale and reset to PENDING.`);
    } catch (error) {
      log.error(`Failed to mark route ${routeId} stale`, error);
    }
  };


  const createBaseRouteHeader = (id: string, name: string, updateTime: number, isExecution: boolean): FlightRouteHeader => ({
    id,
    projectId,
    name,
    updateTime,
    isExecutionRoute: isExecution,
    ...RESET_ROUTE_PAYLOAD
  });

  const syncPastedExecutionRoutes = async (allFetchedApiRoutes: any[], uniqueSortedNames: string[]) => {
    try {
      await db.transaction('rw', db.flight_routes, db.flight_route_data, async () => {
        for (const apiRoute of allFetchedApiRoutes) {

          // Filter out collateral results from prefix search
          if (!uniqueSortedNames.includes(apiRoute.name)) continue;

          const apiUpdateTime = apiRoute.updateTime || apiRoute.update_time;
          const existingRoute = await db.flight_routes.get(apiRoute.id);

          if (existingRoute) {
            if (apiUpdateTime > existingRoute.updateTime) {
              // Route was updated — reset all downstream data
              log.info(`Route ${apiRoute.name} has newer update_time. Resetting.`);
              await db.flight_routes.put({
                ...existingRoute,
                ...RESET_ROUTE_PAYLOAD,
                updateTime: apiUpdateTime,
                isExecutionRoute: true,
              });
              await db.flight_route_data.delete(apiRoute.id);
            } else {
              // Same version — just make sure flags are correct
              const updates: Partial<FlightRouteHeader> = {};
              if (!existingRoute.isExecutionRoute) updates.isExecutionRoute = true;
              // Re-queue if it previously failed so user can retry
              if (existingRoute.syncStatus === 'FAILED') updates.syncStatus = 'PENDING';
              if (Object.keys(updates).length > 0) {
                await db.flight_routes.update(apiRoute.id, updates);
              }
            }
          } else {
            // Brand new route
            const header = createBaseRouteHeader(apiRoute.id, apiRoute.name, apiUpdateTime, true);
            await db.flight_routes.put(header);
          }
        }
      });
      log.info(`Successfully synced ${uniqueSortedNames.length} pasted execution routes.`);
    } catch (dbError) {
      log.error("Database Transaction Failed!", dbError);
    }
  };

  // The details call (step 2): fills coords/distance, rechecks update_time
  const syncRouteDetails = async (routeId: string, apiData: any) => {
    const ext = apiData?.ext || {};
    const apiUpdateTime = apiData?.update_time || apiData?.updateTime;
    const startLat = ext.start_latitude;
    const startLon = ext.start_longitude;
    const distance = ext.distance;

    try {
      await db.transaction('rw', db.flight_routes, db.flight_route_data, async () => {
        const existing = await db.flight_routes.get(routeId);
        if (!existing) throw new Error(`Route ${routeId} not found in DB`);

        // If update_time moved again since the list call, reset and bail
        if (apiUpdateTime && apiUpdateTime > existing.updateTime) {
          log.warn(`Route ${routeId} was updated again during details sync. Resetting.`);
          await db.flight_routes.update(routeId, {
            ...RESET_ROUTE_PAYLOAD,
            updateTime: apiUpdateTime,
          });
          await db.flight_route_data.delete(routeId);
          return;
        }

        // Validate required fields
        if (startLat == null || startLon == null || distance == null) {
          log.warn(`Missing required details for route ${routeId}. Marking FAILED.`);
          await db.flight_routes.update(routeId, { syncStatus: 'FAILED' });
          return;
        }

        // All good — write details, advance to SYNCED
        await db.flight_routes.update(routeId, {
          url: apiData.url || null,
          kmzWithoutResUrl: apiData.kmz_without_res_url || null,
          waylinePointNums: ext.wayline_point_nums || null,
          startLat,
          startLon,
          distance,
          syncStatus: 'SYNCED',
        });

        log.info(`Route ${routeId} synced to SYNCED.`);
      });
    } catch (error) {
      log.error(`syncRouteDetails failed for ${routeId}`, error);
      await db.flight_routes.update(routeId, { syncStatus: 'FAILED' });
    }
  };

  // ==========================================
  // TOPOLOGIES
  // ==========================================

  const saveTopologiesCache = async (topologiesList: Drone[]) => {

    log.info("DEBUG - What is topologiesList?", topologiesList);


    const cacheKey = `topologies_${projectId}`;
    await db.transaction('rw', db.topologies, db.sync_metadata, async () => {
      await db.topologies.where('projectId').equals(projectId).delete();
      await db.topologies.bulkPut(topologiesList);
      await db.sync_metadata.put({ id: cacheKey, lastUpdated: Date.now() });
    });
  };

  // ==========================================
  // ANNOTATIONS
  // ==========================================

  const saveAnnotationsCache = async (annotationList: Annotation[]) => {
    const cacheKey = `annotations_${projectId}`;
    await db.transaction('rw', db.annotations, db.sync_metadata, async () => {
      await db.annotations.where('projectId').equals(projectId).delete();
      await db.annotations.bulkPut(annotationList);
      await db.sync_metadata.put({ id: cacheKey, lastUpdated: Date.now() });
    });
  };

  const saveCompromisedAnnotation = async (annotation: AnnotationFlag) => {
    try {
      await db.annotations_flags.put({ ...annotation });
      log.info(`Saved compromised annotation: ${annotation.id}`);
    } catch (error) {
      log.error('Failed to save compromised annotation', error);
    }
  };

  const deleteCompromisedAnnotation = async (id: string) => {
    await db.annotations_flags.delete(id);
  };

  // ==========================================
  // BACKUP RESTORE
  // ==========================================

  const doBackup = async (): Promise<Blob> => {
    const allDbData: Record<string, any[]> = {};

    for (const table of db.tables) {
      allDbData[table.name] = await table.toArray();
    }

    const blob = new Blob([JSON.stringify(allDbData, null, 2)], { type: 'application/json' });
    log.info('IndexedDB backup blob generated successfully.');

    return blob; // 👈 Just return the raw data file!
  };

  const doRestore = async (file: File): Promise<void> => {
    if (!file) return;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsedData = JSON.parse(content);

          const backupTableNames = Object.keys(parsedData);
          const validTables = db.tables.filter(table => backupTableNames.includes(table.name));

          if (validTables.length === 0) {
            throw new Error("No matching tables found in this backup file.");
          }

          await db.transaction('rw', validTables, async () => {
            for (const table of validTables) {
              log.info(`Restoring table: ${table.name}...`);
              await table.clear();

              const recordsToInsert = parsedData[table.name];
              if (recordsToInsert && recordsToInsert.length > 0) {
                await table.bulkAdd(recordsToInsert);
              }
            }
          });

          resolve(); // 👈 Pure data logic. Just resolve!

        } catch (err) {
          log.error("Failed to parse or restore IDB backup", err);
          reject(err); // 👈 Pure data logic. Just reject!
        }
      };

      reader.onerror = () => reject(new Error("Failed to read the file"));
      reader.readAsText(file);
    });
  };

  // ==========================================
  // RETURN
  // ==========================================
  return {
    // Queries
    projectRoutes,
    projectTopologies,
    projectAnnotations,
    executionRoutesWithData,
    projectMissions,

    //Cache
    checkIsCacheFresh,
    markCacheUpdated,

    // Routes
    getMissionData,
    saveFlightRoute,
    deleteFlightRoute,
    addRouteHeader,
    processAndSaveRoute,
    toggleExecutionRoute,
    markRouteFailed,
    markRouteStale,
    syncPastedExecutionRoutes,
    syncRouteDetails,

    // Topologies
    saveTopologiesCache,

    // Annotations
    saveAnnotationsCache,
    saveCompromisedAnnotation,
    deleteCompromisedAnnotation,

    // Missions
    createMission,
    updateMission,
    deleteMission,
    createWaypoints,
    updateWaypoint,
    deleteWaypoint,

    //Backup & Restore
    doBackup,
    doRestore,
  };
}