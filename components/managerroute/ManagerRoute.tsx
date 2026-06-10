import React, { useState } from 'react';
import { createLogger } from '@/utils/logger';
import './ManagerRoute.css';

import { ImportPanel } from './ImportPanel';
import { RouteMap } from './RouteMap';
import { PointList } from './PointList';
import { RoutesPanel } from './RoutesPanel';
import { SettingsPanel } from './SettingsPanel';
import { RoutePoint } from '@/utils/routeOptimizer';
import { useSavedRouteSets } from '@/hooks/useSavedRouteSets';
import { SavedRouteSet, Drone, PointGroup } from '@/utils/interfaces';
import { useDatabase } from '@/hooks/useDatabase';
import { toDockDroneList } from '@/utils/mapper';
import { PolygonCoords, isPointInPolygon } from '@/utils/polygonFilter';

const log = createLogger('ManagerRoute');

type TabId = 'import' | 'mappoints' | 'routes' | 'settings';

interface ManagerRouteProps {
  orgId: string;
  projectId: string;
  debugMode?: boolean;
}

export interface RouteSettings {
  maxDistanceKm: number;
  maxPoints: number;
}

export function ManagerRoute({ orgId, projectId, debugMode = false }: ManagerRouteProps) {
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [groups, setGroups] = useState<PointGroup[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('import');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RouteSettings>({
    maxDistanceKm: 8,
    maxPoints: 12,
  });
  const [routePrefix, setRoutePrefix] = useState('');
  const [polygon, setPolygon] = useState<PolygonCoords | null>(null);
  const [excludedPoints, setExcludedPoints] = useState<{ points: RoutePoint[]; groups: PointGroup[] } | null>(null);

  const { savedSets, isLoading, saveSet, deleteSet } = useSavedRouteSets(projectId);
  const { projectTopologies } = useDatabase(orgId, projectId);
  const devices: Drone[] = toDockDroneList(projectTopologies);

  const handlePointsChanged = (newPoints: RoutePoint[], newGroups?: PointGroup[]) => {
    setPoints(newPoints);
    if (newGroups !== undefined) setGroups(newGroups);
  };

  const handlePointsReordered = (reorderedPoints: RoutePoint[]) => {
    setPoints(reorderedPoints);
  };

  const handlePointRemoved = (pointId: string) => {
    setPoints(points.filter(p => p.id !== pointId));
  };

  const handlePointAdded = (newPoint: RoutePoint) => {
    setPoints([...points, newPoint]);
  };

  const handleSettingsChanged = (newSettings: RouteSettings) => {
    setSettings(newSettings);
  };

  const handleFilterByPolygon = () => {
    if (!polygon || polygon.length < 3) return;
    const inside = points.filter(p => isPointInPolygon(p.latitude, p.longitude, polygon));
    const outside = points.filter(p => !isPointInPolygon(p.latitude, p.longitude, polygon));
    const outsideIds = new Set(outside.map(p => p.id));
    const outsideGroups = groups.filter(g => outside.some(p => p.groupId === g.id));
    const insideGroups = groups.filter(g => inside.some(p => p.groupId === g.id));
    setExcludedPoints(prev => ({
      points: [...(prev?.points ?? []), ...outside],
      groups: [...(prev?.groups.filter(g => !outsideGroups.some(og => og.id === g.id)) ?? []), ...outsideGroups],
    }));
    setPoints(inside);
    setGroups(insideGroups);
    log.info(`Filter: kept ${inside.length}, excluded ${outside.length}`);
  };

  const handleRestoreExcluded = () => {
    if (!excludedPoints) return;
    const confirmMsg = `¿Restaurar ${excludedPoints.points.length} puntos excluidos? Se agregarán a los ${points.length} actuales.`;
    if (!window.confirm(confirmMsg)) return;
    setPoints(prev => [...prev, ...excludedPoints.points]);
    setGroups(prev => {
      const existingIds = new Set(prev.map(g => g.id));
      const toAdd = excludedPoints.groups.filter(g => !existingIds.has(g.id));
      return [...prev, ...toAdd];
    });
    setExcludedPoints(null);
    log.info(`Restored ${excludedPoints.points.length} excluded points`);
  };

  const handleSaveSession = async (name: string) => {
    const set: SavedRouteSet = {
      id: crypto.randomUUID(),
      projectId,
      name,
      createdDate: Date.now(),
      points: points.map(p => ({
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        description: p.description,
      })),
      maxDistanceKm: settings.maxDistanceKm,
      maxPoints: settings.maxPoints,
      routePrefix,
    };
    await saveSet(set);
    log.info(`Saved session: ${name}`);
  };

  const handleLoadSession = (set: SavedRouteSet) => {
    setPoints(set.points as RoutePoint[]);
    setGroups([]);
    setSettings({ maxDistanceKm: set.maxDistanceKm, maxPoints: set.maxPoints });
    setRoutePrefix(set.routePrefix);
    setActiveTab('import');
    log.info(`Loaded session: ${set.name}`);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'import':
        return (
          <ImportPanel
            points={points}
            groups={groups}
            onPointsChanged={handlePointsChanged}
            onGroupsChanged={setGroups}
            onGoToRoutes={() => setActiveTab('routes')}
            onGoToMap={() => setActiveTab('mappoints')}
            settings={settings}
            savedSets={savedSets}
            onLoadSession={handleLoadSession}
            onDeleteSession={deleteSet}
            polygon={polygon}
            onPolygonChanged={setPolygon}
            onFilterByPolygon={handleFilterByPolygon}
            excludedCount={excludedPoints?.points.length ?? 0}
            onRestoreExcluded={handleRestoreExcluded}
            debugMode={debugMode}
          />
        );
      case 'mappoints':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>
            <RouteMap
              points={points}
              selectedPointId={selectedPointId}
              onPointSelected={setSelectedPointId}
              onPointsReordered={handlePointsReordered}
              polygon={polygon}
              onPolygonChanged={setPolygon}
              onFilterByPolygon={handleFilterByPolygon}
              settings={settings}
              debugMode={debugMode}
            />
            <PointList
              points={points}
              selectedPointId={selectedPointId}
              onPointSelected={setSelectedPointId}
              onPointRemoved={handlePointRemoved}
              onPointAdded={handlePointAdded}
              settings={settings}
              debugMode={debugMode}
            />
          </div>
        );
      case 'routes':
        return (
          <RoutesPanel
            points={points}
            groups={groups}
            settings={settings}
            orgId={orgId}
            projectId={projectId}
            routePrefix={routePrefix}
            onRoutePrefixChange={setRoutePrefix}
            onSaveSession={handleSaveSession}
            devices={devices}
            debugMode={debugMode}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            settings={settings}
            onSettingsChanged={handleSettingsChanged}
            debugMode={debugMode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-section">
          <h1>Manager Routes</h1>
          <nav className="tabs-nav">
            <button
              className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              Import
            </button>
            <button
              className={`tab-button ${activeTab === 'mappoints' ? 'active' : ''}`}
              onClick={() => setActiveTab('mappoints')}
              disabled={points.length === 0}
            >
              Map & Points {points.length > 0 ? `(${points.length})` : ''}
            </button>
            <button
              className={`tab-button ${activeTab === 'routes' ? 'active' : ''}`}
              onClick={() => setActiveTab('routes')}
              disabled={points.length === 0}
            >
              Routes
            </button>
            <button
              className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="content-area" style={{ overflowY: 'auto', padding: '16px' }}>
        {isLoading
          ? <div className="empty-state"><p>Cargando...</p></div>
          : renderTabContent()
        }
      </main>
    </div>
  );
}
