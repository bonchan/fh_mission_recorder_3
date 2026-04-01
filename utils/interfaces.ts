export enum ViewContext {
  SIDEPANEL = 'sidepanel',
  DASHBOARD = 'dashboard'
}

export enum MissionType {
  WAYPOINT = 'waypoint',
  ZENITHAL = 'zenithal',
  CLAMP = 'clamp',
}

export interface Dock {
  index: number;
  deviceSn: string;
  deviceModelName: string;
  deviceProjectCallsign: string;
  deviceOrganizationCallsign: string;
  longitude: number;
  latitude: number;
  height: number;
}

export interface Drone {
  deviceSn: string;
  deviceModelName: string;
  deviceModelKey: string;
  deviceProjectCallsign: string;
  deviceOrganizationCallsign: string;
  payloadIndex: string;
  parent: Dock | null;
}

export interface FlatDevice {
  id: string; // Unique ID for React keys
  hostSn: string;
  hostModel: string;
  hostCallsign: string;
  hostStatus: string;

  parentIndex: number;
  parentSn: string;
  parentModel: string;
  parentCallsign: string;
  parentStatus: string;

  rawHost: any;
  rawParent: any;
  [key: string]: any;
}

export interface Annotation {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  color: string;
}

export interface LiveDroneData {
  timestamp: number;
  sn: string;
  latitude: number;
  longitude: number;
  elevation: number;
  yaw: number;
  pitch: number;
  zoom: number;
  cameraMode: number;
  trigger: boolean;
}

export interface LiveWaypointData {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  gimbalPitch: number;
  zoomFactor: number;
}

export interface Mission {
  id: string;
  name: string;
  projectId: string;
  orgId: string;
  device: Drone;
  createdDate: number;
  updatedDate: number;
  // author: string | null;
  // isExpanded: boolean;
  missionType: MissionType;
  waypoints: Waypoint[];
}

export type WaypointType = 'default' | 'picture' | 'security' | 'hover';

export interface Waypoint {
  id: string;
  longitude: number;
  latitude: number;
  elevation: number;
  height: number;
  yaw: number;
  pitch: number;
  zoom: number;
  hoverTime: number;
  turn: string;
  actionGroup: any | null;
  type: WaypointType;
  tagIds?: string[];
}

export type MissionMap = Record<string, Mission[]>;

export interface SimulatorConnectParams {
  dockSn?: string;
  droneSn?: string;
  startLat?: number;
  startLon?: number;
}

export type TagCategory = 'flight_route' | 'location' | 'asset' | 'intention';

export interface TagOption {
  id: string;
  name: string;
  category: TagCategory;
}

export const TAG_OPTIONS: TagOption[] = [
  { id: 'ccdefa98-fbd4-4db6-952d-6622f848f111', name: 'cenital', category: 'flight_route' },
  { id: 'fa698daa-463d-428f-beb2-9dd2700e177b', name: 'detalle', category: 'flight_route' },
  { id: '3a803446-e8f5-4d98-9cd2-9d2de5ba0fec', name: 'boca_pozo', category: 'flight_route' },
  { id: '520d8efe-efb7-49b1-86c2-8b1d1f7c7e21', name: 'transformadores', category: 'flight_route' },
  { id: 'a6c2c7d4-75dc-48fa-8b4b-62924ba68537', name: 'bateria', category: 'location' },
  { id: '7f661ff3-d8c3-4b6a-8cc0-8719935929c3', name: 'pias', category: 'location' },
  { id: '587429ba-2a05-456c-8f7b-ff3f1bdc8a93', name: 'pad', category: 'location' },
  { id: '98276b6a-7108-490d-b67a-cbd19c3ff2f9', name: 'powerline', category: 'location' },
  { id: '0852f4d4-7c34-48ae-9f59-c78280e8189e', name: 'rgb', category: 'intention' },
  { id: '6c9177e5-7c34-421d-b78c-b78b1266fe45', name: 'thermal', category: 'intention' },
  { id: 'fa5a93b1-974e-4295-8bf5-6d88ac70e353', name: 'aib', category: 'asset' },
  { id: '9ae53eaf-5046-4773-9d25-8004f40277a0', name: 'aib_front', category: 'asset' },
  { id: '20b83f60-7f23-43ae-80c3-2f0a5661b82c', name: 'aib_beltguard', category: 'asset' },
  { id: '12cb2e43-2a94-419d-9f9d-3d764c08a6d8', name: 'aib_side', category: 'asset' },
  { id: '396cd4b1-5d88-496b-93db-53f4186dc13b', name: 'rotaflex_front', category: 'asset' },
  { id: '16fd5428-cdbe-4d22-b74e-55c0ef5f8d62', name: 'rotaflex_back', category: 'asset' },
  { id: 'de9d1c49-dc89-4be0-8e5e-ca36e234d7a0', name: 'kit_side', category: 'asset' },
  { id: '54086d6f-0bba-44da-ada4-22cb09a1cad1', name: 'kit_pump', category: 'asset' },
  { id: '08dcbbb2-ebcb-47d0-b31c-11991266247f', name: 'heater_front', category: 'asset' },
  { id: 'c182db7c-e091-4bfa-b5b7-166dd89b03e6', name: 'heater_back', category: 'asset' },
  { id: '3615b633-c20a-41d1-af35-27d2e75ea7a9', name: 'heater_side', category: 'asset' },
  { id: '2a17d118-621f-41d9-a52a-bb0dbfbfd920', name: 'manifold', category: 'asset' },
  { id: '15f660cc-d1b1-46c3-8e6a-6ca2c0b6f40f', name: 'pcp_R', category: 'asset' },
  { id: '62a8431d-b3d2-48b9-b1c4-7888b5609192', name: 'pcp_L', category: 'asset' },
  { id: '19916a20-5fc6-4665-933c-c4c2190cb81c', name: 'bes_R', category: 'asset' },
  { id: '6abe8961-ca20-4c45-b856-8b68b0071dee', name: 'bes_L', category: 'asset' },
  { id: '600d755e-cb2a-4e1d-8768-293ace086360', name: 'plift_R', category: 'asset' },
  { id: '9ccaa459-6f00-42bf-b42e-94737ed35021', name: 'plift_L', category: 'asset' },
  { id: '1d6ac5ff-4871-4b06-ae05-06bb4930bb74', name: 'production_R', category: 'asset' },
  { id: '34695dc1-7ba8-4b4f-8d60-fe5917cb4ecf', name: 'production_L', category: 'asset' },
  { id: '476d8c90-a5c0-494c-876e-491d12ff76c7', name: 'pcp', category: 'asset' },
  { id: 'a1d825af-e73a-4dde-a916-fd521bae69d4', name: 'bes', category: 'asset' },
  { id: '7ebcf6b2-44be-4993-946c-4627aac25629', name: 'plift', category: 'asset' },
  { id: 'e43acfdd-1759-47c8-844d-6e43acd28638', name: 'injector', category: 'asset' },
];