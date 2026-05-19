import Dexie, { Table } from 'dexie';
import { SyncMetadata, FlightRouteHeader, FlightRouteData, Mission, Annotation, AnnotationFlag } from '@/utils/interfaces';


export class AppDatabase extends Dexie {
  sync_metadata!: Table<SyncMetadata, string>;

  annotations!: Table<Annotation, string>;
  annotations_flags!: Table<AnnotationFlag, string>;

  flight_routes!: Table<FlightRouteHeader, string>;
  flight_route_data!: Table<FlightRouteData, string>;
  missions!: Table<Mission, string>;

  topologies!: Table<Drone, string>;

  constructor() {
    super('P3DB');

    // 1. Change version(1) to version(2)
    // 2. Add the compound index [project_uuid+sync_status]
    this.version(1).stores({
      sync_metadata: 'id',

      annotations: 'id, projectId',
      annotations_flags: 'id, projectId',

      flight_routes: 'id, projectId, syncStatus, [projectId+syncStatus]',
      flight_route_data: 'routeId',
      missions: 'id, projectId',

      topologies: 'deviceSn, projectId',
    });
  }
}

export const db = new AppDatabase();