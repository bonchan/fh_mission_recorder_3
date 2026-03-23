export enum ViewContext {
  SIDEPANEL = 'sidepanel',
  DASHBOARD = 'dashboard'
}
export interface Dock {
  index: number;
  deviceSn: string;
  deviceModelName: string;
  deviceOrganizationCallsign: string;
  longitude: number;
  latitude: number;
  height: number;
}

export interface Drone {
  deviceSn: string;
  deviceModelName: string;
  deviceModelKey: string;
  deviceOrganizationCallsign: string;
  payloadIndex: string;
  parent: Dock | null;
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
  altitude: number;
  heading: number;
  gimbalPitch: number;
  zoomFactor: number;
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
  waypoints: Waypoint[];
}

export interface Waypoint {
  id: string;
  longitude: number;
  latitude: number;
  elevation: number;
  height: number;
  yaw: number;
  pitch: number;
  zoom: number;
  turn: string;
  actionGroup: any | null;
}

export type MissionMap = Record<string, Mission[]>;





