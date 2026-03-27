import { WaypointType } from '@/utils/interfaces'

// You can define a type if you want to keep things strictly typed!
export interface TemplateWaypoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  zoomFactor: number;
  type: WaypointType;
  tagIds: Array<string>
}

export interface MissionTemplate {
  name: string;
  templateTagIds: Array<string>;
  template: TemplateWaypoint[];
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    name: "AIB",
    templateTagIds: [
      'fa698daa-463d-428f-beb2-9dd2700e177b', // detalle
      '587429ba-2a05-456c-8f7b-ff3f1bdc8a93', // pad
      'fa5a93b1-974e-4295-8bf5-6d88ac70e353', // aib
      '0852f4d4-7c34-48ae-9f59-c78280e8189e', // rgb

    ],
    template: [
      { x: -50, y: 50, z: 0, yaw: 90, pitch: -30, zoomFactor: 1, type: 'security', tagIds: [] },
      { x: -50, y: 50, z: 0, yaw: 90, pitch: -45, zoomFactor: 3, type: 'picture', tagIds: ['12cb2e43-2a94-419d-9f9d-3d764c08a6d8'] }, // Left, aib_side,
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -45, zoomFactor: 7, type: 'picture', tagIds: ['9ae53eaf-5046-4773-9d25-8004f40277a0'] }, // ORIGIN, aib_front,
      { x: 50, y: 50, z: 0, yaw: 270, pitch: -45, zoomFactor: 3, type: 'picture', tagIds: ['12cb2e43-2a94-419d-9f9d-3d764c08a6d8'] }, // Right, aib_side,
      { x: 50, y: 50, z: 0, yaw: 270, pitch: -30, zoomFactor: 1, type: 'security', tagIds: [] },
    ]
  },
  {
    name: "BP",
    templateTagIds: [
      'fa698daa-463d-428f-beb2-9dd2700e177b', // detalle
      '3a803446-e8f5-4d98-9cd2-9d2de5ba0fec', // boca_pozo
      '587429ba-2a05-456c-8f7b-ff3f1bdc8a93', // pad
      'fa5a93b1-974e-4295-8bf5-6d88ac70e353', // aib
    ],
    template: [
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -30, zoomFactor: 1, type: 'security', tagIds: [] },
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -45, zoomFactor: 3, type: 'picture', tagIds: ['6c9177e5-7c34-421d-b78c-b78b1266fe45'] }, // ORIGIN, thermal,
      { x: 0, y: -10, z: 10, yaw: 0, pitch: -45, zoomFactor: 7, type: 'picture', tagIds: ['0852f4d4-7c34-48ae-9f59-c78280e8189e'] }, //  rgb,
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -30, zoomFactor: 1, type: 'security', tagIds: [] },
    ]
  },
  {
    name: "KIT",
    templateTagIds: [
      'fa698daa-463d-428f-beb2-9dd2700e177b', // detalle
      '587429ba-2a05-456c-8f7b-ff3f1bdc8a93', // pad
    ],
    template: [
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -30, zoomFactor: 1, type: 'security', tagIds: [] },
      { x: 0, y: 0, z: 0, yaw: 0, pitch: -50, zoomFactor: 3, type: 'picture', tagIds: ['54086d6f-0bba-44da-ada4-22cb09a1cad1', '6c9177e5-7c34-421d-b78c-b78b1266fe45',] }, //ORIGIN, kit_pump, thermal,
      { x: 0, y: -20, z: 27.4, yaw: 0, pitch: -33.3, zoomFactor: 14, type: 'picture', tagIds: ['de9d1c49-dc89-4be0-8e5e-ca36e234d7a0', '0852f4d4-7c34-48ae-9f59-c78280e8189e',] }, //kit_side, rgb,
      { x: -70, y: 40, z: 27.4, yaw: 90, pitch: -33.3, zoomFactor: 14, type: 'picture', tagIds: ['de9d1c49-dc89-4be0-8e5e-ca36e234d7a0', '0852f4d4-7c34-48ae-9f59-c78280e8189e',] }, //kit_side, rgb,
      { x: 0, y: 100, z: 27.4, yaw: 180, pitch: -33.3, zoomFactor: 14, type: 'picture', tagIds: ['de9d1c49-dc89-4be0-8e5e-ca36e234d7a0', '0852f4d4-7c34-48ae-9f59-c78280e8189e',] }, //kit_side, rgb,
      { x: 70, y: 40, z: 27.4, yaw: 270, pitch: -33.3, zoomFactor: 14, type: 'picture', tagIds: ['de9d1c49-dc89-4be0-8e5e-ca36e234d7a0', '0852f4d4-7c34-48ae-9f59-c78280e8189e',] }, //kit_side, rgb,
      { x: 70, y: 40, z: 0, yaw: 270, pitch: -30, zoomFactor: 1, type: 'security', tagIds: [] },
    ]
  }
];
