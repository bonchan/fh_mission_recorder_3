import React, { useState } from 'react';
import { MissionItem } from './MissionItem';
import { Mission, ViewContext } from '@/utils/interfaces';

interface MissionItemListProps {
  missions: Mission[],
  isLoading: boolean
  viewContext?: ViewContext;
  onUpdate: (updatedMission: Mission) => void;
}

export function MissionList({ missions, isLoading, viewContext, onUpdate }: MissionItemListProps) {
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);

  if (isLoading) return <p>Loading missions...</p>;

  if (missions.length === 0) return <p>No missions created yet.</p>;

  return (
    <div className="mission-list">
      {missions.map(mission => {
        const isCurrentlyExpanded = expandedMissionId === mission.id;
        return (
          <MissionItem
            key={mission.id}
            mission={mission}
            viewContext={viewContext}
            isExpanded={isCurrentlyExpanded}
            onToggleExpand={() => setExpandedMissionId(isCurrentlyExpanded ? null : mission.id)}
            onUpdate={onUpdate}
          />
        )
      }

      )}
    </div>
  );
}