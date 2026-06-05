import React from 'react';
import { RoutePoint } from '@/utils/routeOptimizer';
import { RouteSettings } from './ManagerRoute';
import { RouteExporter } from './RouteExporter';
import { Drone, PointGroup } from '@/utils/interfaces';

interface RoutesPanelProps {
  points: RoutePoint[];
  groups: PointGroup[];
  settings: RouteSettings;
  orgId: string;
  projectId: string;
  routePrefix: string;
  onRoutePrefixChange: (prefix: string) => void;
  onSaveSession: (name: string) => Promise<void>;
  devices: Drone[];
  debugMode?: boolean;
}

export function RoutesPanel({ points, groups, settings, orgId, projectId, routePrefix, onRoutePrefixChange, onSaveSession, devices, debugMode }: RoutesPanelProps) {
  return (
    <RouteExporter
      points={points}
      groups={groups}
      orgId={orgId}
      projectId={projectId}
      settings={settings}
      routePrefix={routePrefix}
      onRoutePrefixChange={onRoutePrefixChange}
      onSaveSession={onSaveSession}
      devices={devices}
      debugMode={debugMode}
    />
  );
}
