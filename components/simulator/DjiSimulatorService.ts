// utils/DjiSimulatorService.ts
import { LiveDroneData } from '@/utils/interfaces';

type StatusCallback = (status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void;
type DataCallback = (data: LiveDroneData) => void;

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

    connect() {
        if (this.socket?.readyState === WebSocket.OPEN) return;

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log("%c[DJI SIM] Connected", "color: green; font-weight: bold;");
            this.onStatus('CONNECTED');
        };

        this.socket.onmessage = (event) => {
            try {

                const jsonPayload = JSON.parse(event.data);

                if (jsonPayload.biz_code === 'device_osd') {
                    console.log('device_osd')
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
                        }

                        this.onData(liveDroneData);

                    } catch (e) { }

                }

            } catch (err) {
                console.error("[DJI SIM] Parse Error", err);
            }
        };

        this.socket.onclose = (event) => {
            this.onStatus('DISCONNECTED');
            if (!event.wasClean) {
                console.error("[DJI SIM] Connection died");
            }
        };

        this.socket.onerror = (error) => {
            this.onStatus('ERROR');
            console.error("[DJI SIM] Socket Error", error);
        };
    }

    disconnect() {
        this.socket?.close();
        this.socket = null;
    }
}