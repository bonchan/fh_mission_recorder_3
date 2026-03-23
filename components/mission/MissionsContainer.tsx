
import React, { useState } from 'react';
import { useLiveMissions } from '@/hooks/useLiveMissions';
import { CreateMissionModal } from './CreateMissionModal';
import { MissionList } from './MissionList';
import { Mission, ViewContext } from '@/utils/interfaces';

export function MissionsContainer({ orgId, projectId, devices, isFetching, viewContext }: { orgId: string; projectId: string; devices: Drone[]; isFetching: boolean; viewContext: ViewContext }) {
  const { missions, isLoadingMissions, saveMissions } = useLiveMissions(orgId, projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // This is where your old `handleConfirmCreate` logic lives now!
  const handleMissionSubmit = async (missionName: string, selectedDevice: any) => {
    const dockSn = selectedDevice?.parent?.deviceSn;
    if (!dockSn) return;

    // 1. Build the object
    const newMission: Mission = {
      id: crypto.randomUUID(),
      name: missionName,
      orgId: orgId,
      projectId: projectId,
      device: selectedDevice,
      createdDate: Date.now(),
      updatedDate: Date.now(),
      waypoints: []
    };

    // 2. Save it using the hook
    const currentDockMissions = missions[dockSn] || [];
    await saveMissions(dockSn, [newMission, ...currentDockMissions]);

    // 3. Close the modal
    setIsModalOpen(false);
  };

  const handleUpdateMission = async (updatedMission: Mission) => {
    const dockSn = updatedMission.device?.parent?.deviceSn;
    if (!dockSn) return;

    // 1. Get the current list for this specific dock
    const currentDockMissions = missions[dockSn] || [];

    // 2. Map over the list and replace the one that matches the ID
    const updatedList = currentDockMissions.map(m =>
      m.id === updatedMission.id ? updatedMission : m
    );

    // 3. Save it to storage using your hook!
    await saveMissions(dockSn, updatedList);
  };


  const allMissions = Object.values(missions)
    .flat()
    .sort((a, b) => b.createdDate - a.createdDate);

  return (

    <div>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={isFetching}
        style={{
          width: '100%', padding: '10px', background: '#0066ff', color: 'white',
          border: 'none', borderRadius: '4px', cursor: isFetching ? 'not-allowed' : 'pointer',
          marginBottom: '20px', fontWeight: 'bold'
        }}
      >
        {isFetching ? 'Wait...' : 'New Mission'}
      </button>

      <MissionList
        missions={allMissions}
        isLoading={isLoadingMissions}
        viewContext={viewContext}
        onUpdate={handleUpdateMission}
      />

      {isModalOpen && (
        <CreateMissionModal
          devices={devices}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleMissionSubmit} // Pass the handler down!
        />
      )}
    </div>
  );
}
