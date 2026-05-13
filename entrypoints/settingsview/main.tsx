import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsView } from './SettingsView';
import { ExtensionDataProvider } from '@/providers/ExtensionDataProvider';
import { ToastProvider } from '@/providers/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ExtensionDataProvider>
            <ToastProvider>
                <SettingsView />
            </ToastProvider>
        </ExtensionDataProvider>
    </React.StrictMode>
);
