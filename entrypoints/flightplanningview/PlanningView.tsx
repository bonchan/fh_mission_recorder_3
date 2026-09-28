import { AnnotationsPlanningTab } from '@/components/flightplanning/AnnotationsPlanningTab';
import { ManualTab } from '@/components/flightplanning/ManualTab';
import { UploadTab } from '@/components/flightplanning/UploadTab';
import { OptimizationTab } from '@/components/flightplanning/OptimizationTab';
import Button from '@/components/ui/Button';
import { useDatabase } from '@/hooks/useDatabase';
import { useSync } from '@/hooks/useSync';
import { useMessage } from '@/hooks/useMessage';
import { Drone, FlightArea, HomePoint, MapView, PlanningAnnotation } from '@/utils/interfaces';
import { FUTURE_DOCK } from '@/utils/constants';
import { toDockDroneList } from '@/utils/mapper';
import { createLogger } from '@/utils/logger';
import { GeneratedRoute } from '@/utils/routeOptimizer';
import { useEffect, useMemo, useRef, useState } from 'react';
import './PlanningView.css';


const log = createLogger('PlanningView');

type TabId = 'annotations' | 'optimization' | 'manual' | 'upload';

export function PlanningView() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
  const debugMode = params.get('debugMode') === 'true';

  const [activeTab, setActiveTab] = useState<TabId>('annotations');
  const { settings, projectTopologies } = useDatabase(orgId, projectId)
  const { syncTopologies } = useSync(orgId, projectId, sourceTabId)
  const { openPage, getFlightAreas } = useMessage(orgId, projectId)

  // Shared across tabs — both panes stay mounted, so switching tabs never
  // drops the tree, the polygon filter or generated routes.
  const [selectedAnnotations, setSelectedAnnotations] = useState<PlanningAnnotation[]>([]);
  const [homePoint, setHomePoint] = useState<HomePoint | null>(null);
  const [routes, setRoutes] = useState<GeneratedRoute[]>([]);

  // One viewport for all three maps — a ref, so panning doesn't re-render tabs
  const mapViewRef = useRef<MapView | null>(null);

  // Flight areas are context for every tab, so they're fetched once here and
  // read fresh each time the view opens — no Dexie, no cache
  const [flightAreas, setFlightAreas] = useState<FlightArea[]>([]);

  const enabledAreas = useMemo(
    () => flightAreas.filter(area => area.status === 'enable'),
    [flightAreas]
  );

  // A real dock supplies both the home point and everything the mission file
  // needs — takeoff reference, drone and payload. FUTURE_DOCK means there's no
  // dock yet: home is placed by hand and the model is chosen on the Upload tab.
  const [dockSelection, setDockSelection] = useState<string>(FUTURE_DOCK);

  const devices: Drone[] = useMemo(() => toDockDroneList(projectTopologies) || [], [projectTopologies]);

  const usingFutureDock = dockSelection === FUTURE_DOCK;
  const selectedDevice = usingFutureDock
    ? null
    : devices.find(device => device.deviceSn === dockSelection) || null;

  useEffect(() => {
    syncTopologies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Picking a real dock puts home on it; the manual marker only applies to a
  // future dock
  useEffect(() => {
    if (usingFutureDock) return;

    const dock = devices.find(device => device.deviceSn === dockSelection)?.parent;
    if (dock) setHomePoint({ latitude: dock.latitude, longitude: dock.longitude });
  }, [dockSelection, usingFutureDock, devices]);

  // NFZ avoidance is switched off: re-running the sweep on every route edit was
  // heavy enough to lock the view up. Zones still draw on the maps, and
  // buildNfzObstacles / applyNfzAvoidance stay ready to wire back in per route.
  const updateRoutes = setRoutes;

  useEffect(() => {
    if (!projectId) return;

    getFlightAreas(sourceTabId)
      .then(setFlightAreas)
      .catch(err => log.error('Failed to load flight areas', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-section">
          <h1>Flight Planning</h1>



          <nav className="tabs-nav">
            <button
              className={`tab-button ${activeTab === 'annotations' ? 'active' : ''}`}
              onClick={() => setActiveTab('annotations')}
            >
              Annotations
            </button>
            <button
              className={`tab-button ${activeTab === 'optimization' ? 'active' : ''}`}
              onClick={() => setActiveTab('optimization')}
            >
              Flight Optimization
            </button>
            <button
              className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              Manual Tinkering
            </button>
            <button
              className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload
            </button>
          </nav>

          <Button
            onClick={() => { openPage('OPEN_SETTINGS_DASHBOARD', undefined, sourceTabId) }}
            variant="sad"
            style={{
              minWidth: '20px',
              width: '30px',
              height: '30px',
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

        <div className="actions-section">

        </div>
      </header>

      <main className="content-area">
        <div className="tab-pane" hidden={activeTab !== 'annotations'}>
          <AnnotationsPlanningTab
            orgId={orgId}
            projectId={projectId}
            sourceTabId={sourceTabId}
            debugMode={debugMode}
            onSelectionChange={setSelectedAnnotations}
            homePoint={homePoint}
            onHomePointChange={setHomePoint}
            isActive={activeTab === 'annotations'}
            viewRef={mapViewRef}
            flightAreas={enabledAreas}
            devices={devices}
            dockSelection={dockSelection}
            onDockChange={setDockSelection}
          ></AnnotationsPlanningTab>
        </div>

        <div className="tab-pane" hidden={activeTab !== 'optimization'}>
          <OptimizationTab
            selectedAnnotations={selectedAnnotations}
            homePoint={homePoint}
            isActive={activeTab === 'optimization'}
            viewRef={mapViewRef}
            flightAreas={enabledAreas}
            routes={routes}
            onRoutesChange={updateRoutes}
            settings={settings}
          ></OptimizationTab>
        </div>

        <div className="tab-pane" hidden={activeTab !== 'manual'}>
          <ManualTab
            routes={routes}
            onRoutesChange={updateRoutes}
            homePoint={homePoint}
            isActive={activeTab === 'manual'}
            viewRef={mapViewRef}
            flightAreas={enabledAreas}
            settings={settings}
          ></ManualTab>
        </div>

        <div className="tab-pane" hidden={activeTab !== 'upload'}>
          <UploadTab
            orgId={orgId}
            projectId={projectId}
            routes={routes}
            device={selectedDevice}
            usingFutureDock={usingFutureDock}
            homePoint={homePoint}
          ></UploadTab>
        </div>
      </main>
    </div>
  );
}
