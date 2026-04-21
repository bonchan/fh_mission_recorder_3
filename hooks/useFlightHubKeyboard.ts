// W: sendKeyToTab('keydown', 'w', 87, 'KeyW')
// A: sendKeyToTab('keydown', 'a', 65, 'KeyA')
// S: sendKeyToTab('keydown', 's', 83, 'KeyS')
// D: sendKeyToTab('keydown', 'd', 68, 'KeyD')
// Q: sendKeyToTab('keydown', 'q', 81, 'KeyQ')
// E: sendKeyToTab('keydown', 'e', 69, 'KeyE')
// 1: sendKeyToTab('keydown', '1', 49, 'Digit1')
// Space: sendKeyToTab('keydown', ' ', 32, 'Space')
// Arrow Up: sendKeyToTab('keydown', 'ArrowUp', 38, 'ArrowUp')
// Arrow Down: sendKeyToTab('keydown', 'ArrowDown', 40, 'ArrowDown')
// Arrow Left: sendKeyToTab('keydown', 'ArrowLeft', 37, 'ArrowLeft')
// Arrow Right: sendKeyToTab('keydown', 'ArrowRight', 39, 'ArrowRight')


// hooks/useFlightHubKeyboard.ts
import { useEffect, useRef } from 'react';
import { createLogger } from '@/utils/logger';


const log = createLogger('SidePanelView');


// The messenger function
const sendKeyToTab = async (type: 'keydown' | 'keyup', keyName: string, keyCode: number, codeString: string) => {
  try {
    log.info("sending:", keyName, type)
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
    // Ignore errors when not on FlightHub
  }
};

export function useFlightHubKeyboard(sticks: any, buttons: any, isConnected: boolean) {
  // --- Refs to track current key states ---
  const keys = useRef({
    c: false, z: false, // Throttle
    q: false, e: false, // Yaw
    w: false, s: false, // Pitch
    a: false, d: false,  // Roll
    up: false, down: false,
    left: false, right: false,
  });

  // --- LEFT STICK: Throttle (C/Z) & Yaw (Q/E) ---
  useEffect(() => {
    if (!isConnected) return;
    const threshold = 0.5; // Adjust this sensitivity if needed

    // Throttle Up (C)
    if (sticks.throttle > threshold && !keys.current.c) {
      sendKeyToTab('keydown', 'c', 67, 'KeyC'); keys.current.c = true;
    } else if (sticks.throttle <= threshold && keys.current.c) {
      sendKeyToTab('keyup', 'c', 67, 'KeyC'); keys.current.c = false;
    }

    // Throttle Down (Z)
    if (sticks.throttle < -threshold && !keys.current.z) {
      sendKeyToTab('keydown', 'z', 90, 'KeyZ'); keys.current.z = true;
    } else if (sticks.throttle >= -threshold && keys.current.z) {
      sendKeyToTab('keyup', 'z', 90, 'KeyZ'); keys.current.z = false;
    }

    // Yaw Left (Q)
    if (sticks.yaw < -threshold && !keys.current.q) {
      sendKeyToTab('keydown', 'q', 81, 'KeyQ'); keys.current.q = true;
    } else if (sticks.yaw >= -threshold && keys.current.q) {
      sendKeyToTab('keyup', 'q', 81, 'KeyQ'); keys.current.q = false;
    }

    // Yaw Right (E)
    if (sticks.yaw > threshold && !keys.current.e) {
      sendKeyToTab('keydown', 'e', 69, 'KeyE'); keys.current.e = true;
    } else if (sticks.yaw <= threshold && keys.current.e) {
      sendKeyToTab('keyup', 'e', 69, 'KeyE'); keys.current.e = false;
    }
  }, [sticks.throttle, sticks.yaw, isConnected]);

  // --- RIGHT STICK: Pitch (W/S) & Roll (A/D) ---
  useEffect(() => {
    if (!isConnected) return;
    const threshold = 0.5;

    // Pitch Up/Forward (W)
    if (sticks.pitch > threshold && !keys.current.w) {
      sendKeyToTab('keydown', 'w', 87, 'KeyW'); keys.current.w = true;
    } else if (sticks.pitch <= threshold && keys.current.w) {
      sendKeyToTab('keyup', 'w', 87, 'KeyW'); keys.current.w = false;
    }

    // Pitch Down/Backward (S)
    if (sticks.pitch < -threshold && !keys.current.s) {
      sendKeyToTab('keydown', 's', 83, 'KeyS'); keys.current.s = true;
    } else if (sticks.pitch >= -threshold && keys.current.s) {
      sendKeyToTab('keyup', 's', 83, 'KeyS'); keys.current.s = false;
    }

    // Roll Left (A)
    if (sticks.roll < -threshold && !keys.current.a) {
      sendKeyToTab('keydown', 'a', 65, 'KeyA'); keys.current.a = true;
    } else if (sticks.roll >= -threshold && keys.current.a) {
      sendKeyToTab('keyup', 'a', 65, 'KeyA'); keys.current.a = false;
    }

    // Roll Right (D)
    if (sticks.roll > threshold && !keys.current.d) {
      sendKeyToTab('keydown', 'd', 68, 'KeyD'); keys.current.d = true;
    } else if (sticks.roll <= threshold && keys.current.d) {
      sendKeyToTab('keyup', 'd', 68, 'KeyD'); keys.current.d = false;
    }
  }, [sticks.pitch, sticks.roll, isConnected]);



  useEffect(() => {
    if (!isConnected) return;
    const threshold = 0.5;

    // Left Wheel Up (ArrowUp)
    if (sticks.wheel_l > threshold && !keys.current.up) {
      sendKeyToTab('keydown', 'ArrowUp', 38, 'ArrowUp'); keys.current.up = true;
    } else if (sticks.wheel_l <= threshold && keys.current.up) {
      sendKeyToTab('keyup', 'ArrowUp', 38, 'ArrowUp'); keys.current.up = false;
    }

    // Left Wheel Down (ArrowDown)
    if (sticks.wheel_l < -threshold && !keys.current.down) {
      sendKeyToTab('keydown', 'ArrowDown', 40, 'ArrowDown'); keys.current.down = true;
    } else if (sticks.wheel_l >= -threshold && keys.current.down) {
      sendKeyToTab('keyup', 'ArrowDown', 40, 'ArrowDown'); keys.current.down = false;
    }

    // Right Wheel Left (ArrowLeft)
    if (sticks.wheel_r < -threshold && !keys.current.left) {
      sendKeyToTab('keydown', 'ArrowLeft', 37, 'ArrowLeft'); keys.current.left = true;
    } else if (sticks.wheel_r >= -threshold && keys.current.left) {
      sendKeyToTab('keyup', 'ArrowLeft', 37, 'ArrowLeft'); keys.current.left = false;
    }

    // Right Wheel Right (ArrowRight)
    if (sticks.wheel_r > threshold && !keys.current.right) {
      sendKeyToTab('keydown', 'ArrowRight', 39, 'ArrowRight'); keys.current.right = true;
    } else if (sticks.wheel_r <= threshold && keys.current.right) {
      sendKeyToTab('keyup', 'ArrowRight', 39, 'ArrowRight'); keys.current.right = false;
    }
  }, [sticks.wheel_l, sticks.wheel_r, isConnected]);
}