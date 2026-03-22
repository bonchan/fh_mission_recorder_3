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

export interface Annotation {
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    color: string;
}