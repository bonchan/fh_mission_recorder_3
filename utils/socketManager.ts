/**
 * Interface representing the DJI OSD Message Structure
 * Add more fields here as needed for your specific dashboard.
 */
interface DJISocketMessage {
  timestamp: number;
  data: {
    host: {
      latitude: number;
      longitude: number;
      height: number;
      heading: number;
      drone_in_dock: number;
      drone_charge_state: {
        capacity_percent: number;
      };
    };
    sn: string;
  };
}

export class DroneSocketManager {
  private url: string;
  private socket: WebSocket | null = null;
  private isEnabled: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  public lastData: DJISocketMessage | null = null;
  public onData: (data: DJISocketMessage) => void = () => { };

  constructor(url: string = "ws://localhost:8765") {
    this.url = url;
    console.log("%c[Manager] TS Initialized. Run 'sim.enable()'", "color: #00aaff");
  }

  /**
   * Start the listener and attempt connection
   */
  public enable(): void {
    this.isEnabled = true;
    this.connect();
    console.log("%c[Manager] Listening Enabled", "color: green; font-weight: bold;");
  }

  /**
   * Stop the listener and kill active connections
   */
  public disable(): void {
    this.isEnabled = false;
    if (this.socket) {
      this.socket.close();
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    console.log("%c[Manager] Listening Disabled", "color: red; font-weight: bold;");
  }

  private connect(): void {
    if (!this.isEnabled) return;

    console.log(`%c[Socket] Connecting to ${this.url}...`, "color: #888");
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log("%c[Socket] Connected to Simulator", "color: green");
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data: DJISocketMessage = JSON.parse(event.data);
        this.lastData = data;
        this.onData(data);
        this.handleData(data);
      } catch (err) {
        console.error("[Socket] Parse Error:", err);
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (this.isEnabled) {
        console.warn("[Socket] Lost connection. Retrying in 2s...");
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    this.socket.onerror = (error: Event) => {
      // Error event usually doesn't contain details for security reasons
      // The onclose handler will handle the retry logic
    };
  }

  private handleData(data: DJISocketMessage): void {
    const h = data.data.host;

    // This log keeps the console clean while showing live movement
    console.clear();
    console.log(`%c--- SIMULATOR OSD [${this.isEnabled ? 'ACTIVE' : 'IDLE'}] ---`, "color: #00aaff");

    console.table({
      "Lat": h.latitude.toFixed(7),
      "Lng": h.longitude.toFixed(7),
      "Alt": `${h.height}m`,
      "Hdg": `${h.heading}°`,
      "Bat": `${h.drone_charge_state.capacity_percent}%`,
      "Status": h.drone_in_dock ? "Docked" : "In Flight"
    });
  }

  /**
   * Public method to check state from other parts of your extension
   */
  public getStatus() {
    return {
      isEnabled: this.isEnabled,
      isConnected: this.socket?.readyState === WebSocket.OPEN,
      hasData: !!this.lastData
    };
  }
}

// Attach to window for easy debugging in console
// (window as any).sim = new DroneSocketManager();