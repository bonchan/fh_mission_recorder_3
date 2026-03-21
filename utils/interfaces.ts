export interface LiveDroneData {
  timestamp: number;
  sn: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  gimbalPitch: number;
}

export interface LiveWaypointData {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  gimbalPitch: number;
}

export interface Annotation {
    id: string;
    name: string;
    longitude: number;
    latitude: number;
    color: string;
}