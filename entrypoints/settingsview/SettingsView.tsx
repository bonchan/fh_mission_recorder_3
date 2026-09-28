import VisualController from '@/components/controller/VisualController';
import { StorageBackupControls } from '@/components/storage/StorageBackupControls';
import Button from '@/components/ui/Button';
import { useDatabase } from '@/hooks/useDatabase';
import { useMessage } from '@/hooks/useMessage';
import pkg from '@/package.json';
import { useToast } from '@/providers/ToastProvider';
import { createLogger } from '@/utils/logger';
import React, { useState } from 'react';

const log = createLogger('SettingsView');


export function SettingsView() {
  // 1. Extract URL Parameters
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
  const initialDebugMode = params.get('debugMode') === 'true';

  const [debugMode, setDebugMode] = useState(initialDebugMode);
  const { settings, updateSettings } = useDatabase(orgId, projectId)
  const { showToast } = useToast()
  const { openPage } = useMessage(orgId, projectId)


  const handleBufferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > 200) {
      showToast('Oops', 'Circle buffer limited to 100m', { type: 'warning' })
      val = Math.min(200, val);
    }
    if (val < 50) {
      showToast('Oops', 'Circle buffer should be more than 50m', { type: 'warning' })
      val = Math.max(50, val);
    }
    updateSettings({ circleBuffer: val });
  };

  const handleSafeSecurityHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > 120) {
      showToast('Oops', 'Safe Security Height limited to 120m', { type: 'warning' })
      val = Math.min(120, val);
    }
    if (val < 70) {
      showToast('Oops', 'Safe Security Height should be more than 70m', { type: 'warning' })
      val = Math.max(70, val);
    }
    updateSettings({ safeSecurityHeight: val });
  };

  const handleMaxPointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > 50) {
      showToast('Oops', 'Max Points limited to 50', { type: 'warning' })
      val = Math.min(50, val);
    }
    if (val < 1) {
      showToast('Oops', 'Max Points should be more than 0', { type: 'warning' })
      val = Math.max(1, val);
    }
    updateSettings({ maxPoints: val });
  };

  const handleMaxDistanceKmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > 20) {
      showToast('Oops', 'Max Distance Km limited to 20', { type: 'warning' })
      val = Math.min(20, val);
    }
    if (val < 1) {
      showToast('Oops', 'Max Distance Km should be more than 0', { type: 'warning' })
      val = Math.max(1, val);
    }
    updateSettings({ maxDistanceKm: val });
  };

  const handleClusterRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > 500) {
      showToast('Oops', 'Cluster radius limited to 500 m', { type: 'warning' })
      val = Math.min(500, val);
    }
    if (val < 1) {
      showToast('Oops', 'Cluster radius should be more than 0', { type: 'warning' })
      val = Math.max(1, val);
    }
    updateSettings({ clusterRadiusMeters: val });
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#212529', borderBottom: '2px solid #dee2e6', paddingBottom: '10px' }}>
        ⚙️ Workspace Settings
      </h2>
      <Button onClick={() => { openPage('OPEN_ADMIN_DASHBOARD', undefined, sourceTabId) }} variant="warning" isLoading={false} style={{ width: '100%' }}>
        Admin Dashboard
      </Button>
      <span>{pkg.name} {pkg.version}</span>

      <br />
      <br />

      {/* --- Section 1: Database Management --- */}
      <section style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Database Management</h3>
        <p style={helpTextStyle}>
          Backup your entire IndexedDB workspace to a local JSON file, or restore a previous session.
        </p>
        <div style={{ marginTop: '15px' }}>
          <StorageBackupControls orgId={orgId} projectId={projectId} />
        </div>
      </section>

      {/* --- Section 2: Map Preferences --- */}
      <section style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Planning Preferences</h3>
        <div style={formRowStyle}>
          <label style={labelStyle}>Max Points</label>
          <input
            type="number"
            value={settings.maxPoints}
            onChange={handleMaxPointsChange}
            style={inputStyle}
          />
        </div>
        <div style={formRowStyle}>
          <label style={labelStyle}>Max Distance (km)</label>
          <input
            type="number"
            value={settings.maxDistanceKm}
            onChange={handleMaxDistanceKmChange}
            style={inputStyle}
          />
        </div>
        <div style={formRowStyle}>
          <label style={labelStyle}>Cluster Radius (meters)</label>
          <input
            type="number"
            value={settings.clusterRadiusMeters}
            onChange={handleClusterRadiusChange}
            style={inputStyle}
          />
        </div>
        <div style={formRowStyle}>
          <label style={labelStyle} title="Comma-separated. Points whose name starts with one of these still get flown, but don't shift the cluster centroid.">
            Centroid-excluded Prefixes
          </label>
          <input
            type="text"
            value={settings.centroidExcludedPrefixes}
            onChange={(e) => updateSettings({ centroidExcludedPrefixes: e.target.value })}
            placeholder="KIT"
            style={inputStyle}
          />
        </div>
      </section>

      {/* --- Section 2: Map Preferences --- */}
      <section style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Map Preferences</h3>
        <div style={formRowStyle}>
          <label style={labelStyle}>Compromised Zone Buffer (meters)</label>
          <input
            type="number"
            value={settings.circleBuffer}
            onChange={handleBufferChange}
            style={inputStyle}
          />
        </div>
        <div style={formRowStyle}>
          <label style={labelStyle}>Security Points Safe Height (meters)</label>
          <input
            type="number"
            value={settings.safeSecurityHeight}
            onChange={handleSafeSecurityHeightChange}
            style={inputStyle}
          />
        </div>
      </section>

      {/* --- Section 3: Developer Options --- */}
      {/* <section style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Developer Options</h3>
        <div style={formRowStyle}>
          <label style={{ ...labelStyle, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Enable Debug Logging
          </label>
        </div>
        <div style={formRowStyle}>
          <span style={helpTextStyle}>Current Project: {projectId || 'None'}</span>
        </div>
      </section> */}

      {/* --- Section 3: Developer Options --- */}
      <section style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>RC</h3>
        <div style={formRowStyle}>
          <VisualController
            rcType={settings.selectedRemote}
            setRcType={updateSettings}
            isLoading={false}
            size="normal"
            layout='real'
            showTouch={true}
            showWheels={true}
            showButtons={true}
          />
        </div>

      </section>

    </div>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  padding: '20px 30px',
  maxWidth: '800px',
  margin: '0 auto',
  fontFamily: 'sans-serif',
  color: '#343a40'
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#f8f9fa',
  padding: '20px',
  borderRadius: '8px',
  marginBottom: '20px',
  border: '1px solid #e9ecef'
};

const sectionHeaderStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: '10px',
  fontSize: '16px',
  color: '#495057'
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6c757d',
  margin: 0
};

const formRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginTop: '15px',
  marginBottom: '5px'
};

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  marginRight: '15px',
  minWidth: '220px'
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '4px',
  border: '1px solid #ced4da',
  fontSize: '13px',
  width: '100px'
};