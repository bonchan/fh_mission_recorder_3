import React, { useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import { Still, ViewContext, Waypoint } from "@/utils/interfaces";
import styles from './WaypointItem.module.css';
import { WaypointTags } from './WaypointTags';
import { createLogger } from '@/utils/logger';


interface WaypointItemProps {
  waypoint: Waypoint;
  index: number;
  still?: Still;
  viewContext?: ViewContext;
  onUpdate: ((id: string, updates: Partial<Waypoint>) => void) | undefined;
  onDelete: ((id: string) => void) | undefined;
  children?: React.ReactNode;
}
const log = createLogger('WaypointItem');

export function WaypointItem({ waypoint, index, still, viewContext, onUpdate, onDelete, children }: WaypointItemProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdate = () => {
    if (onUpdate === undefined) return;
    onUpdate(waypoint.id, waypoint);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsImageExpanded((prev) => !prev);
  };

  const handleContainerClick = () => {
    if (isImageExpanded) setIsImageExpanded(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Map the type to an icon for the header!
  const getIcon = () => {
    switch (waypoint.type) {
      case 'picture': return '📸';
      case 'security': return '🚨';
      case 'hover': return '🚁';
      default: return '📍';
    }
  };

  // Determine the dynamic background class based on the type
  // Fallback to 'type_default' if waypoint.type is undefined
  const typeClass = styles[`type_${waypoint.type || 'default'}`];

  return (
    <div className={`${styles.container} ${typeClass}`} onClick={handleContainerClick}>

      {/* 1. THE HEADER ROW */}
      <div className={styles.itemHeader}>
        <div className={styles.headerTitle}>
          <span>{getIcon()}</span> WP {index + 1}
        </div>

        {onDelete && (
          <Button
            variant="sad"
            requireConfirm={true}
            confirmText="CONFIRM"
            confirmVariant="danger"
            className={styles.deleteBtn}
            onClick={() => onDelete(waypoint.id)}
          >
            DELETE
          </Button>
        )}
      </div>

      {still?.dataUrl && (
        <img
          src={still.dataUrl}
          className={`${styles.thumbnail} ${isImageExpanded ? styles.expanded : ''}`}
          onClick={handleImageClick}
        />
      )}

      {/* 2. TELEMETRY GRID */}
      <div className={styles.dataGrid}>
        <div><span className={styles.telemetryLabel}>Lon:</span> {waypoint.longitude?.toFixed(6)}</div>
        <div><span className={styles.telemetryLabel}>Lat:</span> {waypoint.latitude?.toFixed(6)}</div>
        <div><span className={styles.telemetryLabel}>Elev:</span> {waypoint.elevation.toFixed(2)}m</div>
        <div><span className={styles.telemetryLabel}>Height:</span> {waypoint.height.toFixed(2)}m</div>
        <div><span className={styles.telemetryLabel}>Yaw:</span> {waypoint.yaw.toFixed(2)}°</div>
        <div><span className={styles.telemetryLabel}>Pitch:</span> {waypoint.pitch.toFixed(2)}°</div>
        <div><span className={styles.telemetryLabel}>Zoom:</span> {waypoint.zoom}x</div>
        <div><span className={styles.telemetryLabel}>Hover Time:</span> {waypoint.hoverTime || 0}s</div>
      </div>

      {children}

    </div>
  );
}