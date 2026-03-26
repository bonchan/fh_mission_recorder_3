import React, { useState } from 'react';
import { MissionItem } from './MissionItem';
import { Mission, Annotation, ViewContext } from '@/utils/interfaces';
import * as turf from '@turf/turf';

interface MissionItemListProps {
  missions: Mission[],
  annotations: Annotation[],
  isLoading: boolean
  viewContext?: ViewContext;
  onUpdate: (updatedMission: Mission) => void;
}

export function MissionList({ missions, annotations, isLoading, viewContext, onUpdate }: MissionItemListProps) {
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);

  if (isLoading) return <p>Loading missions...</p>;

  if (missions.length === 0) return <p>No missions created yet.</p>;

  return (
    <div className="mission-list">
      {missions.map(mission => {
        const isCurrentlyExpanded = expandedMissionId === mission.id;

        let nearbyAnnotations: Annotation[] = [];
        if (isCurrentlyExpanded) {
          const baseLat = mission.device?.parent?.latitude;
          const baseLon = mission.device?.parent?.longitude;
          if (baseLat !== undefined && baseLon !== undefined) {
            // Create the center point once for this mission using Turf [lon, lat]
            const centerPoint = turf.point([baseLon, baseLat]);
            nearbyAnnotations = annotations.filter(ann => {
              if (ann.latitude === undefined || ann.longitude === undefined) return false;
              // Create the target point [lon, lat]
              const targetPoint = turf.point([ann.longitude, ann.latitude]);
              // Turf handles the heavy lifting!
              const distance = turf.distance(centerPoint, targetPoint, { units: 'kilometers' });
              return distance <= 8;
            });
          }
        }

        return (
          <MissionItem
            key={mission.id}
            mission={mission}
            annotations={nearbyAnnotations}
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