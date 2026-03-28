import React from 'react';
import { Waypoint } from '@/utils/interfaces';
import { getRelativeOffset } from '@/utils/geo'; // Import our new WGS84 math!

interface WaypointOffsetProps {
  originWp: Waypoint;
  currentWp: Waypoint;
  isOrigin?: boolean;
  showOffset?: boolean;
  onClick: () => void;
}

export function WaypointOffset({ originWp, currentWp, isOrigin, showOffset, onClick }: WaypointOffsetProps) {
  if (!showOffset) return null;

  // 1. Get the highly accurate relative X (Right) and Y (Forward) offsets!
  const { x, y } = getRelativeOffset(
    originWp.latitude,
    originWp.longitude,
    originWp.yaw,
    currentWp.latitude,
    currentWp.longitude
  );

  // 2. Calculate Z (Up/Down)
  const z = (currentWp.elevation || 0) - (originWp.elevation || 0);

  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        fontSize: '11px',
        color: 'black',
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: `${isOrigin ? '#ffcccc' : '#e0f7fa'}`, // slightly softer colors
        padding: '6px',
        borderRadius: '4px',
        margin: '8px 0', // updated to fit nicer in your list
        border: isOrigin ? '1px solid #ff0000' : '1px solid #00bcd4'
      }}>
      {isOrigin ? (
        <span>📍 Relative Origin (Yaw: {originWp.yaw.toFixed(2)}°)</span>
      ) : (
        <span>X: {x.toFixed(2)}m | Y: {y.toFixed(2)}m | Z: {z.toFixed(2)}m</span>
      )}
    </div>
  );
}