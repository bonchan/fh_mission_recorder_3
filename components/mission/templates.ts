

// You can define a type if you want to keep things strictly typed!
export interface TemplateWaypoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  zoomFactor: number;
  type: string;
}

export interface MissionTemplate {
  name: string;
  template: TemplateWaypoint[];
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    name: "AIB",
    template: [
      { x: -45, y: 50, z: 0, yaw: 90, pitch: -42, zoomFactor: 7, type: 'picture' }, // Left
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -42, zoomFactor: 7, type: 'picture' }, // Origin
      { x: 0, y: 10, z: -10, yaw: 0, pitch: -42, zoomFactor: 7, type: 'picture' },
      { x: 4.5, y: 5.0, z: 0, yaw: 0, pitch: -90, zoomFactor: 7, type: 'security' },
      { x: 45, y: 50, z: 0, yaw: 270, pitch: -42, zoomFactor: 3, type: 'picture' }, // Right
    ]
  },
  {
    name: "KIT",
    template: [
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -42, zoomFactor: 3, type: 'picture' },
      { x: -40, y: 40, z: 0, yaw: 90, pitch: -42, zoomFactor: 3, type: 'picture' },
      { x: 0, y: 80, z: 0, yaw: 180, pitch: -42, zoomFactor: 3, type: 'picture' },
      { x: 40, y: 40, z: 0, yaw: 270, pitch: -42, zoomFactor: 3, type: 'picture' },
    ]
  }
];
