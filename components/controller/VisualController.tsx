import React, { useState } from 'react';
import './VisualController.css';
import Button from '@/components/ui/Button'; // Assuming your custom Button path
import VisualStick from './VisualStick';
import VisualButton from './VisualButton';
import { useDJIController } from '@/hooks/useDJIController';
import { useFlightHubKeyboard } from '@/hooks/useFlightHubKeyboard';

// Adjust these imports based on where you put your driver classes
import { ControllerModel } from '@/components/controller/ControllerDriver';
import { AdbControllerDriver } from '@/drivers/AdbControllerDriver';
import { HidControllerDriver } from '@/drivers/HidControllerDriver';

// Mocking ViewContext if you have it imported elsewhere
type ViewContext = any;

interface VisualControllerProps {
  isLoading: boolean;
  viewContext?: ViewContext;
  size?: 'normal' | 'compact';
  layout?: 'normal' | 'real';
  showSticks?: boolean;
  showWheels?: boolean;
  showTouch?: boolean;
  showButtons?: boolean;
}

export default function VisualController({
  isLoading,
  viewContext,
  size = 'normal',
  layout = 'normal', // Default to normal
  showSticks = true,
  showWheels = true,
  showTouch = true,
  showButtons = true
}: VisualControllerProps) {

  const [isExpanded, setIsExpanded] = useState(false);
  const [rcType, setRcType] = useState<ControllerModel>(ControllerModel.RCP2);
  const { isConnected, connect, disconnect, sticks, touch, buttons } = useDJIController();

  useFlightHubKeyboard(sticks, buttons, isConnected);

  const touchX = touch.active ? touch.x : 0;
  const touchY = touch.active ? touch.y : 0;

  const handleConnect = () => {
    let driver;
    switch (rcType) {
      case ControllerModel.RCP2:
        driver = new AdbControllerDriver();
        break;
      case ControllerModel.RC3:
      default:
        driver = new HidControllerDriver();
        break;
    }
    connect(driver);
  };

  return (
    <>
      {!isConnected ? (
        <div className={`visual-controller-wrapper ${size === 'compact' ? 'compact-mode' : ''}`}>

          {/* Connection Bar */}
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <Button onClick={handleConnect} variant="success" isLoading={isLoading} style={{ flexGrow: 1 }}>
              Connect {rcType}
            </Button>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="sad"
              style={{
                width: size === 'compact' ? '32px' : '40px',
                padding: '0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              title={isExpanded ? "Hide Settings" : "Controller Settings"}
            >
              {isExpanded ? '▲' : '▼'}
            </Button>
          </div>

          {/* Expanded Settings Section for Disconnected State */}
          {isExpanded && (
            <div style={{ marginBottom: '16px' }}>
              <p className="section-title">Controller Setup</p>
              <select
                value={rcType}
                onChange={(e) => setRcType(e.target.value as ControllerModel)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#1f2937', // Adjust to match your theme
                  color: 'white',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  outline: 'none'
                }}
              >
                <option value={ControllerModel.RCP2}>{ControllerModel.RCP2}</option>
                <option value={ControllerModel.RC3}>{ControllerModel.RC3}</option>
              </select>
            </div>
          )}

        </div>
      ) : (
        <div className={`visual-controller-wrapper ${size === 'compact' ? 'compact-mode' : ''}`}>

          {isExpanded && (
            <div style={{ marginBottom: '16px' }}>

              {/* ==========================================
              LAYOUT: NORMAL (Stacked Rows)
              ========================================== */}
              {layout === 'normal' && (
                <div>
                  {/* Main Sticks */}
                  {showSticks && (
                    <div className="flex-row-2" style={{ marginBottom: '16px' }}>
                      <VisualStick x={sticks.yaw} y={sticks.throttle} label="Yaw / Throttle" />
                      <VisualStick x={sticks.roll} y={sticks.pitch} label="Roll / Pitch" />
                    </div>
                  )}

                  {/* Scroll Wheels */}
                  {showWheels && (
                    <div className="flex-row-2">
                      <VisualStick x={sticks.wheel_l} label="Camera Tilt" mode="horizontal" />
                      <VisualStick x={sticks.wheel_r} label="Slow Yaw" mode="horizontal" />
                    </div>
                  )}

                  {/* Touch Input */}
                  {showTouch && (
                    <div className="section">
                      <p className="section-title">Touch Input</p>
                      <div style={{ color: touch.active ? '#4ade80' : '#6b7280', fontSize: '0.875rem' }}>
                        {touch.active ? `X: ${touch.x.toFixed(2)} Y: ${touch.y.toFixed(2)}` : 'IDLE'}
                      </div>
                    </div>
                  )}

                  {/* Buttons & Switches */}
                  {showButtons && (
                    <div className="section" style={{ marginTop: '24px' }}>
                      <p className="section-title">Buttons & Switches</p>
                      <div className="hw-btn-row">
                        <VisualButton label="PAUSE" active={buttons.back} />
                        <VisualButton label="Video" active={buttons.tl} />
                        <VisualButton label="Photo" active={buttons.tr} />
                        <VisualButton label="POWER" active={buttons.power} />
                      </div>
                      <div className="hw-btn-row">
                        <VisualButton label="Wide" active={buttons.f1} />
                        <VisualButton label="Zoom" active={buttons.f2} />
                        <VisualButton label="IR" active={buttons.f3} />
                        <VisualButton label="Annotation" active={buttons.f4} />
                        <VisualButton label="Zoom +" active={buttons.f5} />
                        <VisualButton label="Zoom -" active={buttons.f6} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==========================================
              LAYOUT: REAL (Physical RC layout)
              ========================================== */}
              {layout === 'real' && (
                <div className="layout-real-grid">

                  {/* --- COLUMN 1: LEFT SIDE --- */}
                  <div className="real-col">
                    {showSticks && <VisualStick x={sticks.yaw} y={sticks.throttle} label="" />}
                    {showWheels && <VisualStick x={sticks.wheel_l} label="Camera Tilt" mode="horizontal" />}
                    {showButtons && (
                      <div className="real-col-split">
                        <div className="real-split-item btn-stack">
                          <VisualButton label="Video" active={buttons.tl} />
                          <VisualButton label="BACK" active={buttons.back} />
                        </div>
                        <div className="real-split-item btn-stack">
                          <VisualButton label="Wide" active={buttons.f1} />
                          <VisualButton label="Zoom" active={buttons.f2} />
                          <VisualButton label="IR" active={buttons.f3} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* --- COLUMN 2: CENTER (Touch/Screen) --- */}
                  <div className="real-col center-col">
                    {showTouch && (
                      <div className="touch-display-wrapper">
                        <p className="section-title text-center" style={{ textAlign: 'center' }}>Screen</p>
                        {/* The shrunk visual stick to represent the screen */}
                        <div className="shrunk-stick">
                          <VisualStick x={touchY} y={touchX} label="" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* --- COLUMN 3: RIGHT SIDE --- */}
                  <div className="real-col">
                    {/* Note: I included the Right Stick here so you can actually fly! */}
                    {showSticks && <VisualStick x={sticks.roll} y={sticks.pitch} label="" />}
                    {showWheels && <VisualStick x={sticks.wheel_r} label="Slow Yaw" mode="horizontal" />}

                    {showButtons && (
                      <div className="real-col-split">
                        <div className="real-split-item btn-stack">
                          <VisualButton label="Annotation" active={buttons.f4} />
                          <VisualButton label="Zoom +" active={buttons.f5} />
                          <VisualButton label="Zoom -" active={buttons.f6} />
                        </div>
                        <div className="real-split-item btn-stack">
                          <VisualButton label="Photo" active={buttons.tr} />
                          <VisualButton label="POWER" active={buttons.power} />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <Button onClick={disconnect} variant="danger" style={{ flexGrow: 1 }}>
              Disconnect
            </Button>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="sad"
              style={{
                width: size === 'compact' ? '32px' : '40px',
                padding: '0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              title={isExpanded ? "Collapse Controller" : "Expand Controller"}
            >
              {isExpanded ? '▲' : '▼'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}