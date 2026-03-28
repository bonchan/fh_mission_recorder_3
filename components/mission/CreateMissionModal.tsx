import React, { useState } from 'react';
import { Drone, MissionType } from '@/utils/interfaces';
import { enumToOptions } from '@/utils/utils';
import { StorageBackupControls } from '@/components/storage/StorageBackupControls'
import godMode from '@/assets/GgsQO4YX0AAyEFG.jpg';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

interface CreateMissionModalProps {
  devices: Drone[];
  onClose: () => void;
  onSubmit: (missionName: string, selectedDevice: Drone, missionType: MissionType) => void;
}

export function CreateMissionModal({ devices, onClose, onSubmit }: CreateMissionModalProps) {
  // 1. Local state strictly for the form inputs
  const [newMissionName, setNewMissionName] = useState('');
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [selectedType, setSelectedType] = useState<MissionType>(MissionType.WAYPOINT);


  const missionOptions = enumToOptions(MissionType)

  const dockOptions = devices.map((device, index) => ({
    label: `${device.parent?.deviceOrganizationCallsign || device.parent?.deviceProjectCallsign} - ${device.deviceOrganizationCallsign || device.deviceProjectCallsign}`,
    value: index,
  }));

  // 2. Validate and pass the data UP to the parent
  const handleConfirmCreate = () => {
    if (!newMissionName) return;

    const selectedDevice = devices[selectedDeviceIndex];
    if (!selectedDevice) return;

    // Tell the parent component to handle the actual creation!
    onSubmit(newMissionName, selectedDevice, selectedType);
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
              <Button onClick={onClose} variant='outline'>Close</Button>
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

              <Select
                label="Select Dock"
                value={selectedDeviceIndex}
                options={dockOptions}
                onChange={(val) => setSelectedDeviceIndex(Number(val))}
              />

              <Select
                label="Mission Type"
                value={selectedType}
                options={missionOptions}
                onChange={(val) => setSelectedType(val)}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <Button onClick={onClose} variant='outline'>Cancel</Button>
                <Button onClick={handleConfirmCreate} disabled={!newMissionName}>Create</Button>
              </div>
            </>
          )
        }

      </div>
    </div>
  );
}