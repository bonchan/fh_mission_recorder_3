import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminView } from './AdminView';
import { ExtensionDataProvider } from '@/providers/ExtensionDataProvider';
import { ToastProvider } from '@/providers/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ExtensionDataProvider>
            <ToastProvider>
                <AdminView />
            </ToastProvider>
        </ExtensionDataProvider>
    </React.StrictMode>
);
