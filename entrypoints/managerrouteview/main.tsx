import React from 'react';
import ReactDOM from 'react-dom/client';
import { ManagerRouteView } from './ManagerRouteView';
import { ToastProvider } from '@/providers/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ManagerRouteView />
    </ToastProvider>
  </React.StrictMode>
);
