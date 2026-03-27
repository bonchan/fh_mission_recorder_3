import React from 'react';
import { Waypoint } from '@/utils/interfaces';

interface WaypointOffsetProps {
  originWp: Waypoint;
  currentWp: Waypoint;
  isOrigin?: boolean;
  showOffset?: boolean;
  onClick: () => void
}

export function WaypointOffset({ originWp, currentWp, isOrigin, showOffset, onClick }: WaypointOffsetProps) {
  // If we shouldn't show it, render absolutely nothing!
  if (!showOffset) return null;

  const METERS_PER_DEGREE = 111320;

  // dy = North/South offset
  const dy = (currentWp.latitude - originWp.latitude) * METERS_PER_DEGREE;

  // dx = East/West offset (requires cosine of latitude to adjust for earth's curve)
  const dx = (currentWp.longitude - originWp.longitude) * METERS_PER_DEGREE * Math.cos(originWp.latitude * (Math.PI / 180));

  // dz = Altitude offset (fallback to 0 if elevation is undefined)
  const dz = (currentWp.elevation || 0) - (originWp.elevation || 0);

  // If this IS the origin waypoint, maybe you want to show "Origin" instead of 0s? 
  // Uncomment the next 3 lines if you prefer that!
  // if (originWp.id === currentWp.id) {
  //   return <div style={{ fontSize: '11px', color: '#a0aec0', textAlign: 'center' }}>★ Origin Point</div>;
  // }

  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        fontSize: '11px',
        color: 'black',
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: `${isOrigin ? 'red' : 'lightcyan'}`,
        padding: '4px',
        borderRadius: '4px',
        margin: '8px'
      }}>
      Offset from WP1 ➔ X: {dx.toFixed(1)}m | Y: {dy.toFixed(1)}m | Z: {dz.toFixed(1)}m
    </div>
  );
}