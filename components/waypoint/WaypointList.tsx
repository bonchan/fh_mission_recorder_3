import React from 'react';
import { WaypointItem } from './WaypointItem';
import { Waypoint, ViewContext } from '@/utils/interfaces';

interface WaypointListProps {
  waypoints: Waypoint[];
  viewContext?: ViewContext;
  onUpdate: (id: string, updates: Partial<Waypoint>) => void;
  onDelete: (id: string) => void;
}

export function WaypointList({ waypoints, viewContext, onUpdate, onDelete }: WaypointListProps) {

  if (!waypoints || waypoints.length === 0) return <p style={{ fontSize: '12px', color: '#888' }}>No waypoints added yet.</p>;

  return (
    <div className="waypoint-list">
      {waypoints.map((wp, index) => (
        <WaypointItem
          key={wp.id}
          waypoint={wp}
          index={index + 1}
          viewContext={viewContext}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}