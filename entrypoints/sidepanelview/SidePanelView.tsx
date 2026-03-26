import { useState, useEffect } from 'react';
import { createLogger } from '@/utils/logger';
import { useToast } from '@/providers/ToastProvider';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { ViewContext, Mission, Drone, Annotation } from '@/utils/interfaces';
import { MissionsContainer } from '@/components/mission/MissionsContainer';

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
      sourceTabId: tabId
    });
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <button
        onClick={() => handleViewAdminDashboard()}
        style={{
          width: '100%', padding: '10px', background: '#dce655', color: '#000000',
          border: 'none', borderRadius: '4px', cursor: isFetching ? 'not-allowed' : 'pointer',
          marginBottom: '20px', fontWeight: 'bold'
        }}
      >
        {'Open Admin Dashboard'}
      </button>
      <MissionsContainer orgId={orgId} projectId={projectId} devices={devices} isFetching={isFetching} viewContext={ViewContext.SIDEPANEL}></MissionsContainer>
    </div>
  );
}