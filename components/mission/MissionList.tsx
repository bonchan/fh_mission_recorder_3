import React from 'react';
import { MissionItem } from './MissionItem';
import { Mission } from '@/utils/interfaces';



interface MissionItemListProps {
  missions: Mission[], 
  isLoading: boolean
  onUpdate: (updatedMission: Mission) => void;
}


export function MissionList({ missions, isLoading, onUpdate }: MissionItemListProps) {
  if (isLoading) return <p>Loading missions...</p>;

  if (missions.length === 0) return <p>No missions created yet.</p>;

  return (
    <div className="mission-list">
      {missions.map(mission => (
        <MissionItem key={mission.id} mission={mission} onUpdate={onUpdate} />
      ))}
    </div>
  );
}