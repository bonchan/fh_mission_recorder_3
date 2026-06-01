import React from 'react';
import { createLogger } from '@/utils/logger';
import { ManagerRoute } from '@/components/managerroute/ManagerRoute';
import '@/components/managerroute/ManagerRoute.css';

const log = createLogger('ManagerRouteView');

export function ManagerRouteView() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const debugMode = params.get('debugMode') === 'true';

  return (
    <ManagerRoute
      orgId={orgId}
      projectId={projectId}
      debugMode={debugMode}
    />
  );
}
