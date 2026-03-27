import React from 'react';
import { WaypointItem } from './WaypointItem';
import { Waypoint, ViewContext } from '@/utils/interfaces';
import Button from '@/components/ui/Button'

interface WaypointListProps {
  waypoints: Waypoint[];
  viewContext?: ViewContext;
  onCreate: ((waypoint: Waypoint, index?: number) => void) | undefined;
  onUpdate: ((id: string, updates: Partial<Waypoint>) => void) | undefined;
  onDelete: ((id: string) => void) | undefined;
}

export function WaypointList({ waypoints, viewContext, onCreate, onUpdate, onDelete }: WaypointListProps) {

  if (!waypoints || waypoints.length === 0) return <p style={{ fontSize: '12px', color: '#888' }}>No waypoints added yet.</p>;

  return (
    <div className="waypoint-list"
      style={{
        flex: 1,                 // 1. Tells the list to stretch and fill all remaining space at the bottom of the column
        overflowY: 'auto',       // 2. Turns on the vertical scrollbar when the waypoints overflow
        minHeight: 0,            // 3. CRITICAL: Stops the list from stretching infinitely down the page!
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingRight: '8px'      // Adds a tiny bit of padding so the scrollbar doesn't cover your text
      }}
    >
      {viewContext == ViewContext.DASHBOARD && waypoints.length > 0 &&
        <Button onClick={() => { if (onCreate) onCreate(waypoints[0], 0) }} variant='danger' style={{ padding: '5px 10px' }}>Add security point</Button>
      }
      {waypoints.map((wp, index) => (
        <>
          <WaypointItem
            key={wp.id}
            waypoint={wp}
            index={index}
            viewContext={viewContext}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
          {viewContext == ViewContext.DASHBOARD &&
            <Button onClick={() => { if (onCreate) onCreate(wp, index + 1) }} variant='danger' style={{ padding: '5px 10px' }}>Add security point</Button>
          }
        </>
      ))}
    </div>
  );
}