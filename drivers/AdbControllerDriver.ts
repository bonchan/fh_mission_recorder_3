// AdbControllerDriver.ts
import { ControllerDriver, ControllerState, ControllerCallbacks } from '@/components/controller/ControllerDriver';
import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import { createLogger } from '@/utils/logger';

const CredentialStore = new AdbWebCredentialStore("AdbControllerDriver");
const W_MAX = 1100.0;
const H_MAX = 1900.0;

const log = createLogger('AdbControllerDriver');

// We need initial states locally so the driver can mutate them and send updates
const INITIAL_STICKS = { throttle: 0, yaw: 0, pitch: 0, roll: 0, wheel_l: 0, wheel_r: 0 };
const INITIAL_TOUCH = { x: 0, y: 0, active: false };
const INITIAL_BUTTONS = {
  back: false, tr: false, tl: false,
  f1: false, f2: false, f3: false,
  f4: false, f5: false, f6: false,
  power: false,
  sw1: 0, sw2: 0
};

export class AdbControllerDriver implements ControllerDriver {
  private stopFlag = false;
  private process: any = null;
  private transport: any = null;
  
  // Store the callbacks object
  private callbacks?: ControllerCallbacks;

  // Local hardware state
  private sticks = { ...INITIAL_STICKS };
  private touch = { ...INITIAL_TOUCH };
  private buttons = { ...INITIAL_BUTTONS };

  async connect(callbacks: ControllerCallbacks) {
    this.stopFlag = false;
    this.callbacks = callbacks;

    try {
      const Manager = AdbDaemonWebUsbDeviceManager.BROWSER;
      if (!Manager) throw new Error("WebUSB is not supported.");

      const existingDevices = await Manager.getDevices();
      let device = existingDevices.length > 0 ? existingDevices[0] : undefined;

      if (!device) {
        log.info("No paired devices found. Requesting new device prompt...");
        device = await Manager.requestDevice();
      }

      if (!device) throw new Error("No device selected or prompt blocked.");

      log.info("Connecting to device:", device.serial);

      const connection = await device.connect();
      const transport = await AdbDaemonTransport.authenticate({
        serial: device.serial,
        connection,
        credentialStore: CredentialStore,
      });

      const adb = new Adb(transport);
      const process = await adb.subprocess.noneProtocol.spawn('getevent -lt');

      this.transport = transport;
      this.process = process;

      const reader = process.output.getReader();

      // Start the background reading loop WITHOUT awaiting it, 
      // so connect() can resolve immediately for React!
      this.startReadLoop(reader);

    } catch (err) {
      log.error("ADB Connection Error:", err);
      throw err; 
    }
  }

  async disconnect() {
    this.stopFlag = true;
    if (this.process) {
      try { await this.process.kill(); } catch (e) {}
      this.process = null;
    }
    if (this.transport) {
      try { await this.transport.close(); } catch (e) {}
      this.transport = null;
    }
  }

  private async startReadLoop(reader: any) {
    const decoder = new TextDecoder();
    let buffer = "";

    while (!this.stopFlag) {
      try {
        const { value, done } = await reader.read();
        
        // If the stream naturally finishes (device unplugged)
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        lines.forEach(line => {
          if (line.trim()) this.processLine(line);
        });
      } catch (err) {
        // If we didn't ask it to stop, this is an unexpected physical disconnect
        if (!this.stopFlag) {
          log.error("Stream read error (Device unplugged?):", err);
          if (this.callbacks?.onDisconnect) this.callbacks.onDisconnect();
        }
        break;
      }
    }

    // Secondary catch: If 'done' triggered without an explicit disconnect call
    if (!this.stopFlag && this.callbacks?.onDisconnect) {
      log.info("ADB stream ended unexpectedly.");
      this.callbacks.onDisconnect();
    }

    // Cleanup background processes
    try { await this.process?.kill(); } catch (e) { /* ignore */ }
    try { await this.transport?.close(); } catch (e) { /* ignore */ }
  }

  private processLine(line: string) {
    let updatedSticks = false;
    let updatedTouch = false;
    let updatedButtons = false;

    // 1. Stick Logic
    const absMatch = line.match(/EV_ABS\s+(ABS_\w+)\s+([0-9a-fA-F]+)/);
    if (absMatch) {
      const code = absMatch[1];
      const val = parseInt(absMatch[2], 16);

      if (code === 'ABS_Y') this.sticks.throttle = -this._normalize_stick(val);
      if (code === 'ABS_X') this.sticks.yaw = this._normalize_stick(val);
      if (code === 'ABS_RY') this.sticks.pitch = -this._normalize_stick(val);
      if (code === 'ABS_RX') this.sticks.roll = this._normalize_stick(val);
      if (code === 'ABS_Z') this.sticks.wheel_l = this._normalize_wheel(val);
      if (code === 'ABS_RZ') this.sticks.wheel_r = this._normalize_wheel(val);
      updatedSticks = true;
    }

    // 2. Touch Logic
    const touchMatch = line.match(/ABS_MT_POSITION_(X|Y)\s+([0-9a-fA-F]+)/);
    if (touchMatch) {
      const axis = touchMatch[1];
      const raw = parseInt(touchMatch[2], 16);
      if (axis === 'X') this.touch.x = ((raw / W_MAX * 2.0) - 1.0);
      if (axis === 'Y') this.touch.y = ((raw / H_MAX * 2.0) - 1.0);
      updatedTouch = true;
    }

    if (line.includes("ABS_MT_TRACKING_ID")) {
      const isOff = line.includes("ffffffff");
      this.touch.active = !isOff;
      updatedTouch = true;
    }

    // 3. Button Logic
    const keyMatch = line.match(/EV_KEY\s+(\w+)\s+(DOWN|UP|00000001|00000000)/);
    if (keyMatch) {
      const btnCode = keyMatch[1];
      const isDown = keyMatch[2].includes("DOWN") || keyMatch[2].includes("1");

      if (btnCode === "KEY_BACK") this.buttons.back = isDown;
      if (btnCode === "BTN_TR") this.buttons.tr = isDown;
      if (btnCode === "BTN_TL") this.buttons.tl = isDown;
      if (btnCode === "KEY_F1") this.buttons.f1 = isDown;
      if (btnCode === "KEY_F2") this.buttons.f2 = isDown;
      if (btnCode === "KEY_F3") this.buttons.f3 = isDown;
      if (btnCode === "KEY_F4") this.buttons.f4 = isDown;
      if (btnCode === "KEY_F5") this.buttons.f5 = isDown;
      if (btnCode === "KEY_F6") this.buttons.f6 = isDown;
      if (btnCode === "KEY_POWER") this.buttons.power = isDown;
      updatedButtons = true;
    }

    // Fire the callbacks to React!
    if (this.callbacks?.onUpdate) {
      if (updatedSticks) this.callbacks.onUpdate({ sticks: { ...this.sticks } });
      if (updatedTouch) this.callbacks.onUpdate({ touch: { ...this.touch } });
      if (updatedButtons) this.callbacks.onUpdate({ buttons: { ...this.buttons } });
    }
  }

  private _normalize_stick(val: number) {
    if (val > 0x7fffffff) val -= 0x100000000;
    const norm = (val - (-1)) / 32767.0;
    return Math.max(-1, Math.min(1, norm));
  }

  private _normalize_wheel(val: number) {
    const norm = (val - 127) / 127.0;
    return Math.max(-1, Math.min(1, norm));
  }
}