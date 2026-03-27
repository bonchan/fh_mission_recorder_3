// utils/DjiSimulatorService.ts
import { LiveDroneData, SimulatorConnectParams } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';

type StatusCallback = (status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void;
type DataCallback = (data: LiveDroneData) => void;

const log = createLogger('DjiSimulatorService');

export class DjiSimulatorService {
  private socket: WebSocket | null = null;
  private url: string;
  private onData: DataCallback;
  private onStatus: StatusCallback;

  constructor(url: string, onData: DataCallback, onStatus: StatusCallback) {
    this.url = url;
    this.onData = onData;
    this.onStatus = onStatus;
  }

  connect(params?: SimulatorConnectParams) {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const dockSn = params?.dockSn || 'default-dock-sn';
    const droneSn = params?.droneSn || 'default-drone-sn';
    const startLon = params?.startLon || 'start-lon';
    const startLat = params?.startLat || 'start-lat';

    this.socket = new WebSocket(`${this.url}?dock_sn=${dockSn}&drone_sn=${droneSn}&start_lon=${startLon}&start_lat=${startLat}&`);

    this.socket.onopen = () => {
      log.info("%c[DJI SIM] Connected", "color: green; font-weight: bold;");
      this.onStatus('CONNECTED');
    };

    this.socket.onmessage = (event) => {
      try {

        const jsonPayload = JSON.parse(event.data);

        if (jsonPayload.biz_code === 'device_osd') {
          // drone
          try {
            const host = jsonPayload.data?.host

            const camera = host.cameras[0]

            const payload = host[camera.payload_index]

            const liveDroneData: LiveDroneData = {
              timestamp: jsonPayload.timestamp,
              sn: jsonPayload.data.sn,
              latitude: host.latitude,
              longitude: host.longitude,
              altitude: host.elevation,
              heading: host.attitude_head,
              gimbalPitch: payload.gimbal_pitch,
              zoomFactor: payload.zoom_factor,
              cameraMode: camera.camera_mode,
              trigger: camera.photo_state,
            }

            this.onData(liveDroneData);

          } catch (e) { }

        }

      } catch (err) {
        log.error("[DJI SIM] Parse Error", err);
      }
    };

    this.socket.onclose = (event) => {
      this.onStatus('DISCONNECTED');
      if (!event.wasClean) {
        log.error("[DJI SIM] Connection died");
      }
    };

    this.socket.onerror = (error) => {
      this.onStatus('ERROR');
      log.error("[DJI SIM] Socket Error", error);
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }
}