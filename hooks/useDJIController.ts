import { useState, useRef, useEffect, useCallback } from 'react';
import { createLogger } from '@/utils/logger';
import { Adb } from '@yume-chan/adb';
import { AdbDaemonTransport } from '@yume-chan/adb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

const CredentialStore = new AdbWebCredentialStore("useDJIController");
const W_MAX = 1100.0;
const H_MAX = 1900.0;

const log = createLogger('useDJIController');

const INITIAL_STICKS = { throttle: 0, yaw: 0, pitch: 0, roll: 0, wheel_l: 0, wheel_r: 0 };
const INITIAL_TOUCH = { x: 0, y: 0, active: false };
const INITIAL_BUTTONS = {
  back: false, tr: false, tl: false,
  f1: false, f2: false, f3: false,
  f4: false, f5: false, f6: false,
  power: false
};

export function useDJIController() {
  const [isConnected, setIsConnected] = useState(false);
  const [sticks, setSticks] = useState(INITIAL_STICKS);
  const [touch, setTouch] = useState(INITIAL_TOUCH);
  const [buttons, setButtons] = useState(INITIAL_BUTTONS);

  const stopRef = useRef(false);
  const transportRef = useRef<any>(null);
  const processRef = useRef<any>(null);

  // Clean up if the hook unmounts
  useEffect(() => {
    return () => { stopRef.current = true; };
  }, []);

  const disconnect = useCallback(async () => {
    stopRef.current = true;
    setIsConnected(false);

    // Aggressively kill the ADB process
    if (processRef.current) {
      try { await processRef.current.kill(); } catch (e) { }
      processRef.current = null;
    }

    // Aggressively close the USB Transport
    if (transportRef.current) {
      try { await transportRef.current.close(); } catch (e) { }
      transportRef.current = null;
    }
    // RESET
    setSticks(INITIAL_STICKS);
    setTouch(INITIAL_TOUCH);
    setButtons(INITIAL_BUTTONS);
  }, []);

  const processLine = (line: string) => {

    log.debug("LINE: ", line)

    // 1. Stick Logic
    const absMatch = line.match(/EV_ABS\s+(ABS_\w+)\s+([0-9a-fA-F]+)/);
    if (absMatch) {
      const code = absMatch[1];
      let val = parseInt(absMatch[2], 16);

      setSticks(prev => ({
        ...prev,
        throttle: code === 'ABS_Y' ? -_normalize_stick(val) : prev.throttle,
        yaw: code === 'ABS_X' ? _normalize_stick(val) : prev.yaw,
        pitch: code === 'ABS_RY' ? -_normalize_stick(val) : prev.pitch,
        roll: code === 'ABS_RX' ? _normalize_stick(val) : prev.roll,
        wheel_l: code == "ABS_Z" ? _normalize_wheel(val) : prev.wheel_l,
        wheel_r: code == "ABS_RZ" ? _normalize_wheel(val) : prev.wheel_r,
      }));
    }

    // 2. Touch Logic
    const touchMatch = line.match(/ABS_MT_POSITION_(X|Y)\s+([0-9a-fA-F]+)/);
    if (touchMatch) {
      const axis = touchMatch[1];
      const raw = parseInt(touchMatch[2], 16);
      setTouch(prev => {
        const newX = axis === 'X' ? ((raw / W_MAX * 2.0) - 1.0) : prev.x;
        const newY = axis === 'Y' ? ((raw / H_MAX * 2.0) - 1.0) : prev.y;
        return { ...prev, x: newX, y: newY };
      });
    }

    if (line.includes("ABS_MT_TRACKING_ID")) {
      const isOff = line.includes("ffffffff");
      setTouch(prev => ({ ...prev, active: !isOff }));
    }

    // 3. Button Logic
    const keyMatch = line.match(/EV_KEY\s+(\w+)\s+(DOWN|UP|00000001|00000000)/);
    if (keyMatch) {
      const btnCode = keyMatch[1];
      const action = keyMatch[2];
      const isDown = action.includes("DOWN") || action.includes("1");

      setButtons(prev => {
        const next = { ...prev };
        if (btnCode === "KEY_BACK") next.back = isDown;
        if (btnCode === "BTN_TR") next.tr = isDown;
        if (btnCode === "BTN_TL") next.tl = isDown;
        if (btnCode === "KEY_F1") next.f1 = isDown;
        if (btnCode === "KEY_F2") next.f2 = isDown;
        if (btnCode === "KEY_F3") next.f3 = isDown;

        if (btnCode === "KEY_F4") next.f4 = isDown;
        if (btnCode === "KEY_F5") next.f5 = isDown;
        if (btnCode === "KEY_F6") next.f6 = isDown;

        if (btnCode === "KEY_POWER") next.power = isDown;
        return next;
      });
    }
  };

  const _normalize_stick = (val: number) => {
    if (val > 0x7fffffff) val -= 0x100000000;
    const norm = (val - (-1)) / 32767.0;
    const finalNorm = Math.max(-1, Math.min(1, norm));
    return finalNorm
  }

  const _normalize_wheel = (val: number) => {
    let norm = (val - 127) / 127.0;
    return Math.max(-1, Math.min(1, norm));
  }

  const connect = async () => {
    try {
      const Manager = AdbDaemonWebUsbDeviceManager.BROWSER;
      if (!Manager) return console.error("WebUSB is not supported.");

      // 1. NEW: Check if the extension ALREADY has permission for the DJI Remote
      const existingDevices = await Manager.getDevices();

      // Grab the first pre-approved device, otherwise null
      let device = existingDevices.length > 0 ? existingDevices[0] : undefined;

      // 2. If we don't have one, try to trigger the Chrome prompt
      if (!device) {
        console.log("No paired devices found. Requesting new device prompt...");
        device = await Manager.requestDevice();
      }

      // 3. If it's STILL null, the user canceled or Chrome blocked it
      if (!device) {
        return console.log("[useDJIController] No device selected or prompt blocked by Side Panel.");
      }

      console.log("Connecting to device:", device.serial);

      const connection = await device.connect();
      const transport = await AdbDaemonTransport.authenticate({
        serial: device.serial,
        connection,
        credentialStore: CredentialStore,
      });

      const adb = new Adb(transport);
      const process = await adb.subprocess.noneProtocol.spawn('getevent -lt');

      transportRef.current = transport;
      processRef.current = process;

      setIsConnected(true);
      stopRef.current = false;

      const reader = process.output.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopRef.current) {
        try {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          lines.forEach(line => {
            if (line.trim()) processLine(line);
          });
        } catch (err) {
          // If we intentionally disconnected, we EXPECT an error here. 
          // Just silently break the loop.
          if (stopRef.current) break;

          console.error("Stream read error:", err);
          break;
        }
      }

      await process.kill();
      await transport.close();
    } catch (err) {
      log.error("ADB Connection Error:", err);
      setIsConnected(false);
    }
  };

  // Expose exactly what the UI needs
  return {
    isConnected,
    connect,
    disconnect,
    sticks,
    touch,
    buttons
  };
}