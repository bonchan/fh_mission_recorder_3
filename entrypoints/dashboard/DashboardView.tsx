import React, { useState, useEffect } from 'react';
import { Map } from '@/components/map/Map';
import styles from './DashboardView.module.css';
import { LiveDroneData, LiveWaypointData, Annotation } from '@/utils/interfaces';
import { useDjiSimulator } from '@/components/simulator/useDjiSimulator';

export function DashboardView() {
  const params = new URLSearchParams(window.location.search);
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');

  const [isDebuggerActive, setIsDebuggerActive] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(sourceTabId);
  const [isTelemetryLost, setIsTelemetryLost] = useState(false);
  const lastHeartbeatRef = useRef<number>(0);

  const [livedroneData, setLivedroneData] = useState<LiveDroneData>({
    timestamp: 0,
    sn: '',
    latitude: 0,
    longitude: 0,
    altitude: 0,
    heading: 0,
    gimbalPitch: 0
  });

  const { data: simData, isConnected, connect, disconnect } = useDjiSimulator();
  // const activeData = isConnected ? simData : backgroundTelemetry;

  useEffect(() => {
    if (simData && simData.sn == '') {
      console.log("Received sim telemetry update:", simData);
      lastHeartbeatRef.current = simData.timestamp;
      setLivedroneData(simData);
    }
  }, [simData]);

  // 2. Listen for data coming from the Background Debugger
  useEffect(() => {
    const listener = (message: any) => {
      // Listen for the telemetry processed by the background script
      if (message.action === 'LIVE_TELEMETRY_UPDATE') {

        if (message.liveDroneData.sn == '') {
          console.log("Received live telemetry update:", message);
          lastHeartbeatRef.current = message.liveDroneData.timestamp;
          setLivedroneData(message.liveDroneData);
        }

      }

      // Sync UI if debugger is detached (e.g. user clicks "Cancel" on the gray bar)
      if (message.action === 'DEBUGGER_DETACHED') {
        setIsDebuggerActive(false);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);


  }, []);

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (!isDebuggerActive || lastHeartbeatRef.current === 0) {
        setIsTelemetryLost(false);
        return;
      }

      const now = Date.now();
      const delta = now - lastHeartbeatRef.current;

      // If no data for more than 4 seconds (double our check rate), mark as lost
      if (delta > 4000) {
        setIsTelemetryLost(true);
      } else {
        setIsTelemetryLost(false);
      }
    }, 2000);

    return () => clearInterval(watchdog);
  }, [isDebuggerActive]);

  const toggleDebugger = async () => {
    if (!currentTabId) return;

    const nextState = !isDebuggerActive;

    // We send the message to the BACKGROUND, not the content script
    await browser.runtime.sendMessage({
      action: nextState ? 'ENABLE_WS_DEBUG' : 'DISABLE_WS_DEBUG',
      tabId: currentTabId
    });

    setIsDebuggerActive(nextState);
  };

  return (
    <div className={styles.dashboardContainer}>
      <Map
        initialCenter={[-68.637840983, -38.348942412]}
        liveDroneData={livedroneData}
        waypoints={sampleWaypoints} // (Keep your sample data here)
        annotations={sampleAnnotations}
      />

      <div className={styles.statusOverlay}>
        <div className={styles.tabInfo}>
          {currentTabId ? `Connected to Tab: ${currentTabId}` : 'Finding DJI Tab...'}
        </div>

        <button
          onClick={toggleDebugger}
          className={`${styles.simButton} ${isDebuggerActive ? styles.active : ''}`}
        >
          {isDebuggerActive ? '🔴 DISCONNECT DEBUGGER' : '🔌 ATTACH TO FLIGHTHUB'}
        </button>
<div/>
        <button
          onClick={isConnected ? disconnect : connect}
          className={`${styles.simButton}`}
        >
          {isConnected ? "🛑 Stop Local Sim" : "🟢 Start Local Sim"}
        </button>


        <pre className={styles.debugInfo}>
          {JSON.stringify(livedroneData, null, 2)}
        </pre>

        {isTelemetryLost && (
          <div className={styles.telemetryError}>
            🚨 DRONE TELEMETRY LOST! <br />
            <small>Last seen: {new Date(livedroneData.timestamp).toLocaleTimeString()}</small>
          </div>
        )}



      </div>
    </div>
  );
}

// ... Keep your sampleWaypoints and sampleAnnotations constants below

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


const sampleAnnotations: Annotation[] = [
  {
    id: 'anno-1',
    name: 'Launch / Landing Pad',
    latitude: -38.349200,
    longitude: -68.638200,
    color: '#00ff00' // Green
  },
  {
    id: 'anno-2',
    name: 'Radio Tower (Obstacle)',
    latitude: -38.348500,
    longitude: -68.637200,
    color: '#ff0000' // Red
  },
  {
    id: 'anno-3',
    name: 'Inspection Target',
    latitude: -38.349500,
    longitude: -68.636800,
    color: '#0088ff' // Blue
  },
  {
    id: 'anno-4',
    name: 'Safe Zone / Rally Point',
    latitude: -38.348200,
    longitude: -68.638500,
    color: '#ffaa00' // Orange/Yellow
  }
];
