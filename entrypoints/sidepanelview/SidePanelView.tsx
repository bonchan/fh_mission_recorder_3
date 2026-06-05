import VisualController from '@/components/controller/VisualController';
import { MissionsContainer } from '@/components/mission/MissionsContainer';
import Button from '@/components/ui/Button';
import { useDatabase } from '@/hooks/useDatabase';
import { useMessage } from '@/hooks/useMessage';
import { useSync } from '@/hooks/useSync';
import { useToast } from '@/providers/ToastProvider';
import { ViewContext } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { toDockDroneList } from '@/utils/mapper';
import { useEffect } from 'react';

const log = createLogger('SidePanelView');

export default function SidePanelView() {

  const { showToast } = useToast();

  // Instantly grab context from the URL query params!
  const urlParams = new URLSearchParams(window.location.search);
  const orgId = urlParams.get('orgId');
  const projectId = urlParams.get('projectId');
  const droneSn = urlParams.get('droneSn');
  const dockSn = urlParams.get('dockSn');

  const sourceTabId = parseInt(urlParams.get('tabId') || '0', 10);


  if (orgId == null || projectId == null) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        Loading...
      </div>
    )
  }
  log.info("log", orgId, projectId)
  const { settings, updateSettings, projectTopologies, projectAnnotations } = useDatabase(orgId, projectId)
  const { isSyncingTopologies, isSyncingAnnotations, syncTopologies, syncAnnotations } = useSync(orgId, projectId, sourceTabId)

  const { openPage } = useMessage(orgId, projectId)

  const devices = toDockDroneList(projectTopologies)
  const isFetching = isSyncingTopologies || isSyncingAnnotations


  useEffect(() => {
    syncAnnotations()
    syncTopologies()
  }, [projectId])

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
          <>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <Button onClick={() => { openPage('OPEN_ADMIN_DASHBOARD', undefined, sourceTabId) }} variant="warning" isLoading={isFetching} style={{ width: '100%' }}>
                Admin Dashboard
              </Button>
              <Button onClick={() => { openPage('OPEN_FLIGT_ROUTES_DASHBOARD', undefined, sourceTabId) }} variant="primary" isLoading={isFetching} style={{ width: '100%' }}>
                Flight Routes
              </Button>
              <Button
  onClick={() => {
    openPage('OPEN_MANAGER_ROUTE', undefined, sourceTabId)
  }}
  variant="primary"
  style={{ width: '100%' }}
>
  Manager Routes
</Button>
              <Button
                onClick={() => { openPage('OPEN_SETTINGS_DASHBOARD', undefined, sourceTabId) }}
                variant="sad"
                style={{
                  minWidth: '20px',
                  width: '70px',
                  padding: '0',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                title={"Settings"}
              >
                {'⚙️'}
              </Button>
            </div>

          </>
        )}
        <VisualController
          rcType={settings.selectedRemote}
          setRcType={updateSettings}
          isLoading={isFetching}
          size="compact"
          layout='real'
          showTouch={false}
          showWheels={false}
          showButtons={true}
        />
      </div>

      {/* --- SCROLLING CONTENT SECTION --- */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <MissionsContainer
          orgId={orgId}
          projectId={projectId}
          sourceTabId={sourceTabId}
          devices={devices}
          annotations={projectAnnotations}
          isFetching={isFetching}
          viewContext={ViewContext.SIDEPANEL}
        />
      </div>

    </div>
  );
}