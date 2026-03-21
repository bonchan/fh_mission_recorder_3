import React from 'react';
import { Map } from '@/components/map/Map';
import styles from './DashboardView.module.css';

export function DashboardView() {
  return (
    <div className={styles.dashboardContainer}>
      {/* The isolated Map component */}
      <Map initialCenter={[-68.637840983, -38.348942412]} />

      {/* Overlay UI elements */}
      <div className={styles.statusOverlay}>
        <div className={styles.missionTitle}>MISSION ACTIVE</div>
        <div className={styles.missionSubtitle}>SNIFFING DJI WEBSOCKETS...</div>
      </div>
    </div>
  );
}