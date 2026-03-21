import React from 'react';
import { Map } from '@/components/map/Map';
import styles from './DashboardView.module.css';

export function DashboardView() {


  const livedroneData = {
    latitude: -38.348942412,
    longitude: -68.637840983,
    altitude: 100,
    heading: 15,
    gimbalPitch: -40
  };


  return (
    <div className={styles.dashboardContainer}>
      {/* The isolated Map component */}




      <Map initialCenter={[-68.637840983, -38.348942412]} liveDroneData={livedroneData} />

      {/* Overlay UI elements */}
      <div className={styles.statusOverlay}>
        <div className={styles.missionTitle}>MISSION ACTIVE</div>
        <div className={styles.missionSubtitle}>SNIFFING DJI WEBSOCKETS...</div>
      </div>
    </div>
  );
}