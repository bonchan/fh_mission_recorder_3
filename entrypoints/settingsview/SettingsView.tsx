import VisualController from '@/components/controller/VisualController';
import { StorageBackupControls } from '@/components/storage/StorageBackupControls';
import { useDatabase } from '@/hooks/useDatabase';
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

  const handleBufferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > 100) {
      showToast('Oops', 'Circle buffer limited to 100m', { type: 'warning' })
      val = Math.min(100, val);
    }
    if (val < 1) {
      showToast('Oops', 'Circle buffer should be more than 0m', { type: 'warning' })
      val = Math.max(1, val);
    }
    updateSettings({ circleBuffer: val });
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#212529', borderBottom: '2px solid #dee2e6', paddingBottom: '10px' }}>
        ⚙️ Workspace Settings
      </h2>

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
        <h3 style={sectionHeaderStyle}>Map Preferences</h3>
        <div style={formRowStyle}>
          <label style={labelStyle}>Compromised Zone Buffer (meters)</label>
          <input
            type="number"
            value={settings?.circleBuffer}
            onChange={handleBufferChange}
            style={inputStyle}
          />
        </div>
        <p style={helpTextStyle}>
          This defines the size of the danger zone around a compromised point on the dashboard map.
        </p>
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
            rcType={settings?.selectedRemote}
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