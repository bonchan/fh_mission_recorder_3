// hooks/useDjiSimulator.ts
import { useState, useEffect, useRef } from 'react';
import { DjiSimulatorService } from '@/components/simulator/DjiSimulatorService';
import { LiveDroneData, SimulatorConnectParams } from '@/utils/interfaces';

export function useDjiSimulator(url: string = "ws://localhost:8765") {
  const [data, setData] = useState<LiveDroneData | null>(null);
  const [status, setStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('DISCONNECTED');
  const serviceRef = useRef<DjiSimulatorService | null>(null);

  useEffect(() => {
    serviceRef.current = new DjiSimulatorService(
      url,
      (newTelemetry) => setData(newTelemetry),
      (newStatus) => setStatus(newStatus)
    );

    return () => serviceRef.current?.disconnect();
  }, [url]);

  return {
    connect: (params?: SimulatorConnectParams) => serviceRef.current?.connect(params),
    disconnect: () => serviceRef.current?.disconnect(),
    data,
    status,
    isConnected: status === 'CONNECTED'
  };
}