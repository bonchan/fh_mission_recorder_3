import React from 'react';
import ReactDOM from 'react-dom/client';
import { PlanningView } from './PlanningView';
import { ToastProvider } from '@/providers/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
            <ToastProvider>
                <PlanningView />
            </ToastProvider>
    </React.StrictMode>
);
