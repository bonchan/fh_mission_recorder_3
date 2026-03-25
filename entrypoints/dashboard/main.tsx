import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardView } from './DashboardView';
import { ExtensionDataProvider } from '@/providers/ExtensionDataProvider';
import { ToastProvider } from '@/providers/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ExtensionDataProvider>
            <ToastProvider>
                <DashboardView />
            </ToastProvider>
        </ExtensionDataProvider>
    </React.StrictMode>
);
