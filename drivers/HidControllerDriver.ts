// GamepadControllerDriver.ts
import { ControllerDriver, ControllerState, ControllerCallbacks } from '@/components/controller/ControllerDriver';
import { createLogger } from '@/utils/logger';

const log = createLogger('HidControllerDriver');

const INITIAL_STICKS = { throttle: 0, yaw: 0, pitch: 0, roll: 0, wheel_l: 0, wheel_r: 0 };
const INITIAL_BUTTONS = {
  back: false, power: false, tr: false, tl: false,
  f1: false, f2: false, f3: false, f4: false, f5: false, f6: false,
  sw1: 0, sw2: 0
};

export class HidControllerDriver implements ControllerDriver {
  private loopId: number | null = null;
  private stopFlag = false;

  // Store the callbacks object
  private callbacks?: ControllerCallbacks;

  // Local state
  private sticks = { ...INITIAL_STICKS };
  private buttons = { ...INITIAL_BUTTONS };

  async connect(callbacks: ControllerCallbacks) {
    this.callbacks = callbacks;
    this.stopFlag = false;

    // IMPORTANT: Browsers hide gamepads until the user physically presses a button!
    const gamepads = navigator.getGamepads();
    const hasGamepad = Array.from(gamepads).some(gp => gp !== null);

    if (!hasGamepad) {
      throw new Error("No controller detected. Please press any button on the RC3 to wake it up, then try again.");
    }

    log.info("Gamepad detected. Starting poll loop...");

    // Listen for physical disconnects from the OS
    window.addEventListener("gamepaddisconnected", this.handlePhysicalDisconnect);

    this.pollGamepad();
  }

  async disconnect() {
    this.stopFlag = true;
    window.removeEventListener("gamepaddisconnected", this.handlePhysicalDisconnect);

    if (this.loopId !== null) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }

    // Reset state
    this.sticks = { ...INITIAL_STICKS };
    this.buttons = { ...INITIAL_BUTTONS };
    log.info("Gamepad disconnected.");
  }

  // Triggered by the browser when the USB drops or controller powers off
  private handlePhysicalDisconnect = (e: GamepadEvent) => {
    log.info("Browser detected physical gamepad drop:", e.gamepad.id);
    if (this.callbacks?.onDisconnect) {
      this.callbacks.onDisconnect();
    }
    this.disconnect();
  };

  // Unlike ADB which pushes streams, Gamepads must be requested every frame
  private pollGamepad = () => {
    if (this.stopFlag) return;

    // Grab the freshest data from the browser
    const gamepads = navigator.getGamepads();
    const gp = Array.from(gamepads).find(pad => pad !== null);

    if (gp) {
      let updatedSticks = false;
      let updatedButtons = false;

      const roll = this.applyDeadzone(gp.axes[0] || 0);
      const pitch = this.applyDeadzone(gp.axes[1] || 0); // May need to be -gp.axes[1]
      const throttle = this.applyDeadzone(gp.axes[2] || 0); // May need to be -gp.axes[2]
      const yaw = this.applyDeadzone(gp.axes[3] || 0);
      const tilt = this.applyDeadzone(gp.axes[4] || 0);

      // Only push updates to React if the sticks actually moved
      if (this.sticks.roll !== roll || this.sticks.pitch !== pitch ||
        this.sticks.throttle !== throttle || this.sticks.yaw !== yaw || this.sticks.wheel_l !== tilt) {

        this.sticks.roll = roll;
        this.sticks.pitch = pitch;
        this.sticks.throttle = throttle;
        this.sticks.yaw = yaw;
        this.sticks.wheel_l = tilt;
        updatedSticks = true;
      }

      // ==========================================
      // BUTTON MAPPING
      // ==========================================
      const c1 = gp.buttons[0]?.pressed || false;
      const start_stop = gp.buttons[1]?.pressed || false;
      const pause = gp.buttons[2]?.pressed || false;
      const trigger = gp.buttons[3]?.pressed || false;

      const sw1 = gp.buttons[7]?.pressed ? -1 : (gp.buttons[6]?.pressed ? 1 : 0);
      const sw2 = gp.buttons[5]?.pressed ? 1 : (gp.buttons[4]?.pressed ? 0 : -1);

      // 1. Process regular hold-able buttons (c1, trigger, etc.)
      if (this.buttons.back !== c1 || this.buttons.tr !== trigger) {
        this.buttons.back = c1;
        this.buttons.tr = trigger;

        // Flag true ONLY for these normal buttons, so the bottom callback block catches them
        updatedButtons = true;
      }

      // 2. Process Switches (Momentary triggers)
      if (this.buttons.sw1 !== sw1) {
        this.buttons.sw1 = sw1; // Update our tracking variable

        // Do NOT set updatedButtons = true here, because triggerMomentary fires its own callbacks!
        if (sw1 === -1) this.triggerMomentary('f1');
        if (sw1 === 0) this.triggerMomentary('f2');
        if (sw1 === 1) this.triggerMomentary('f3');
      }

      if (this.buttons.sw2 !== sw2) {
        this.buttons.sw2 = sw2;

        if (sw2 === 1) this.triggerMomentary('f5');
        if (sw2 === -1) this.triggerMomentary('f6');
      }

      // ==========================================
      // FIRE CALLBACKS TO REACT
      // ==========================================
      if (this.callbacks?.onUpdate) {
        if (updatedSticks) this.callbacks.onUpdate({ sticks: { ...this.sticks } });

        // This will now only fire if a stick moved or a NORMAL button (like c1) was pressed
        if (updatedButtons) this.callbacks.onUpdate({ buttons: { ...this.buttons } });
      }
    }

    // Schedule the next poll for the next screen render (~60fps)
    this.loopId = requestAnimationFrame(this.pollGamepad);
  };

  private triggerMomentary(btn: 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6') {
    // Turn ON
    this.buttons[btn] = true;
    if (this.callbacks?.onUpdate) {
      this.callbacks.onUpdate({ buttons: { ...this.buttons } });
    }

    // Turn OFF after a short delay
    setTimeout(() => {
      this.buttons[btn] = false;
      if (this.callbacks?.onUpdate) {
        this.callbacks.onUpdate({ buttons: { ...this.buttons } });
      }
    }, 150);
  }

  // Helper function to match your python dead_zone logic
  private applyDeadzone(value: number, threshold = 0.1): number {
    if (Math.abs(value) < threshold) return 0;
    return value;
  }
}