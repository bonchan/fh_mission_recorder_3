import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardView } from './DashboardView';
import { ExtensionDataProvider } from '@/providers/ExtensionDataProvider';


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ExtensionDataProvider>
            <DashboardView />
        </ExtensionDataProvider>
    </React.StrictMode>
);


