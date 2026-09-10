import { AnnotationsPlanningTab } from '@/components/flightplanning/AnnotationsPlanningTab';
import { ManualTab } from '@/components/flightplanning/ManualTab';
import { OptimizationTab } from '@/components/flightplanning/OptimizationTab';
import Button from '@/components/ui/Button';
import { useDatabase } from '@/hooks/useDatabase';
import { useMessage } from '@/hooks/useMessage';
import { FlightArea, HomePoint, MapView, PlanningAnnotation } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { GeneratedRoute } from '@/utils/routeOptimizer';
import { useEffect, useMemo, useRef, useState } from 'react';
import './PlanningView.css';


const log = createLogger('PlanningView');

type TabId = 'annotations' | 'optimization' | 'manual';

export function PlanningView() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
  const debugMode = params.get('debugMode') === 'true';

  const [activeTab, setActiveTab] = useState<TabId>('annotations');
  const { settings } = useDatabase(orgId, projectId)
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
      </main>
    </div>
  );
}
