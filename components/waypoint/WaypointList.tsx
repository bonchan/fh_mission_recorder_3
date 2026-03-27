import React from 'react';
import { WaypointItem } from './WaypointItem';
import { Waypoint, ViewContext } from '@/utils/interfaces';
import Button from '@/components/ui/Button'

interface WaypointListProps {
  waypoints: Waypoint[];
  viewContext?: ViewContext;
  isEditing?: boolean;
  onCreate: ((waypoint: Waypoint, index?: number) => void) | undefined;
  onUpdate: ((id: string, updates: Partial<Waypoint>) => void) | undefined;
  onDelete: ((id: string) => void) | undefined;
}

export function WaypointList({ waypoints, viewContext, isEditing, onCreate, onUpdate, onDelete }: WaypointListProps) {

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
      {!isEditing && waypoints.map((wp, index) => {

        // 1. SECURITY POINTS (Render naked)
        return (
          <WaypointItem
            key={wp.id}
            waypoint={wp}
            index={index}
            viewContext={viewContext}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        );

      })}

      {isEditing && waypoints.map((wp, index) => {

        // 1. SECURITY POINTS (Render naked)
        if (wp.type === 'security') {
          return (
            <WaypointItem
              key={wp.id}
              waypoint={wp}
              index={index}
              viewContext={viewContext}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          );
        }

        // 2. NORMAL POINTS
        const prevWp = index > 0 ? waypoints[index - 1] : null;
        const nextWp = index < waypoints.length - 1 ? waypoints[index + 1] : null;

        // RULE 1: Draw BEFORE if the previous point is NOT a security point that shares MY coordinates.
        const hasMyBeforeSec = prevWp?.type === 'security' &&
          prevWp.latitude === wp.latitude &&
          prevWp.longitude === wp.longitude;
        const drawBefore = !hasMyBeforeSec;

        // RULE 2: Draw AFTER if the next point is NOT a security point that shares MY coordinates.
        const hasMyAfterSec = nextWp?.type === 'security' &&
          nextWp.latitude === wp.latitude &&
          nextWp.longitude === wp.longitude;
        const drawAfter = !hasMyAfterSec;

        return (
          <React.Fragment key={wp.id}>

            {/* BUTTON BEFORE */}
            {viewContext === ViewContext.DASHBOARD && drawBefore && (
              <Button
                onClick={() => { if (onCreate) onCreate(wp, index) }}
                variant='danger'
                style={{ padding: '5px 10px', alignSelf: 'center', marginBottom: '8px' }}
              >
                Add security before
              </Button>
            )}

            {/* THE WAYPOINT */}
            <WaypointItem
              waypoint={wp}
              index={index}
              viewContext={viewContext}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />

            {/* BUTTON AFTER */}
            {viewContext === ViewContext.DASHBOARD && drawAfter && (
              <Button
                onClick={() => { if (onCreate) onCreate(wp, index + 1) }}
                variant='danger'
                style={{ padding: '5px 10px', alignSelf: 'center', marginBottom: '8px' }}
              >
                Add security after
              </Button>
            )}

          </React.Fragment>
        );
      })}

    </div>
  );
}