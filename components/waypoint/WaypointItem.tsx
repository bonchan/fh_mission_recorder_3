import React, { useState, useEffect, useRef } from 'react';
import { Waypoint, ViewContext } from '@/utils/interfaces';
import Button from '@/components/ui/Button';

interface WaypointItemProps {
  waypoint: Waypoint;
  index: number;
  viewContext?: ViewContext;
  onUpdate: (id: string, updates: Partial<Waypoint>) => void;
  onDelete: ((id: string) => void) | undefined;
}

export function WaypointItem({ waypoint, index, viewContext, onUpdate, onDelete }: WaypointItemProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 2-STEP DELETE LOGIC ---
  const handleDelete = () => {
    if (onDelete === undefined) return
    if (!isConfirming) {
      // First click: arm the button
      setIsConfirming(true);
      // Automatically disarm after 2 seconds if they don't click again
      timerRef.current = setTimeout(() => {
        setIsConfirming(false);
      }, 2000);
    } else {
      // Second click: actually delete
      if (timerRef.current) clearTimeout(timerRef.current);
      onDelete(waypoint.id);
    }
  };

  const handleUpdate = () => {
    if (onDelete === undefined) return
    // TODO
    onUpdate(waypoint.id, waypoint);
  };

  // Cleanup the timer if the component unmounts while confirming
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div style={{
      background: '#252525',
      padding: '12px',
      borderRadius: '4px',
      marginBottom: '10px',
      border: '1px solid #333',
      fontSize: '11px'
    }}>
      {/* STATIC DATA GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 12px',
        color: '#aaa',
        marginBottom: '10px'
      }}>
        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>
          WP {index}
        </div>


        <div style={{ textAlign: 'right' }}>
          {onDelete &&
            <Button
              onClick={handleDelete}
              variant={isConfirming ? 'danger' : 'sad'}
              style={{
                padding: '2px 8px',
                display: 'inline',
                fontSize: '10px',
                maxWidth: '80px',
                transition: 'background 0.2s ease',
              }}
            >
              {isConfirming ? 'CONFIRM?' : 'DELETE'}
            </Button>
          }
        </div>

        {/* Telemetry Data */}
        <div><span style={{ color: '#666' }}>Lon:</span> {waypoint.longitude?.toFixed(6)}</div>
        <div><span style={{ color: '#666' }}>Lat:</span> {waypoint.latitude?.toFixed(6)}</div>
        <div><span style={{ color: '#666' }}>Elev:</span> {waypoint.elevation}m</div>
        <div><span style={{ color: '#666' }}>Height:</span> {waypoint.height}m</div>
        <div><span style={{ color: '#666' }}>Yaw:</span> {waypoint.yaw}°</div>
        <div><span style={{ color: '#666' }}>Pitch:</span> {waypoint.pitch}°</div>
        <div><span style={{ color: '#666' }}>Zoom:</span> {waypoint.zoom}x</div>
        <div><span style={{ color: '#666' }}>Hover Time:</span> {waypoint.hoverTime}s</div>
      </div>

    </div>
  );
}