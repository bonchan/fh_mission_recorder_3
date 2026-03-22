import React from 'react';
import ReactDOM from 'react-dom/client';
import SidePanelView from './SidePanelView';
import { ExtensionDataProvider } from '@/providers/ExtensionDataProvider';
import { ToastProvider } from '@/providers/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExtensionDataProvider>
      <ToastProvider>
        <SidePanelView />
      </ToastProvider>
    </ExtensionDataProvider>
  </React.StrictMode>,
);