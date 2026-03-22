import { useState } from 'react';
import './App.css';

interface Mission {
  id: string;
  name: string;
  orgId: string;
  projectId: string;
}

function App() {
  // Mock data for testing the UI
  const [missions] = useState<Mission[]>([
    { id: 'm1', name: 'North Field Scan', orgId: 'org_001', projectId: 'proj_alpha' },
    { id: 'm2', name: 'Tower Inspection', orgId: 'org_001', projectId: 'proj_beta' },
  ]);

  const handleViewDashboard = async (mission: Mission) => {
    try {
      // 1. Get the current active tab to pass as the source
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        console.error("No active tab found");
        return;
      }

      // 2. Send the command to your background.ts
      await browser.runtime.sendMessage({
        type: 'OPEN_DASHBOARD',
        missionId: mission.id,
        orgId: mission.orgId,
        projectId: mission.projectId,
        sourceTabId: tab.id
      });
      
      console.log(`Command sent for mission: ${mission.name}`);
    } catch (error) {
      console.error("Failed to send message to background:", error);
    }
  };

  return (
    <div className="w-[350px] min-h-[400px] bg-[#0f172a] text-slate-200 p-4 font-sans">
      <header className="border-b border-slate-700 pb-3 mb-4">
        <h1 className="text-lg font-bold text-blue-400 tracking-tight">
          DJI Mission Control
        </h1>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">
          RTX 5080 Telemetry Link
        </p>
      </header>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase">Active Missions</h2>
        
        {missions.map((mission) => (
          <div 
            key={mission.id} 
            className="group bg-[#1e293b] border border-slate-700 rounded-lg p-3 hover:border-blue-500 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-sm font-medium text-white">{mission.name}</div>
                <div className="text-[10px] text-slate-500">ID: {mission.id}</div>
              </div>
              <span className="bg-blue-900/30 text-blue-400 text-[9px] px-1.5 py-0.5 rounded border border-blue-500/30">
                READY
              </span>
            </div>

            <button
              onClick={() => handleViewDashboard(mission)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
              LAUNCH DASHBOARD
            </button>
          </div>
        ))}
      </div>

      <footer className="mt-6 pt-4 border-t border-slate-800 text-center">
        <div className="text-[10px] text-slate-600 italic">
          Connected to local RTX Inference Server
        </div>
      </footer>
    </div>
  );
}

export default App;