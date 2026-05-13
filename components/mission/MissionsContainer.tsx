
import React, { useState } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { CreateMissionModal } from './CreateMissionModal';
import { MissionList } from './MissionList';
import { Mission, MissionType, ViewContext, Drone, Annotation } from '@/utils/interfaces';
import Button from '@/components/ui/Button';

const log = createLogger('MissionsContainer');

export function MissionsContainer({ orgId, projectId, devices, annotations, isFetching, viewContext }:
  { orgId: string; projectId: string; devices: Drone[]; annotations: Annotation[]; isFetching: boolean; viewContext: ViewContext }) {
  const { projectMissions, createMission } = useDatabase(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMissionSubmit = async (missionName: string, selectedDevice: Drone, missionType: MissionType) => {
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
    await createMission(newMission)

    setIsModalOpen(false);
  };

  const allMissions = Object.values(projectMissions)
    .flat()
    .sort((a, b) => b.createdDate - a.createdDate);

  return (

    <div>

      <Button onClick={() => setIsModalOpen(true)} variant={'primary'} isLoading={isFetching}>New Mission</Button>

      <MissionList
        missions={allMissions}
        annotations={annotations}
        isLoading={false} // FIXME
        viewContext={viewContext}
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
