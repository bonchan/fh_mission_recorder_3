import { Annotation, AnnotationFlag, AppSettings, FlightRouteData, FlightRouteHeader, Mission, SavedRouteSet, SyncMetadata } from '@/utils/interfaces';
import Dexie, { Table } from 'dexie';


export class AppDatabase extends Dexie {
  sync_metadata!: Table<SyncMetadata, string>;
  settings!: Table<AppSettings, string>;

  annotations!: Table<Annotation, string>;
  annotations_flags!: Table<AnnotationFlag, string>;

  flight_routes!: Table<FlightRouteHeader, string>;
  flight_route_data!: Table<FlightRouteData, string>;
  missions!: Table<Mission, string>;

  topologies!: Table<Drone, string>;

  saved_route_sets!: Table<SavedRouteSet, string>;

  constructor() {
    super('P3DB');

    this.version(1).stores({
      sync_metadata: 'id',
      settings: 'id',

      annotations: 'id, projectId',
      annotations_flags: 'id, projectId',

      flight_routes: 'id, projectId, syncStatus, [projectId+syncStatus]',
      flight_route_data: 'routeId',
      missions: 'id, projectId',

      topologies: 'deviceSn, projectId',
    });

    this.version(2).stores({
      saved_route_sets: 'id, projectId, createdDate',
    });
  }
}

export const db = new AppDatabase();
