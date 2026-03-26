import React, { useState, useEffect, useRef } from 'react';
import { createLogger } from '@/utils/logger';
import { Map } from '@/components/map/Map';
import styles from './DashboardView.module.css';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput'
import { LiveDroneData, LiveWaypointData, Annotation } from '@/utils/interfaces';
import { useDjiSimulator } from '@/hooks/useDjiSimulator';
import { useLiveMissions } from '@/hooks/useLiveMissions';
import { useExtensionData } from '@/providers/ExtensionDataProvider';

import { generateDJIMission, generateDJIMissionFiles } from '@/utils/wpml-generator';
import { XMLDebugModal } from '@/components/debug/XMLDebugModal';
import { uploadToCloudStorage } from '@/services/cloudStorage';

import { useToast } from '@/providers/ToastProvider'

import { delay } from '@/utils/time'

const log = createLogger('DashboardView');

export function DashboardView() {
  // 1. Get IDs from the URL
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
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

  const [searchQuery, setSearchQuery] = useState('');

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
        .catch(err => log.error("Failed to load annotations", err));
    }
  }, [orgId, projectId, currentTabId]);

  // --- TELEMETRY LISTENERS ---
  useEffect(() => {
    if (simData && simData.sn == selectedMission?.device.deviceSn) {
      lastHeartbeatRef.current = simData.timestamp;
      log.info('simData', simData)
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
      if (lastHeartbeatRef.current === 0) {
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

    log.info('selectedMission', selectedMission)

    const waypoints = selectedMission.waypoints || [];

    if (waypoints.length > 0) {
      // 1. Mission has waypoints: Grab the very last one
      const lastWp = waypoints[waypoints.length - 1];
      log.info('lastWp', lastWp)

      if (lastWp.longitude && lastWp.latitude) {
        setMapCenter([lastWp.longitude, lastWp.latitude]);
      }
    } else {
      // 2. No waypoints: Fallback to the Dock's (parent) coordinates
      const dock = selectedMission.device?.parent;
      log.info('dock', dock)

      if (dock?.longitude && dock?.latitude) {
        setMapCenter([dock.longitude, dock.latitude]);
      }
    }
  }, [selectedMission]);

  const displayedMissions = useMemo(() => {
    if (searchQuery.length > 2) {
      const lowerQuery = searchQuery.toLowerCase();
      return allMissions.filter(mission => {
        return (
          mission.name.toLowerCase().includes(lowerQuery) ||
          mission.device.deviceOrganizationCallsign.toLowerCase().includes(lowerQuery) ||
          mission.device.parent?.deviceOrganizationCallsign.toLowerCase().includes(lowerQuery)
        )
      }
      );
    }
    // If search is empty or 1-2 chars, just show everything
    return allMissions;
  }, [allMissions, searchQuery]);

  const toggleDebugger = async () => {
    if (!currentTabId) return;
    const nextState = !isDebuggerActive;
    await browser.runtime.sendMessage({
      action: nextState ? 'ENABLE_WS_DEBUG' : 'DISABLE_WS_DEBUG',
      tabId: currentTabId
    });
    setIsDebuggerActive(nextState);
  };

  // const handleMissionSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const query = e.target.value;
  //   setSearchQuery(query);
  // };

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

  const handleUploadMission = async (mission: Mission) => {
    if (!orgId || !projectId) return;

    const toastTTL = 3000

    try {
      // 1. Get the STS Credentials
      setIsUploading(true)
      showToast('Getting storage credentials', '', 'info', toastTTL, true)

      const stsResponse = await getStorageUploadCredentials(orgId, projectId); // Assuming this is where it lives
      // log.info('stsResponse', stsResponse)
      const { endpoint, bucket, object_key_prefix, credentials, provider } = stsResponse.credentials.data;

      // 2. Generate the Mission Blob
      showToast('Generating mission file', '', 'info', toastTTL, true)
      const blob = await generateDJIMission(mission);
      const cleanName = mission.name.replace(/[<>:"/|?*._\\]/g, '');
      const fileUUID = crypto.randomUUID();
      const tempFileName = `${fileUUID}.kmz`;

      // Convert Blob to File object for easier uploading with temp name
      const file = new File([blob], tempFileName, { type: 'application/zip' });

      // 3. Upload with random UUID first
      const objectKey = `${object_key_prefix}/${tempFileName}`;

      // 4. Upload the file to AliCloud / AWS with temp name
      // log.info(`Uploading ${tempFileName} to ${provider} as ${objectKey}...`);
      showToast('Uploading mission to FH', '', 'info', toastTTL, true)
      const csResponse = await uploadToCloudStorage(file, objectKey, stsResponse.credentials.data);
      log.debug('csResponse', csResponse)

      await delay(500)

      // 5. Now check the desired name for duplicates
      let desiredFileName = `P3--${cleanName}.kmz`;
      showToast('Checking file name', desiredFileName, 'info', toastTTL, true)
      const nscResponse = await duplicateNameStorageCheck(orgId, projectId, desiredFileName)
      log.debug('nscResponse.dnResponse', nscResponse.dnResponse)
      desiredFileName = nscResponse.dnResponse.data.index_name
      showToast('Final file name', desiredFileName, 'warning', toastTTL, true)

      // 6. Tell FlightHub to associate the proper name with the uploaded temp file
      const icResponse = await importCallbackStorage(orgId, projectId, desiredFileName, objectKey);
      log.debug('icResponse.icResponse', icResponse.icResponse)

      const finalFileName = icResponse.icResponse.data.name

      showToast('Mission uploaded to FlightHub', finalFileName, 'success', toastTTL, true)

      log.info("Mission successfully uploaded to FlightHub!");

    } catch (err) {
      log.error("Failed to upload mission sequence:", err);
      showToast('Failed to upload mission sequence:', String(err), 'error', toastTTL, true)

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

      <div style={{ width: '500px', backgroundColor: '#111', borderRight: '1px solid #333', flex: '0 0 auto', padding: '15px', height: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ color: 'white', fontSize: '16px', margin: 0 }}>Project Missions</h2>

          <SearchInput
            onSearch={setSearchQuery}
            initialValue={searchQuery}
          />

        </div>
        {/* Missions List */}
        {displayedMissions.length === 0 ? (
          <p style={{ color: '#888', fontSize: '12px' }}>No missions found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', minHeight: '200px', overflowY: 'auto' }}>
            {displayedMissions.map(mission => (
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
                {`${mission.name} • ${mission.device.parent?.deviceOrganizationCallsign} - ${(mission.waypoints || []).length} Waypoints`}
              </div>
            ))}
          </div>
        )}

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

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDebugMission(selectedMission);
                    }}
                    variant='sad'>Debug</Button>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportMission(selectedMission);
                    }}
                    variant='sad'>Export</Button>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadMission(selectedMission);
                    }}
                    disabled={isUploading}
                    variant='sad'>{isUploading ? 'Uploading...' : 'Upload'}</Button>
                </div>

                <h3 style={{ color: '#aaa', fontSize: '12px', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                  Waypoints: {selectedMission.name}
                </h3>
                {(selectedMission.waypoints || []).length === 0 ? (
                  <p style={{ color: '#666', fontSize: '12px' }}>No waypoints recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: '200px', overflowY: 'auto' }}>
                    {selectedMission.waypoints?.map((waypoint, index) => (
                      <div key={waypoint.id} style={{ padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #333', color: '#ccc', fontSize: '11px' }}>
                        {/* <strong style={{ color: '#fff' }}>WP {i + 1}</strong> • {wp.tag || 'No Tag'} */}
                        {/* <div style={{ marginTop: '4px', color: '#888' }}> */}
                        {/* Lat: {wp.latitude.toFixed(5)} | Lng: {wp.longitude.toFixed(5)} */}
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
                          <div></div>
                          <div><span style={{ color: '#666' }}>Lon:</span> {waypoint.longitude?.toFixed(6)}</div>
                          <div><span style={{ color: '#666' }}>Lat:</span> {waypoint.latitude?.toFixed(6)}</div>
                          <div><span style={{ color: '#666' }}>Elev:</span> {waypoint.elevation}m</div>
                          <div><span style={{ color: '#666' }}>Height:</span> {waypoint.height}m</div>
                          <div><span style={{ color: '#666' }}>Yaw:</span> {waypoint.yaw}°</div>
                          <div><span style={{ color: '#666' }}>Pitch:</span> {waypoint.pitch}°</div>
                          <div><span style={{ color: '#666' }}>Zoom:</span> {waypoint.zoom}x</div>
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