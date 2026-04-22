import React from 'react';
import Button from '@/components/ui/Button'; // Assuming your custom Button path
import VisualStick from './VisualStick';
import VisualButton from './VisualButton';
import { useDJIController } from '@/hooks/useDJIController';
import { useFlightHubKeyboard } from '@/hooks/useFlightHubKeyboard';

interface VisualControllerProps {
  isLoading: boolean
  viewContext?: ViewContext;
}

export default function VisualController({ isLoading, viewContext }: VisualControllerProps) {
  // 1. Pull the live hardware data from your custom hook
  const { isConnected, connect, disconnect, sticks, touch, buttons } = useDJIController();

  // 2. Run the keyboard dispatcher in the background
  useFlightHubKeyboard(sticks, buttons, isConnected);

  // 3. Render the UI safely using a React Fragment <> to wrap the ternary statement
  return (
    <>
      {!isConnected ? (
        <Button onClick={connect} variant="success" isLoading={isLoading}>
          Connect USB RC
        </Button>
      ) : (
        <div>
          {/* Main Sticks */}
          <div className="flex-row-2" style={{ marginBottom: '16px' }}>
            <VisualStick x={sticks.yaw} y={sticks.throttle} label="Yaw / Throttle" />
            <VisualStick x={sticks.roll} y={sticks.pitch} label="Roll / Pitch" />
          </div>

          {/* Scroll Wheels */}
          <div className="flex-row-2">
            <VisualStick x={sticks.wheel_l} label="Left Wheel" mode="horizontal" />
            <VisualStick x={sticks.wheel_r} label="Right Wheel" mode="horizontal" />
          </div>

          {/* Touch Input */}
          <div className="section">
            <p className="section-title">Touch Input</p>
            <div style={{ color: touch.active ? '#4ade80' : '#6b7280', fontSize: '0.875rem' }}>
              {touch.active ? `X: ${touch.x.toFixed(2)} Y: ${touch.y.toFixed(2)}` : 'IDLE'}
            </div>
          </div>

          {/* Buttons & Switches */}
          <div className="section" style={{ marginTop: '24px' }}>
            <p className="section-title">Buttons & Switches</p>
            
            <div className="hw-btn-row">
              <VisualButton label="BACK" active={buttons.back} />
              <VisualButton label="Video" active={buttons.tl} />
              <VisualButton label="Photo" active={buttons.tr} />
              <VisualButton label="POWER" active={buttons.power} />
            </div>
            
            <div className="hw-btn-row">
              <VisualButton label="L1" active={buttons.f1} />
              <VisualButton label="L2" active={buttons.f2} />
              <VisualButton label="L3" active={buttons.f3} />
              <VisualButton label="R4" active={buttons.f4} />
              <VisualButton label="R5" active={buttons.f5} />
              <VisualButton label="R6" active={buttons.f6} />
            </div>
          </div>
          
          <br />
          
          <Button onClick={disconnect} variant="danger">
            Disconnect
          </Button>
        </div>
      )}
    </>
  );
}