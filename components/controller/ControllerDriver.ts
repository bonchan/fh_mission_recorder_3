// types.ts
export type SticksState = { throttle: number; yaw: number; pitch: number; roll: number; wheel_l: number; wheel_r: number };
export type TouchState = { x: number; y: number; active: boolean };
export type ButtonsState = {
  back: boolean; power: boolean;
  tr: boolean; tl: boolean
  f1: boolean; f2: boolean; f3: boolean;
  f4: boolean; f5: boolean; f6: boolean;
};

export enum ControllerModel {
  RC3 = "DJI RC 3",
  RCP2 = "DJI RC plus2"
}

export interface ControllerState {
  sticks: SticksState;
  touch: TouchState;
  buttons: ButtonsState;
}

export type ControllerCallbacks = {
  onUpdate: (update: Partial<ControllerState>) => void;
  onDisconnect: () => void;
};

export interface ControllerDriver {
  // Pass the new ControllerCallbacks type here!
  connect(callbacks: ControllerCallbacks): Promise<void>;
  disconnect(): Promise<void>;
}