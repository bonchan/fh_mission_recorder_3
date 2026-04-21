import { useState, useEffect } from 'react';
import { createLogger } from '@/utils/logger';
import { useToast } from '@/providers/ToastProvider';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { ViewContext, Mission, Drone, Annotation } from '@/utils/interfaces';
import { MissionsContainer } from '@/components/mission/MissionsContainer';
import { CockpitOverlay } from '@/components/cockpitoverlay/CockpitOverlay';
import Button from '@/components/ui/Button';
import VisualController from '@/components/controller/VisualController'

const log = createLogger('SidePanelView');

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
  const droneSn = urlParams.get('droneSn');
  const dockSn = urlParams.get('dockSn');

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
        log.error("Failed to load Topologies", err);
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
        log.error("Failed to load Annotations", err);
        showToast('Failed to load Annotations', '', 'error')
      } finally {
      }
    };

    fetchAnnotations();
  }, [orgId, projectId, tabId, getAnnotations]);

  const handleViewAdminDashboard = async () => {
    browser.runtime.sendMessage({
      type: 'OPEN_ADMIN_DASHBOARD',
      orgId: orgId,
      projectId: projectId,
      sourceTabId: tabId,
      debugMode: false,
    });
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif' }}>

      {/* --- STICKY HEADER SECTION --- */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#121212', // Solid background so scrolled items hide behind it
        padding: '20px 20px 10px 20px' // Top padding goes here now!
      }}>
        {droneSn && dockSn ? (
          <></>
          // <CockpitOverlay />
        ) : (
          <Button onClick={handleViewAdminDashboard} variant="warning" isLoading={isFetching} style={{ width: '100%' }}>
            Open Admin Dashboard
          </Button>
        )}
        <VisualController/>
      </div>

      {/* --- SCROLLING CONTENT SECTION --- */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <MissionsContainer
          orgId={orgId}
          projectId={projectId}
          devices={devices}
          annotations={annotations}
          isFetching={isFetching}
          viewContext={ViewContext.SIDEPANEL}
        />
      </div>

    </div>
  );
}