import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardView } from './DashboardView';
import { ExtensionStateProvider } from '@/components/ExtensionStateProvider';


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ExtensionStateProvider>
            <DashboardView />
        </ExtensionStateProvider>
    </React.StrictMode>
);


