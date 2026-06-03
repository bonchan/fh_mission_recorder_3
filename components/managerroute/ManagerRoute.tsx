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
import { SavedRouteSet, Drone } from '@/utils/interfaces';
import { useDatabase } from '@/hooks/useDatabase';
import { toDockDroneList } from '@/utils/mapper';

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
  const [activeTab, setActiveTab] = useState<TabId>('import');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RouteSettings>({
    maxDistanceKm: 8,
    maxPoints: 12,
  });
  const [routePrefix, setRoutePrefix] = useState('');

  const { savedSets, saveSet, deleteSet } = useSavedRouteSets(projectId);
  const { projectTopologies } = useDatabase(orgId, projectId);
  const devices: Drone[] = toDockDroneList(projectTopologies);

  const handlePointsChanged = (newPoints: RoutePoint[]) => {
    setPoints(newPoints);
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
            onPointsChanged={handlePointsChanged}
            onGoToRoutes={() => setActiveTab('routes')}
            settings={settings}
            savedSets={savedSets}
            onLoadSession={handleLoadSession}
            onDeleteSession={deleteSet}
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
        {renderTabContent()}
      </main>
    </div>
  );
}
