import React from 'react';
import { RoutePoint } from '@/utils/routeOptimizer';
import { RouteSettings } from './ManagerRoute';
import { RouteExporter } from './RouteExporter';

interface RoutesPanelProps {
  points: RoutePoint[];
  settings: RouteSettings;
  orgId: string;
  projectId: string;
  routePrefix: string;
  onRoutePrefixChange: (prefix: string) => void;
  onSaveSession: (name: string) => Promise<void>;
  debugMode?: boolean;
}

export function RoutesPanel({ points, settings, orgId, projectId, routePrefix, onRoutePrefixChange, onSaveSession, debugMode }: RoutesPanelProps) {
  return (
    <RouteExporter
      points={points}
      orgId={orgId}
      projectId={projectId}
      settings={settings}
      routePrefix={routePrefix}
      onRoutePrefixChange={onRoutePrefixChange}
      onSaveSession={onSaveSession}
      debugMode={debugMode}
    />
  );
}
