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



