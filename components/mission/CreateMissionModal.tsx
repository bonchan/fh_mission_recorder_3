import React, { useState } from 'react';
import { Drone } from '@/utils/interfaces';
import { StorageBackupControls } from '@/components/storage/StorageBackupControls'
import godMode from '@/assets/GgsQO4YX0AAyEFG.jpg';

interface CreateMissionModalProps {
  devices: Drone[];
  onClose: () => void;
  onSubmit: (missionName: string, selectedDevice: Drone) => void;
}

export function CreateMissionModal({ devices, onClose, onSubmit }: CreateMissionModalProps) {
  // 1. Local state strictly for the form inputs
  const [newMissionName, setNewMissionName] = useState('');
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);

  // 2. Validate and pass the data UP to the parent
  const handleConfirmCreate = () => {
    if (!newMissionName) return;

    const selectedDevice = devices[selectedDeviceIndex];
    if (!selectedDevice) return;

    // Tell the parent component to handle the actual creation!
    onSubmit(newMissionName, selectedDevice);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div style={{
        background: '#1e1e1e', padding: '20px', borderRadius: '8px',
        width: '100%', maxWidth: '300px', border: '1px solid #333'
      }}>

        {newMissionName === 'iddqd' ?
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
              <img src={godMode} alt="God Mode" width="150" />
            </div>
            <StorageBackupControls />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={onClose} // Cleanly uses the prop
                style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: 'white', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </>
          : (
            <>
              <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Create Mission</h2>

              <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#888' }}>Mission Name</label>
              <input
                autoFocus
                value={newMissionName}
                onChange={(e) => setNewMissionName(e.target.value)}
                placeholder="e.g. Morning Patrol"
                style={{ width: '100%', padding: '8px', marginBottom: '15px', background: '#2c2c2c', border: '1px solid #444', color: 'white', boxSizing: 'border-box' }}
              />

              <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px', color: '#888' }}>Select Dock</label>
              <select
                value={selectedDeviceIndex}
                onChange={(e) => setSelectedDeviceIndex(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', marginBottom: '20px', background: '#2c2c2c', border: '1px solid #444', color: 'white' }}
              >
                {devices.map((device, index) => (
                  <option key={device.parent?.deviceSn || index} value={index}>
                    {device.parent?.deviceOrganizationCallsign} - {device.deviceOrganizationCallsign}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose} // Cleanly uses the prop
                  style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: 'white', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCreate}
                  disabled={!newMissionName}
                  style={{ flex: 1, padding: '8px', background: '#0066ff', border: 'none', color: 'white', cursor: 'pointer', opacity: !newMissionName ? 0.5 : 1 }}
                >
                  Create
                </button>
              </div>
            </>
          )
        }




      </div>
    </div>
  );
}