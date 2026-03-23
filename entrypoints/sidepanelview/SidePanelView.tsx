import { useState, useEffect } from 'react';
import { useToast } from '@/providers/ToastProvider';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { Mission, MissionMap, Drone, Annotation } from '@/utils/interfaces';


import { MissionsContainer } from '@/components/mission/MissionsContainer';
// import { delay } from '@/utils/time';
// import { toAnnotation, toDock, toWaypoint, } from '@/utils/mapper'
// import { getProjectMissionsStorageKey } from '@/utils/utils';

export default function SidePanelView() {
  const { getTopologies, getAnnotations } = useExtensionData();
  const [isFetching, setIsFetching] = useState(false);
  const [devices, setDevices] = useState<Drone[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const { showToast } = useToast();

  // Instantly grab context from the URL query params!
  const urlParams = new URLSearchParams(window.location.search);
  const orgId = urlParams.get('orgId');
  const projectId = urlParams.get('projectId');
  const tabId = parseInt(urlParams.get('tabId') || '0', 10);

  if (orgId == null || projectId == null) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        Loading...
      </div>
    )
  }


  // --- EFFECT 1: TOPOLOGIES (Fast, 12h cache) ---
  useEffect(() => {
    if (!orgId || !projectId || !tabId) return;

    const fetchTopologies = async () => {
      setIsFetching(true);
      try {
        const topoData = await getTopologies(orgId, projectId, tabId);
        setDevices(topoData);
      } catch (err) {
        console.error("Failed to load Topologies", err);
        showToast('Failed to load Topologies', '', 'error')
      } finally {
        setIsFetching(false);
      }
    };

    fetchTopologies();
  }, [orgId, projectId, tabId, getTopologies]);


  // --- EFFECT 2: ANNOTATIONS (Slow, 5m cache, 4MB payload) ---
  useEffect(() => {
    if (!orgId || !projectId || !tabId) return;

    const fetchAnnotations = async () => {
      try {
        const annoData = await getAnnotations(orgId, projectId, tabId);
        setAnnotations(annoData);
      } catch (err) {
        console.error("Failed to load Annotations", err);
        showToast('Failed to load Annotations', '', 'error')
      } finally {
      }
    };

    fetchAnnotations();
  }, [orgId, projectId, tabId, getAnnotations]);

  const handleAddWaypoint = async (mission: Mission) => {
    // if (isFetching) return;
    // setIsFetching(true);

    // try {
    //   const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    //   if (!tab?.id) return;

    //   const response = await browser.tabs.sendMessage(tab.id, { action: "GET_TOPOLOGIES" });

    //   // 1. Find the specific drone data in the response
    //   let capturedWaypoint: Waypoint | null = null;

    //   for (const item of response.topologies.data.list) {
    //     const wp = toWaypoint(item);
    //     if (wp && wp.deviceSn === mission.device?.deviceSn) {
    //       capturedWaypoint = wp;
    //       break;
    //     }
    //   }

    //   if (!capturedWaypoint) {
    //     throw new Error("Could not find telemetry for the drone assigned to this mission.");
    //   }

    //   // 2. Identify the Dock SN for storage
    //   const dockSn = mission.device?.parent?.deviceSn;
    //   if (!dockSn) throw new Error("Mission has no associated dock SN");

    //   // 3. Update the specific mission within the dock's list
    //   const currentDockMissions = projectMissionsMap[dockSn] || [];

    //   const updatedList = currentDockMissions.map(m => {
    //     if (m.id === mission.id) {
    //       return {
    //         ...m,
    //         lastUpdated: Date.now(),
    //         waypoints: [...m.waypoints, capturedWaypoint!]
    //       };
    //     }
    //     return m;
    //   });

    //   // 4. Update local map state
    //   setProjectMissionsMap(prev => ({
    //     ...prev,
    //     [dockSn]: updatedList
    //   }));

    //   // 5. Persist to project-specific storage
    //   await saveMissions(orgId, projectId, dockSn, updatedList);

    // } catch (err) {
    //   console.error("Waypoint addition failed:", err);
    //   alert(err instanceof Error ? err.message : "Error adding waypoint.");
    // } finally {
    //   setIsFetching(false);
    // }
  };

  const handleViewDashboard = async (mission: Mission) => {
    // const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    // if (!tab?.id) return;

    // browser.runtime.sendMessage({
    //   type: 'OPEN_DASHBOARD',
    //   missionId: mission.id,
    //   orgId: mission.orgId,
    //   projectId: mission.projectId,
    //   sourceTabId: tab.id
    // });
  };


  // const displayMissions = Object.values(projectMissionsMap).flat();

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif' }}>


      <MissionsContainer orgId={orgId} projectId={projectId} devices={devices} isFetching={isFetching}></MissionsContainer>

    </div>
  );
}