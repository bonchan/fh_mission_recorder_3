import React, { useState, useEffect, useRef } from 'react';
import { Map } from '@/components/map/Map';
import styles from './DashboardView.module.css';
import { LiveDroneData, LiveWaypointData, Annotation } from '@/utils/interfaces';
import { useDjiSimulator } from '@/hooks/useDjiSimulator';
import { useLiveMissions } from '@/hooks/useLiveMissions';
import { useExtensionData } from '@/providers/ExtensionDataProvider';

import { generateDJIMission, generateDJIMissionFiles } from '@/utils/wpml-generator';
import { XMLDebugModal } from '@/components/debug/XMLDebugModal';
import { uploadToCloudStorage } from '@/services/cloudStorage';

import { useToast } from '@/providers/ToastProvider'

export function DashboardView() {
  // 1. Get IDs from the URL (You must pass these when opening the dashboard!)
  const params = new URLSearchParams(window.location.search);
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const missionId = params.get('missionId') || '';
  const showStatusOverlay = params.get('statusOverlay') === 'true';

  // --- DATA HOOKS ---
  const { missions } = useLiveMissions(orgId, projectId);
  const { getAnnotations, getStorageUploadCredentials, duplicateNameStorageCheck, importCallbackStorage } = useExtensionData();

  const [liveAnnotations, setLiveAnnotations] = useState<Annotation[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(missionId);

  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);

  // Flatten missions
  const allMissions = Object.values(missions || {}).flat();
  const selectedMission = allMissions.find(m => m.id === selectedMissionId);

  // --- TELEMETRY STATE ---
  const [isDebuggerActive, setIsDebuggerActive] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(sourceTabId);
  const [isTelemetryLost, setIsTelemetryLost] = useState(false);
  const lastHeartbeatRef = useRef<number>(0);
  const activeMissionSnRef = useRef<string | null>(null);

  const [livedroneData, setLivedroneData] = useState<LiveDroneData>({
    timestamp: 0, sn: '', latitude: 0, longitude: 0, altitude: 0,
    heading: 0, gimbalPitch: 0, cameraMode: 0, zoomFactor: 0, trigger: false
  });

  const { data: simData, isConnected, connect, disconnect } = useDjiSimulator();
  const [debugXml, setDebugXml] = useState<{ template: string, waylines: string } | null>(null);

  const { showToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);


  // --- FETCH ANNOTATIONS ON MOUNT ---
  useEffect(() => {
    if (orgId && projectId) {
      getAnnotations(orgId, projectId)
        .then(setLiveAnnotations)
        .catch(err => console.error("Failed to load annotations", err));
    }
  }, [orgId, projectId, currentTabId]);

  // --- TELEMETRY LISTENERS ---
  useEffect(() => {
    if (simData && simData.sn == selectedMission?.device.deviceSn) {
      lastHeartbeatRef.current = simData.timestamp;
      console.log('simData', simData)
      setLivedroneData(simData);
    }
  }, [simData]);

  useEffect(() => {
    activeMissionSnRef.current = selectedMission?.device?.deviceSn || null;
  }, [selectedMission]);

  useEffect(() => {
    const listener = (message: any) => {
      if (message.action === 'LIVE_TELEMETRY_UPDATE') {
        if (message.liveDroneData.sn == activeMissionSnRef.current) {
          lastHeartbeatRef.current = message.liveDroneData.timestamp;
          setLivedroneData(message.liveDroneData);

        }
      }
      if (message.action === 'DEBUGGER_DETACHED') setIsDebuggerActive(false);
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
      const delta = Date.now() - lastHeartbeatRef.current;
      setIsTelemetryLost(delta > 4000);
    }, 2000);
    return () => clearInterval(watchdog);
  }, [isDebuggerActive]);

  // --- AUTO-CENTER MAP ON MISSION SELECTION ---
  useEffect(() => {
    if (!selectedMission) return;

    console.log('selectedMission', selectedMission)

    const waypoints = selectedMission.waypoints || [];

    if (waypoints.length > 0) {
      // 1. Mission has waypoints: Grab the very last one
      const lastWp = waypoints[waypoints.length - 1];
      console.log('lastWp', lastWp)

      if (lastWp.longitude && lastWp.latitude) {
        setMapCenter([lastWp.longitude, lastWp.latitude]);
      }
    } else {
      // 2. No waypoints: Fallback to the Dock's (parent) coordinates
      const dock = selectedMission.device?.parent;
      console.log('dock', dock)

      if (dock?.longitude && dock?.latitude) {
        setMapCenter([dock.longitude, dock.latitude]);
      }
    }
  }, [selectedMission]);

  const toggleDebugger = async () => {
    if (!currentTabId) return;
    const nextState = !isDebuggerActive;
    await browser.runtime.sendMessage({
      action: nextState ? 'ENABLE_WS_DEBUG' : 'DISABLE_WS_DEBUG',
      tabId: currentTabId
    });
    setIsDebuggerActive(nextState);
  };

  const handleDebugMission = async (mission: Mission) => {
    const { template, waylines } = await generateDJIMissionFiles(mission)
    setDebugXml({ template, waylines });
  }

  const handleExportMission = async (mission: Mission) => {
    const blob = await generateDJIMission(mission);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const cleanName = mission.name.replace(/[<>:"/|?*._\\]/g, '');
    a.download = `P3--${cleanName}.kmz`;
    a.click();
    window.URL.revokeObjectURL(url);
  }


  // FIXME this needs lots of love
  const handleUploadMission = async (mission: Mission) => {
    if (!orgId || !projectId) return;

    try {
      // 1. Get the STS Credentials
      setIsUploading(true)
      const stsResponse = await getStorageUploadCredentials(orgId, projectId); // Assuming this is where it lives
      // console.log('stsResponse', stsResponse)
      const { endpoint, bucket, object_key_prefix, credentials, provider } = stsResponse.credentials.data;

      // 2. Generate the Mission Blob
      const blob = await generateDJIMission(mission);
      const cleanName = mission.name.replace(/[<>:"/|?*._\\]/g, '');
      let fileNameKmz = `P3--${cleanName}.kmz`;

      // const nscResponse1 = await duplicateNameStorageCheck(orgId, projectId, fileNameKmz)
      // fileNameKmz = nscResponse1.dnResponse.data.index_name

      // Convert Blob to File object for easier uploading
      const file = new File([blob], fileNameKmz, { type: 'application/zip' });

      // 3. Construct the exact path where the file will live in the bucket
      // const fileUUID = crypto.randomUUID();
      // const objectKey = `${object_key_prefix}/${fileUUID}.kmz`;

      const objectKey = `${object_key_prefix}/${fileNameKmz}`;

      // 4. Upload the file to AliCloud / AWS (See helper function below)
      // console.log(`Uploading ${fileNameKmz} to ${provider} as ${objectKey}...`);
      const csResponse = await uploadToCloudStorage(file, objectKey, stsResponse.credentials.data);
      // console.log('csResponse', csResponse)

      const nscResponse = await duplicateNameStorageCheck(orgId, projectId, fileNameKmz)
      // console.log('nscResponse', nscResponse)

      const fileName = nscResponse.dnResponse.data.index_name

      // console.log('fileName', fileName)
      const icResponse = await importCallbackStorage(orgId, projectId, fileName, objectKey);
      // console.log('icResponse', icResponse)

      const finalFileName = icResponse.icResponse.data.name

      showToast('Mission uploaded to FlightHub', finalFileName, 'success')

      console.log("Mission successfully uploaded to FlightHub!");

    } catch (err) {
      console.error("Failed to upload mission sequence:", err);
    } finally {
      setIsUploading(false)
    }
  };

  // Convert mission Waypoints to Map expected format
  const mappedWaypoints: LiveWaypointData[] = (selectedMission?.waypoints || []).map(wp => ({
    latitude: wp.latitude,
    longitude: wp.longitude,
    altitude: wp.elevation || 0,
    heading: wp.yaw || 0,
    gimbalPitch: wp.pitch || 0,
    zoomFactor: wp.zoom || 1
  }));

  // --- RENDER ---
  if (!orgId || !projectId) {
    return <div style={{ color: 'white', padding: '20px' }}>Missing orgId or projectId in URL!</div>;
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#000' }}>

      {debugXml && (
        <XMLDebugModal
          templateKml={debugXml.template}
          waylinesWpml={debugXml.waylines}
          onClose={() => setDebugXml(null)}
        />
      )}

      {/* LEFT SIDEBAR: Missions & Waypoints */}
      <div style={{ width: '350px', backgroundColor: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', zIndex: 10 }}>

        {/* Missions List */}
        <div style={{ padding: '15px', borderBottom: '1px solid #333', flex: '0 0 auto' }}>
          <h2 style={{ color: 'white', fontSize: '16px', margin: '0 0 15px 0' }}>Project Missions</h2>
          {allMissions.length === 0 ? (
            <p style={{ color: '#888', fontSize: '12px' }}>No missions found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allMissions.map(mission => (
                <div
                  key={mission.id}
                  onClick={() => { if (!isUploading) setSelectedMissionId(mission.id === selectedMissionId ? null : mission.id) }}
                  style={{
                    padding: '10px',
                    backgroundColor: mission.id === selectedMissionId ? '#0066ff' : '#222',
                    color: 'white',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    border: '1px solid',
                    borderColor: mission.id === selectedMissionId ? '#0066ff' : '#444'
                  }}
                >
                  {mission.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waypoints List (Only shows if a mission is selected) */}
        <div style={{ padding: '15px', flex: '1 1 auto', overflowY: 'auto' }}>

          {isUploading ? (
            <div style={{ color: '#a1b7da', fontSize: '12px', fontWeight: 'bold', padding: '5px' }}>
              Uploading mission to FH... ⏳
            </div>
          ) : (

            selectedMission ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '10px' }}>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDebugMission(selectedMission);
                    }}
                    style={{
                      background: '#333',
                      border: 'none',
                      color: '#99b7e2',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Debug
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportMission(selectedMission);
                    }}
                    style={{
                      background: '#333',
                      border: 'none',
                      color: '#99b7e2',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Export
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadMission(selectedMission);
                    }}
                    style={{
                      background: '#333',
                      border: 'none',
                      color: '#99b7e2',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Upload
                  </button>
                </div>

                <h3 style={{ color: '#aaa', fontSize: '12px', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                  Waypoints: {selectedMission.name}
                </h3>
                {(selectedMission.waypoints || []).length === 0 ? (
                  <p style={{ color: '#666', fontSize: '12px' }}>No waypoints recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedMission.waypoints?.map((wp, i) => (
                      <div key={wp.id} style={{ padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #333', color: '#ccc', fontSize: '11px' }}>
                        {/* <strong style={{ color: '#fff' }}>WP {i + 1}</strong> • {wp.tag || 'No Tag'} */}
                        <div style={{ marginTop: '4px', color: '#888' }}>
                          Lat: {wp.latitude.toFixed(5)} | Lng: {wp.longitude.toFixed(5)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#666', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
                Select a mission to view waypoints on the map.
              </p>
            )

          )}
        </div>
      </div>

      {/* RIGHT MAIN AREA: The Map and Overlays */}
      <div style={{ flex: 1, position: 'relative', minWidth: '10px', minHeight: '10px', overflow: 'hidden' }} className={styles.dashboardContainer}>
        <Map
          initialCenter={mapCenter}
          liveDroneData={livedroneData}
          waypoints={mappedWaypoints} // Hand the selected mission's waypoints to the map!
          annotations={liveAnnotations} // Live annotations!
        />

        {/* Existing Overlays */}

        {showStatusOverlay &&
          <div className={styles.statusOverlay}>
            <div className={styles.tabInfo}>
              {currentTabId ? `Connected to Tab: ${currentTabId}` : 'Finding DJI Tab...'}
            </div>

            <button onClick={toggleDebugger} className={`${styles.simButton} ${isDebuggerActive ? styles.active : ''}`}>
              {isDebuggerActive ? '🔴 DISCONNECT DEBUGGER' : '🔌 ATTACH TO FLIGHTHUB'}
            </button>

            <button onClick={isConnected ? disconnect : connect} className={`${styles.simButton}`}>
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
        }
      </div>
    </div>
  );
}