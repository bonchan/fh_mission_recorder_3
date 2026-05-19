import React from 'react';
import ReactDOM from 'react-dom/client';
import { FlightRoutesView } from './FlightRoutesView';
import { ToastProvider } from '@/providers/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
            <ToastProvider>
                <FlightRoutesView />
            </ToastProvider>
    </React.StrictMode>
);
