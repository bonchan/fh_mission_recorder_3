// useDJIController.ts
import { ControllerDriver, ControllerModel } from '@/components/controller/ControllerDriver';
import { AdbControllerDriver } from '@/drivers/AdbControllerDriver';
import { HidControllerDriver } from '@/drivers/HidControllerDriver';
import { createLogger } from '@/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';


const INITIAL_STICKS = { throttle: 0, yaw: 0, pitch: 0, roll: 0, wheel_l: 0, wheel_r: 0 };
const INITIAL_TOUCH = { x: 0, y: 0, active: false };
const INITIAL_BUTTONS = {
  back: false, tr: false, tl: false,
  f1: false, f2: false, f3: false,
  f4: false, f5: false, f6: false,
  power: false,
  hat_up: false, hat_down: false, 
  hat_left: false, hat_right: false, 
  hat_push: false
};

const log = createLogger('useDJIController');

export function useDJIController() {
  const [isConnected, setIsConnected] = useState(false);
  const [sticks, setSticks] = useState(INITIAL_STICKS);
  const [touch, setTouch] = useState(INITIAL_TOUCH);
  const [buttons, setButtons] = useState(INITIAL_BUTTONS);

  const driverRef = useRef<ControllerDriver | null>(null);

  const disconnect = useCallback(async () => {
    if (driverRef.current) {
      await driverRef.current.disconnect();
      driverRef.current = null;
    }

    setIsConnected(false);

    setSticks(INITIAL_STICKS);
    setTouch(INITIAL_TOUCH);
    setButtons(INITIAL_BUTTONS);
  }, []);

  // Clean up if the hook unmounts
  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  const connect = async (rcType: ControllerModel) => {
    try {
      if (driverRef.current) {
        await driverRef.current.disconnect();
      }

      let driver: ControllerDriver;
      switch (rcType) {
        case ControllerModel.RCP2:
          driver = new AdbControllerDriver(ControllerModel.RCP2);
          break;
        case ControllerModel.SCE:
          driver = new AdbControllerDriver(ControllerModel.SCE);
          break;
        case ControllerModel.RC3:
        default:
          driver = new HidControllerDriver();
          break;
      }

      driverRef.current = driver;

      await driver.connect({
        onUpdate: (update) => {
          if (update.sticks) setSticks(prev => ({ ...prev, ...update.sticks }));
          if (update.touch) setTouch(prev => ({ ...prev, ...update.touch }));
          if (update.buttons) setButtons(prev => ({ ...prev, ...update.buttons }));
        },
        onDisconnect: () => {
          log.info("Driver reported physical hardware disconnect.");
          driverRef.current = null;
          setIsConnected(false);
          setSticks(INITIAL_STICKS);
          setTouch(INITIAL_TOUCH);
          setButtons(INITIAL_BUTTONS);
        }
      });

      setIsConnected(true);
    } catch (err) {
      log.error("Failed to connect via Driver:", err);
      setIsConnected(false);
    }
  };

  return {
    isConnected,
    connect,
    disconnect,
    sticks,
    touch,
    buttons
  };
}