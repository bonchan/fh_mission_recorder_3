import React, { createContext, useContext } from 'react';
import { createLogger } from '@/utils/logger';
import { useDjiSimulator } from '@/hooks/useDjiSimulator'


interface DataContextType {
  simData: LiveDroneData | null;
  isSimConnected: boolean;
  connectSim: (params?: SimulatorConnectParams) => void;
  disconnectSim: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

const log = createLogger('ExtensionDataProvider');

export function ExtensionDataProvider({ children }: { children: React.ReactNode }) {

  const { data: simData, isConnected: isSimConnected, connect: connectSim, disconnect: disconnectSim } = useDjiSimulator();


  return (
    <DataContext.Provider value={{
      simData,
      isSimConnected,
      connectSim,
      disconnectSim,
    }}>
      {children}
    </DataContext.Provider>
  );
}

// The new, clean hook for your UI components!
export const useExtensionData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useExtensionData must be used within ExtensionDataProvider");
  return context;
};