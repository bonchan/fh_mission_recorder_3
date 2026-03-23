import { useState, useEffect } from 'react';
import { useToast } from '@/providers/ToastProvider';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { ViewContext, Mission, Drone, Annotation } from '@/utils/interfaces';
import { MissionsContainer } from '@/components/mission/MissionsContainer';

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
      <MissionsContainer orgId={orgId} projectId={projectId} devices={devices} isFetching={isFetching} viewContext={ViewContext.SIDEPANEL}></MissionsContainer>
    </div>
  );
}