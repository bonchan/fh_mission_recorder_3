import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createLogger } from '@/utils/logger';
import { Map } from '@/components/map/Map';
import styles from './DashboardView.module.css';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import { LiveDroneData, LiveWaypointData, Annotation, WaypointType, ViewContext, Waypoint, SimulatorConnectParams } from '@/utils/interfaces';
import { useLiveMissions } from '@/hooks/useLiveMissions';
import { useMissionActions } from '@/hooks/useMissionActions';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { WaypointList } from '@/components/waypoint/WaypointList';
import { XMLDebugModal } from '@/components/debug/XMLDebugModal';
import { useToast } from '@/providers/ToastProvider';

import { optimizeMissionPath } from '@/utils/geo'

const log = createLogger('DashboardView');

export function DashboardView() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
  const missionId = params.get('missionId') || '';
  const showStatusOverlay = params.get('statusOverlay') === 'true';

  const viewContext = ViewContext.DASHBOARD

  const { missions, updateMission, createWaypoints, updateWaypoint, deleteWaypoint } = useLiveMissions(orgId, projectId);
  const { getDroneTelemetry, getAnnotations, simData, isSimConnected, connectSim, disconnectSim, } = useExtensionData();

  const [liveAnnotations, setLiveAnnotations] = useState<Annotation[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(missionId);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [searchQuery, setSearchQuery] = useState('');

  const allMissions = Object.values(missions)
    .flat()
    .sort((a, b) => b.createdDate - a.createdDate);

  const selectedMission = allMissions.find(m => m.id === selectedMissionId);

  const [isDebuggerActive, setIsDebuggerActive] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isShowOffset, setIsShowOffset] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(sourceTabId);
  const [isTelemetryLost, setIsTelemetryLost] = useState(false);
  const lastHeartbeatRef = useRef<number>(0);
  const activeMissionSnRef = useRef<string | null>(null);

  const [livedroneData, setLivedroneData] = useState<LiveDroneData>({
    timestamp: 0, sn: '', latitude: 0, longitude: 0, altitude: 0,
    heading: 0, gimbalPitch: 0, cameraMode: 0, zoomFactor: 0, trigger: false
  });

  const [debugXml, setDebugXml] = useState<{ template: string, waylines: string } | null>(null);

  const { showToast } = useToast();

  const { debugMission, exportMission, uploadMission, isUploading } = useMissionActions();


  // --- DATA FETCHING & EFFECTS (Kept exact same) ---
  useEffect(() => {
    if (orgId && projectId) {
      getAnnotations(orgId, projectId)
        .then(setLiveAnnotations)
        .catch(err => log.error("Failed to load annotations", err));
    }
  }, [orgId, projectId, currentTabId]);

  useEffect(() => {
    if (simData && simData.sn == selectedMission?.device.deviceSn) {
      lastHeartbeatRef.current = simData.timestamp;
      setLivedroneData(simData);
    }
  }, [simData]);

  useEffect(() => {
    activeMissionSnRef.current = selectedMission?.device?.deviceSn || null;
  }, [selectedMission]);

  useEffect(() => {
    const listener = (message: any) => {
      if (message.action === 'LIVE_TELEMETRY_UPDATE' && message.liveDroneData.sn == activeMissionSnRef.current) {
        lastHeartbeatRef.current = message.liveDroneData.timestamp;
        setLivedroneData(message.liveDroneData);
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

  useEffect(() => {
    if (!selectedMission) return;
    const waypoints = selectedMission.waypoints || [];
    if (waypoints.length > 0) {
      const lastWp = waypoints[waypoints.length - 1];
      if (lastWp.longitude && lastWp.latitude) setMapCenter([lastWp.longitude, lastWp.latitude]);
    } else {
      const dock = selectedMission.device?.parent;
      if (dock?.longitude && dock?.latitude) setMapCenter([dock.longitude, dock.latitude]);
    }
  }, [selectedMission]);

  useEffect(() => {
    if (!simData) return;
    if (simData.trigger) {
      handleAddSimWaypoint()
    }
  }, [simData]);

  const displayedMissions = useMemo(() => {
    if (searchQuery.length > 2) {
      const lowerQuery = searchQuery.toLowerCase();
      return allMissions.filter(mission =>
        mission.name.toLowerCase().includes(lowerQuery) ||
        mission.device.deviceOrganizationCallsign.toLowerCase().includes(lowerQuery) ||
        mission.device.parent?.deviceOrganizationCallsign.toLowerCase().includes(lowerQuery)
      );
    }
    return allMissions;
  }, [allMissions, searchQuery]);

  // --- HANDLERS ---
  const toggleDebugger = async () => {
    if (!currentTabId) return;
    const nextState = !isDebuggerActive;
    await browser.runtime.sendMessage({ action: nextState ? 'ENABLE_WS_DEBUG' : 'DISABLE_WS_DEBUG', tabId: currentTabId });
    setIsDebuggerActive(nextState);
  };

  const toggleSimulator = async () => {
    if (isSimConnected) {
      disconnectSim()
    } else {
      const connectParams: SimulatorConnectParams = {
        dockSn: selectedMission?.device.parent?.deviceSn,
        droneSn: selectedMission?.device.deviceSn,
        startLon: selectedMission?.waypoints?.[selectedMission?.waypoints.length - 1]?.longitude ?? selectedMission?.device?.parent?.longitude,
        startLat: selectedMission?.waypoints?.[selectedMission?.waypoints.length - 1]?.latitude ?? selectedMission?.device?.parent?.latitude,
      }
      connectSim(connectParams)
    }
  };

  const toggleIsEditing = async () => {
    const nextState = !isEditing;
    setIsEditing(nextState);
  };

  const toggleOffset = async () => {
    const nextState = !isShowOffset;
    setIsShowOffset(nextState);
  };

  const handleSelectMission = (missionId: string) => {
    if (!isUploading) {
      setSelectedMissionId(missionId === selectedMissionId ? null : missionId);
      setIsEditing(false)
      disconnectSim()
    }
  }

  const handleAddSimWaypoint = async () => {

    // Safety check just in case legacy missions don't have these IDs
    if (!selectedMission || !selectedMission.orgId || !selectedMission.projectId) {
      log.error("Missing Project or Org IDs on this mission!");
      return;
    }

    if (!isSimConnected) {
      log.error("Sim is disconected!");
      return;
    }

    try {
      // 1. Fetch FRESH topologies (bypassing the 12-hour cache by passing true!)
      // Signature: (orgId, projectId, tabId?, forceFetch?)
      const currentDroneData = await getDroneTelemetry(selectedMission.orgId, selectedMission.projectId, selectedMission.device.deviceSn);

      // 3. Extract the live telemetry
      if (currentDroneData && currentDroneData.latitude && currentDroneData.longitude) {

        const newWaypoint: Waypoint = {
          id: crypto.randomUUID(),
          latitude: currentDroneData.latitude,
          longitude: currentDroneData.longitude,
          elevation: currentDroneData.elevation || 0,
          height: currentDroneData.height || 0,
          yaw: currentDroneData.yaw || 0,
          pitch: currentDroneData.pitch || 0,
          zoom: currentDroneData.zoom || 1,
          hoverTime: 0,
          // tag: '' // Default to empty string
          turn: "CW",
          type: 'picture',
          actionGroup: null,
        };

        await createWaypoints(selectedMission, newWaypoint)
        showToast('Added waypoint', ``)

      } else {
        showToast("Could not find active telemetry for this sim drone.", "Is it turned on?", 'warning');
      }
    } catch (error) {
      log.error("Failed to fetch drone location:", error);
      showToast('Error adding Waypoint:', (error as Error).message, 'error')
    }


  };

  const handleCreateSecurityWaypoint = (waypoint: Waypoint, index?: number) => {
    if (!selectedMission) return

    // FIXME move this values to a config file
    const securityWaypoint = {
      ...waypoint,
      id: crypto.randomUUID(),
      elevation: 70,
      height: 70,
      hoverTime: 0,
      zoom: 1,
      pitch: -30,
      type: 'security' as WaypointType,
    }
    createWaypoints(selectedMission, securityWaypoint, index)
  };

  const handleUpdateWaypoint = (wpId: string, updates: Partial<Waypoint>) => {
    if (!selectedMission) return
    updateWaypoint(selectedMission, wpId, updates)
  };

  const handleDeleteWaypoint = (wpId: string) => {
    if (!selectedMission) return
    deleteWaypoint(selectedMission, wpId)
  };

  const handleOptimizeMission = () => {
    const updatedMission = optimizeMissionPath(selectedMission);
    if (updatedMission) {
      updateMission(updatedMission)
    }
  }

  const mappedWaypoints: LiveWaypointData[] = (selectedMission?.waypoints || []).map(wp => ({
    latitude: wp.latitude, longitude: wp.longitude, altitude: wp.elevation || 0,
    heading: wp.yaw || 0, gimbalPitch: wp.pitch || 0, zoomFactor: wp.zoom || 1
  }));

  if (!orgId || !projectId) {
    return <div className={styles.errorContainer}>Missing orgId or projectId in URL!</div>;
  }

  // ==========================================
  //                RENDER
  // ==========================================
  return (
    <div className={styles.mainContainer}>

      {debugXml && (
        <XMLDebugModal templateKml={debugXml.template} waylinesWpml={debugXml.waylines} onClose={() => setDebugXml(null)} />
      )}

      {/* COLUMN 1: MISSIONS */}
      <div className={styles.missionColumn}>
        <div className={styles.columnHeader}>
          <h2 className={styles.columnTitle}>Project Missions</h2>
          <SearchInput onSearch={setSearchQuery} initialValue={searchQuery} width="160px" />
        </div>

        {displayedMissions.length === 0 ? (
          <p className={styles.emptyText}>No missions found.</p>
        ) : (
          <div className={styles.listContainer}>
            {displayedMissions.map(mission => (
              <div
                key={mission.id}
                onClick={() => { handleSelectMission(mission.id) }}
                className={`${styles.missionItem} ${mission.id === selectedMissionId ? styles.missionItemActive : ''}`}
              >
                {`${mission.name} • ${mission.device.parent?.deviceOrganizationCallsign} - ${(mission.waypoints || []).length} WP`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COLUMN 2: WAYPOINTS (Only shows content if a mission is selected) */}
      <div className={styles.waypointColumn}>
        {selectedMission ? (
          <>
            <div className={styles.actionButtons}>
              <Button onClick={(e) => { e.stopPropagation(); toggleIsEditing() }} variant={isEditing ? 'danger' : 'primary'}>{isEditing ? 'Done' : 'Security'}</Button>
              <Button onClick={(e) => { e.stopPropagation(); handleOptimizeMission() }} variant='warning'>Optimize</Button>
              <Button onClick={(e) => { e.stopPropagation(); debugMission(selectedMission, setDebugXml); }} variant='sad'>Debug</Button>
              <Button onClick={(e) => { e.stopPropagation(); exportMission(selectedMission); }} variant='sad'>Export</Button>
              <Button
                onClick={(e) => { e.stopPropagation(); uploadMission(selectedMission); }}
                disabled={isUploading}
                variant='sad'
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>

            {isUploading ? (
              <div className={styles.uploadingText}>Uploading mission to FH... ⏳</div>
            ) : (
              (selectedMission.waypoints || []).length === 0 ? (
                <p className={styles.emptyText}>No waypoints recorded yet.</p>
              ) : (
                // Make sure <WaypointList> has flex:1 internally or is wrapped!
                // (Your previous code snippet for WaypointList handled this internally, so it should slot in perfectly here)
                <WaypointList
                  waypoints={selectedMission.waypoints}
                  onCreate={handleCreateSecurityWaypoint}
                  onUpdate={handleUpdateWaypoint}
                  onDelete={handleDeleteWaypoint}
                  viewContext={viewContext}
                  isEditing={isEditing}
                  showOffset={isShowOffset}
                />
              )
            )}
          </>
        ) : (
          <p className={styles.emptyStateContainer}>Select a mission to view waypoints.</p>
        )}
      </div>

      {/* COLUMN 3: MAP */}
      <div className={styles.mapColumn}>
        <Map
          initialCenter={mapCenter}
          liveDroneData={livedroneData}
          waypoints={mappedWaypoints}
          annotations={liveAnnotations}
        />

        {showStatusOverlay && (
          <div className={styles.statusOverlay}>
            <div className={styles.tabInfo}>
              {currentTabId ? `Connected to Tab: ${currentTabId}` : 'Finding DJI Tab...'}
            </div>
            <button onClick={toggleDebugger} className={`${styles.simButton} ${isDebuggerActive ? styles.active : ''}`}>
              {isDebuggerActive ? '🔴 DISCONNECT DEBUGGER' : '🔌 ATTACH TO FLIGHTHUB'}
            </button>
            <button onClick={toggleSimulator} className={styles.simButton}>
              {isSimConnected ? "🛑 Stop Local Sim" : "🟢 Start Local Sim"}
            </button>
            <button onClick={toggleOffset} className={styles.simButton}>
              {isShowOffset ? "Hide offset" : "Show offset"}
            </button>
            <pre className={styles.debugInfo}>{JSON.stringify(livedroneData, null, 2)}</pre>
            {isTelemetryLost && (
              <div className={styles.telemetryError}>
                🚨 DRONE TELEMETRY LOST! <br />
                <small>Last seen: {new Date(livedroneData.timestamp).toLocaleTimeString()}</small>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}