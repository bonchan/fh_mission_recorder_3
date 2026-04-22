// hooks/useFlightHubKeyboard.ts
import { useEffect, useRef } from 'react';
import { createLogger } from '@/utils/logger';

const log = createLogger('SidePanelView');

const notifyUI = (buttonName: string) => {
  window.dispatchEvent(new CustomEvent('RC_BUTTON_TAP', { detail: buttonName }));
};

// The messenger function
const sendKeyToTab = async (type: 'keydown' | 'keyup' | 'tap', keyName: string, keyCode: number, codeString: string) => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: 'DISPATCH_KEY',
        keyType: type,
        keyName: keyName,
        keyCode: keyCode,
        codeString: codeString
      });
    }
  } catch (err) {
    // Ignore errors
  }
};

const stepZoomInTab = async (direction: 'in' | 'out') => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: 'ZOOM_STEP',
        direction: direction
      });
    }
  } catch (err) {
    // Ignore errors
  }
};

export function useFlightHubKeyboard(sticks: any, buttons: any, isConnected: boolean) {
  const deadzone_threshold_elevation = 0.6
  const deadzone_threshold_movement = 0.3
  const deadzone_threshold_wheel = 0.1

  // --- Refs to track current key states ---
  const keys = useRef({
    c: false, z: false, // Throttle
    q: false, e: false, // Yaw
    w: false, s: false, // Pitch
    a: false, d: false,  // Roll
    up: false, down: false,
    left: false, right: false,
    wheel_left: false, wheel_right: false,
  });

  const activeCamera = useRef(1);

  const prevButtons = useRef(buttons);

  const latestSticks = useRef(sticks);
  useEffect(() => {
    latestSticks.current = sticks;
  }, [sticks]);

  // --- LEFT STICK: Throttle (C/Z) & Yaw (Q/E) ---
  useEffect(() => {
    if (!isConnected) return;

    // Throttle Up (C)
    if (sticks.throttle > deadzone_threshold_elevation && !keys.current.c) {
      sendKeyToTab('keydown', 'c', 67, 'KeyC'); keys.current.c = true;
    } else if (sticks.throttle <= deadzone_threshold_elevation && keys.current.c) {
      sendKeyToTab('keyup', 'c', 67, 'KeyC'); keys.current.c = false;
    }

    // Throttle Down (Z)
    if (sticks.throttle < -deadzone_threshold_elevation && !keys.current.z) {
      sendKeyToTab('keydown', 'z', 90, 'KeyZ'); keys.current.z = true;
    } else if (sticks.throttle >= -deadzone_threshold_elevation && keys.current.z) {
      sendKeyToTab('keyup', 'z', 90, 'KeyZ'); keys.current.z = false;
    }

    // Yaw Left (Q)
    if (sticks.yaw < -deadzone_threshold_movement && !keys.current.q) {
      sendKeyToTab('keydown', 'q', 81, 'KeyQ'); keys.current.q = true;
      if (activeCamera.current === 1) {
        sendKeyToTab('keydown', 'ArrowLeft', 37, 'ArrowLeft'); keys.current.left = true;
      }
    } else if (sticks.yaw >= -deadzone_threshold_movement && keys.current.q) {
      sendKeyToTab('keyup', 'q', 81, 'KeyQ'); keys.current.q = false;
      // FIX: If we pressed it previously, release it regardless of current camera!
      if (keys.current.left) {
        sendKeyToTab('keyup', 'ArrowLeft', 37, 'ArrowLeft'); keys.current.left = false;
      }
    }

    // Yaw Right (E)
    if (sticks.yaw > deadzone_threshold_movement && !keys.current.e) {
      sendKeyToTab('keydown', 'e', 69, 'KeyE'); keys.current.e = true;
      if (activeCamera.current === 1) {
        sendKeyToTab('keydown', 'ArrowRight', 39, 'ArrowRight'); keys.current.right = true;
      }
    } else if (sticks.yaw <= deadzone_threshold_movement && keys.current.e) {
      sendKeyToTab('keyup', 'e', 69, 'KeyE'); keys.current.e = false;
      // FIX: If we pressed it previously, release it!
      if (keys.current.right) {
        sendKeyToTab('keyup', 'ArrowRight', 39, 'ArrowRight'); keys.current.right = false;
      }
    }
  }, [sticks.throttle, sticks.yaw, isConnected]);

  // --- RIGHT STICK: Pitch (W/S) & Roll (A/D) ---
  useEffect(() => {
    if (!isConnected) return;

    // Pitch Up/Forward (W)
    if (sticks.pitch > deadzone_threshold_movement && !keys.current.w) {
      sendKeyToTab('keydown', 'w', 87, 'KeyW'); keys.current.w = true;
    } else if (sticks.pitch <= deadzone_threshold_movement && keys.current.w) {
      sendKeyToTab('keyup', 'w', 87, 'KeyW'); keys.current.w = false;
    }

    // Pitch Down/Backward (S)
    if (sticks.pitch < -deadzone_threshold_movement && !keys.current.s) {
      sendKeyToTab('keydown', 's', 83, 'KeyS'); keys.current.s = true;
    } else if (sticks.pitch >= -deadzone_threshold_movement && keys.current.s) {
      sendKeyToTab('keyup', 's', 83, 'KeyS'); keys.current.s = false;
    }

    // Roll Left (A)
    if (sticks.roll < -deadzone_threshold_movement && !keys.current.a) {
      sendKeyToTab('keydown', 'a', 65, 'KeyA'); keys.current.a = true;
    } else if (sticks.roll >= -deadzone_threshold_movement && keys.current.a) {
      sendKeyToTab('keyup', 'a', 65, 'KeyA'); keys.current.a = false;
    }

    // Roll Right (D)
    if (sticks.roll > deadzone_threshold_movement && !keys.current.d) {
      sendKeyToTab('keydown', 'd', 68, 'KeyD'); keys.current.d = true;
    } else if (sticks.roll <= deadzone_threshold_movement && keys.current.d) {
      sendKeyToTab('keyup', 'd', 68, 'KeyD'); keys.current.d = false;
    }
  }, [sticks.pitch, sticks.roll, isConnected]);



  useEffect(() => {
    if (!isConnected) return;

    // Left Wheel Up (ArrowUp)
    if (sticks.wheel_l > deadzone_threshold_wheel && !keys.current.up) {
      sendKeyToTab('keydown', 'ArrowUp', 38, 'ArrowUp'); keys.current.up = true;
    } else if (sticks.wheel_l <= deadzone_threshold_wheel && keys.current.up) {
      sendKeyToTab('keyup', 'ArrowUp', 38, 'ArrowUp'); keys.current.up = false;
    }

    // Left Wheel Down (ArrowDown)
    if (sticks.wheel_l < -deadzone_threshold_wheel && !keys.current.down) {
      sendKeyToTab('keydown', 'ArrowDown', 40, 'ArrowDown'); keys.current.down = true;
    } else if (sticks.wheel_l >= -deadzone_threshold_wheel && keys.current.down) {
      sendKeyToTab('keyup', 'ArrowDown', 40, 'ArrowDown'); keys.current.down = false;
    }

    // Right Wheel Left (ArrowLeft)
    if (sticks.wheel_r < -deadzone_threshold_wheel && !keys.current.wheel_left) {
      sendKeyToTab('keydown', 'ArrowLeft', 37, 'ArrowLeft'); keys.current.wheel_left = true;
    } else if (sticks.wheel_r >= -deadzone_threshold_wheel && keys.current.wheel_left) {
      sendKeyToTab('keyup', 'ArrowLeft', 37, 'ArrowLeft'); keys.current.wheel_left = false;
    }

    // Right Wheel Right (ArrowRight)
    if (sticks.wheel_r > deadzone_threshold_wheel && !keys.current.wheel_right) {
      sendKeyToTab('keydown', 'ArrowRight', 39, 'ArrowRight'); keys.current.wheel_right = true;
    } else if (sticks.wheel_r <= deadzone_threshold_wheel && keys.current.wheel_right) {
      sendKeyToTab('keyup', 'ArrowRight', 39, 'ArrowRight'); keys.current.wheel_right = false;
    }
  }, [sticks.wheel_l, sticks.wheel_r, isConnected]);


  useEffect(() => {
    if (!isConnected) return;

    // F1 -> 1
    if (buttons.f1 && !prevButtons.current.f1) {
      sendKeyToTab('tap', '1', 49, 'Digit1');
      activeCamera.current = 1;
    }
    // F2 -> 2
    if (buttons.f2 && !prevButtons.current.f2) {
      sendKeyToTab('tap', '2', 50, 'Digit2');
      activeCamera.current = 2;
    }
    // F3 -> 3
    if (buttons.f3 && !prevButtons.current.f3) {
      sendKeyToTab('tap', '3', 51, 'Digit3');
      activeCamera.current = 3;
    }
    // F4 -> T
    if (buttons.f4 && !prevButtons.current.f4) {
      sendKeyToTab('tap', 't', 84, 'KeyT');
    }
    // F5 -> Zoom In (Up the slider)
    if (buttons.f5 && !prevButtons.current.f5) {
      stepZoomInTab('in');
    }
    // F6 -> Zoom Out (Down the slider)
    if (buttons.f6 && !prevButtons.current.f6) {
      stepZoomInTab('out');
    }
    // BACK -> SPACE
    if (buttons.back && !prevButtons.current.back) {
      sendKeyToTab('tap', ' ', 32, 'Space');
    }
    // TR -> F
    if (buttons.tr && !prevButtons.current.tr) {
      notifyUI('TR')
      sendKeyToTab('tap', 'f', 70, 'KeyF');
    }

    // Update the ref so we know the state for the next time this runs
    prevButtons.current = buttons;
  }, [buttons, isConnected]);

  // --- EMERGENCY STOP / DISCONNECT CLEANUP ---
  useEffect(() => {
    // Only run this cleanup when the controller disconnects
    if (!isConnected) {
      const releaseMap: Record<string, [string, number, string]> = {
        w: ['w', 87, 'KeyW'],
        a: ['a', 65, 'KeyA'],
        s: ['s', 83, 'KeyS'],
        d: ['d', 68, 'KeyD'],
        q: ['q', 81, 'KeyQ'],
        e: ['e', 69, 'KeyE'],
        c: ['c', 67, 'KeyC'],
        z: ['z', 90, 'KeyZ'],
        up: ['ArrowUp', 38, 'ArrowUp'],
        down: ['ArrowDown', 40, 'ArrowDown'],
        left: ['ArrowLeft', 37, 'ArrowLeft'],
        right: ['ArrowRight', 39, 'ArrowRight'],
        wheel_left: ['ArrowLeft', 37, 'ArrowLeft'],
        wheel_right: ['ArrowRight', 39, 'ArrowRight'],
      };

      // Loop through all our tracked keys
      for (const [key, isPressed] of Object.entries(keys.current)) {
        if (isPressed) {
          // Fire the release event
          const [keyName, keyCode, codeString] = releaseMap[key];
          sendKeyToTab('keyup', keyName, keyCode, codeString);

          // Reset the tracker safely
          keys.current[key as keyof typeof keys.current] = false;
        }
      }
    }
  }, [isConnected]);
}