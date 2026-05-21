import React, { useState, useEffect } from 'react';
import { createLogger } from '@/utils/logger';
import './FlightRoutesView.css';

import { FlightRoutes } from '@/components/flightroutes/FlightRoutes';
import { Annotations } from '@/components/flightroutes/Annotations';
import { Dashboard } from '@/components/flightroutes/Dashboard';

const log = createLogger('FlightRoutesView');

type TabId = 'routes' | 'annotations' | 'dashboard';

export function FlightRoutesView() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
  const debugMode = params.get('debugMode') === 'true';

  const [activeTab, setActiveTab] = useState<TabId>('routes');

  const renderContent = () => {
    switch (activeTab) {
      case 'routes':
        return (
          <FlightRoutes
            orgId={orgId}
            projectId={projectId}
            sourceTabId={sourceTabId}
            debugMode={debugMode}
          ></FlightRoutes>
        );
      case 'annotations':
        return (
          <Annotations
            orgId={orgId}
            projectId={projectId}
            sourceTabId={sourceTabId}
            debugMode={debugMode}
          ></Annotations>
        );
      case 'dashboard':
        return (
          <Dashboard
            orgId={orgId}
            projectId={projectId}
            sourceTabId={sourceTabId}
            debugMode={debugMode}
          ></Dashboard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-section">
          <h1>Flight Routes Admin</h1>

          <nav className="tabs-nav">
            <button
              className={`tab-button ${activeTab === 'routes' ? 'active' : ''}`}
              onClick={() => setActiveTab('routes')}
            >
              Flight Routes
            </button>
            <button
              className={`tab-button ${activeTab === 'annotations' ? 'active' : ''}`}
              onClick={() => setActiveTab('annotations')}
            >
              Annotations
            </button>
            <button
              className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
          </nav>
        </div>

        <div className="actions-section">

        </div>
      </header>

      <main className="content-area">
        {renderContent()}
      </main>
    </div>
  );
}