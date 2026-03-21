import React from 'react';
import { Map } from '@/components/map/Map';
import styles from './DashboardView.module.css';
import { LiveWaypointData } from '@/utils/interfaces';

export function DashboardView() {


  const livedroneData = {
    latitude: -38.348942412,
    longitude: -68.637840983,
    altitude: 100,
    heading: 15,
    gimbalPitch: -40
  };

  const sampleWaypoints: LiveWaypointData[] = [
  {
    // 1. South-West corner, looking North-East
    latitude: -38.349800,
    longitude: -68.638800,
    altitude: 20,
    heading: 45,
    gimbalPitch: -30
  },
  {
    // 2. North-West corner, looking East
    latitude: -38.348000,
    longitude: -68.638800,
    altitude: 100,
    heading: 80,
    gimbalPitch: -45
  },
  {
    // 3. North-East corner, looking South
    latitude: -38.348000,
    longitude: -68.636800,
    altitude: 120,
    heading: 120,
    gimbalPitch: -60
  },
  {
    // 4. South-East corner, looking West
    latitude: -38.349800,
    longitude: -68.636800,
    altitude: 100,
    heading: 270,
    gimbalPitch: -40
  },
  {
    // 5. Center approach, looking straight down at the target
    latitude: -38.348942,
    longitude: -68.637841,
    altitude: 180,
    heading: 30,
    gimbalPitch: -80 
  }
];

  return (
    <div className={styles.dashboardContainer}>
      {/* The isolated Map component */}




      <Map initialCenter={[-68.637840983, -38.348942412]} liveDroneData={livedroneData} waypoints={sampleWaypoints} />

      {/* Overlay UI elements */}
      <div className={styles.statusOverlay}>
        <div className={styles.missionTitle}>MISSION ACTIVE</div>
        <div className={styles.missionSubtitle}>SNIFFING DJI WEBSOCKETS...</div>
      </div>
    </div>
  );
}