import React from 'react';

// --- HELPER COMPONENT ---
// Keeps our layout clean and consistent
const DataField = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div style={{ marginBottom: '8px' }}>
    <span style={{ color: '#888', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ color: '#ccc', fontSize: '13px', fontWeight: 500 }}>{value !== undefined && value !== '' ? value : '--'}</span>
  </div>
);

// --- DRONE (HOST) COMPONENT ---
export function HostRowItem({ host }: { host: any }) {
  if (!host) return <div style={{ color: '#666', fontSize: '12px' }}>No Drone Data</div>;

  const state = host.device_state || {};
  const battery = state.battery || {};
  const position = state.position_state || {};

  return (
    <div style={{ backgroundColor: '#000', padding: '20px', borderRadius: '6px', border: '1px solid #333' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#00bcd4', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
        🚁 Drone Details (Host)
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
        {/* Hardware & System */}
        <div>
          <DataField label="Serial Number" value={host.device_sn} />
          <DataField label="Firmware" value={state.firmware_version} />
          <DataField label="Flight Mode" value={state.mode_code} />
        </div>

        {/* Battery & Power */}
        <div>
          <DataField label="Battery Level" value={battery.capacity_percent ? `${battery.capacity_percent}%` : '--'} />
          <DataField label="RTH Power Needed" value={battery.return_home_power ? `${battery.return_home_power}%` : '--'} />
          <DataField label="Total Sorties" value={state.total_flight_sorties} />
        </div>

        {/* Telemetry & Position */}
        <div>
          <DataField label="Current Height" value={state.height ? `${state.height.toFixed(1)}m` : '--'} />
          <DataField label="Home Distance" value={state.home_distance ? `${state.home_distance.toFixed(1)}m` : '--'} />
          <DataField label="GPS Quality" value={`${position.gps_number || 0} Sats (Fix: ${position.is_fixed || 0})`} />
        </div>

        {/* Limits & Storage */}
        <div>
          <DataField label="Max Height" value={state.height_limit ? `${state.height_limit}m` : '--'} />
          <DataField label="RTH Altitude" value={state.rth_altitude ? `${state.rth_altitude}m` : '--'} />
          <DataField label="Storage Used" value={state.storage ? `${Math.round(state.storage.used / 1024)} GB` : '--'} />
        </div>
      </div>
    </div>
  );
}

// --- DOCK (PARENT) COMPONENT ---
export function ParentRowItem({ parent }: { parent: any }) {
  if (!parent) return <div style={{ color: '#666', fontSize: '12px' }}>No Dock Data</div>;

  const state = parent.device_state || {};
  
  return (
    <div style={{ backgroundColor: '#000', padding: '20px', borderRadius: '6px', border: '1px solid #333' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#ff9800', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
        🔋 Dock Details (Parent)
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
        {/* Hardware & System */}
        <div>
          <DataField label="Serial Number" value={parent.device_sn} />
          <DataField label="Firmware" value={state.firmware_version} />
          <DataField label="Dock Cover" value={state.cover_state === 0 ? 'Closed' : 'Open'} />
        </div>

        {/* Environment (Super important for docks!) */}
        <div>
          <DataField label="External Temp" value={state.environment_temperature ? `${state.environment_temperature}°C` : '--'} />
          <DataField label="Internal Temp" value={state.temperature ? `${state.temperature}°C` : '--'} />
          <DataField label="Humidity" value={state.humidity ? `${state.humidity}%` : '--'} />
        </div>

        {/* Weather & RTK */}
        <div>
          <DataField label="Wind Speed" value={state.wind_speed ? `${state.wind_speed} m/s` : '--'} />
          <DataField label="Rainfall" value={state.rainfall === 0 ? 'None' : `${state.rainfall} mm`} />
          <DataField label="RTK State" value={state.position_state?.is_fixed === 2 ? 'Fixed' : 'Floating/Lost'} />
        </div>

        {/* Power & Charging */}
        <div>
          <DataField label="Drone Charge" value={state.drone_charge_state?.capacity_percent ? `${state.drone_charge_state.capacity_percent}%` : '--'} />
          <DataField label="Backup Battery" value={state.backup_battery?.voltage ? `${(state.backup_battery.voltage / 1000).toFixed(1)}v` : '--'} />
          <DataField label="AC Config" value={state.air_conditioner?.air_conditioner_state === 1 ? 'Active' : 'Idle'} />
        </div>
      </div>
    </div>
  );
}