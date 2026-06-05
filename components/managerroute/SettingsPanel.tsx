import React, { useState } from 'react';
import { createLogger } from '@/utils/logger';
import { RouteSettings } from './ManagerRoute';

const log = createLogger('SettingsPanel');

interface SettingsPanelProps {
  settings: RouteSettings;
  onSettingsChanged: (settings: RouteSettings) => void;
  debugMode?: boolean;
}

export function SettingsPanel({
  settings,
  onSettingsChanged,
  debugMode,
}: SettingsPanelProps) {
  const [maxDistanceKm, setMaxDistanceKm] = useState(settings.maxDistanceKm);
  const [maxPoints, setMaxPoints] = useState(settings.maxPoints);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const newSettings: RouteSettings = {
      maxDistanceKm: Math.max(1, maxDistanceKm),
      maxPoints: Math.max(1, maxPoints),
    };
    onSettingsChanged(newSettings);
    setSaved(true);
    log.info('Settings saved:', newSettings);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setMaxDistanceKm(settings.maxDistanceKm);
    setMaxPoints(settings.maxPoints);
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Route Settings</h2>
        <p className="settings-subtitle">Configure route constraints and limits</p>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Route Limits</h3>

          <div className="settings-item">
            <div className="settings-label-group">
              <label htmlFor="max-distance">Maximum Route Distance</label>
              <p className="settings-hint">
                Routes longer than this will be flagged as exceeding the limit
              </p>
            </div>
            <div className="settings-input-group">
              <input
                id="max-distance"
                type="number"
                min="1"
                step="0.5"
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(parseFloat(e.target.value) || 1)}
              />
              <span className="settings-unit">km</span>
            </div>
            <div className="settings-preview">
              Current limit: <strong>{settings.maxDistanceKm} km</strong>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-label-group">
              <label htmlFor="max-points">Maximum Points per Route</label>
              <p className="settings-hint">
                Routes with more points than this limit will show a warning
              </p>
            </div>
            <div className="settings-input-group">
              <input
                id="max-points"
                type="number"
                min="1"
                max="1000"
                value={maxPoints}
                onChange={(e) => setMaxPoints(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <span className="settings-unit">points</span>
            </div>
            <div className="settings-preview">
              Current limit: <strong>{settings.maxPoints} points</strong>
            </div>
          </div>
        </div>

        <div className="settings-info">
          <h4>📋 What these limits do:</h4>
          <ul>
            <li>
              <strong>Maximum Distance:</strong> If your route exceeds {maxDistanceKm} km,
              you'll get a warning during export
            </li>
            <li>
              <strong>Maximum Points:</strong> If your route has more than {maxPoints} waypoints,
              you'll be notified in the Points tab
            </li>
            <li>These limits help optimize routes for drone battery efficiency</li>
            <li>You can override warnings when exporting if needed</li>
          </ul>
        </div>

        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave}>
            {saved ? '✓ Saved!' : '💾 Save Settings'}
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            ↻ Reset to Current
          </button>
        </div>

        {debugMode && (
          <div className="debug-info">
            <p>Current Settings:</p>
            <p>
              maxDistanceKm: {settings.maxDistanceKm}, maxPoints: {settings.maxPoints}
            </p>
            <p>Pending: maxDistanceKm: {maxDistanceKm}, maxPoints: {maxPoints}</p>
          </div>
        )}
      </div>
    </div>
  );
}
