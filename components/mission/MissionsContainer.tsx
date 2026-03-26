
import React, { useState } from 'react';
import { useLiveMissions } from '@/hooks/useLiveMissions';
import { CreateMissionModal } from './CreateMissionModal';
import { MissionList } from './MissionList';
import { Mission, MissionType, ViewContext, Drone, Annotation } from '@/utils/interfaces';
import Button from '@/components/ui/Button';

export function MissionsContainer({ orgId, projectId, devices, annotations, isFetching, viewContext }: 
  { orgId: string; projectId: string; devices: Drone[]; annotations: Annotation[]; isFetching: boolean; viewContext: ViewContext }) {
  const { missions, isLoadingMissions, saveMissions } = useLiveMissions(orgId, projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // This is where your old `handleConfirmCreate` logic lives now!
  const handleMissionSubmit = async (missionName: string, selectedDevice: Drone, missionType: MissionType) => {
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
      missionType: missionType,
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

      <Button onClick={() => setIsModalOpen(true)} variant={'primary'} isLoading={isFetching}>New Mission</Button>


      <MissionList
        missions={allMissions}
        annotations={annotations}
        isLoading={isLoadingMissions}
        viewContext={viewContext}
        onUpdate={handleUpdateMission}
      />

      <br />
      <br />
      <br />
      <br />
      <br />

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
