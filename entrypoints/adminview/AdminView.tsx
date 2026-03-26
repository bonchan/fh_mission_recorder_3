import React, { useState, useMemo, useEffect } from 'react';
import { createLogger } from '@/utils/logger';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
// 1. Import your mapper and type! (Adjust the path as needed)
import { toFlatDevice } from '@/utils/mapper';
import { FlatDevice } from '@/utils/interfaces';

const log = createLogger('AdminView');

type SortDirection = 'asc' | 'desc';

// 2. Define exactly which columns you want to see in the table
const COLUMNS: { key: keyof FlatDevice; label: string }[] = [
  { key: 'hostDeviceSn', label: 'hostDeviceSn' },
  { key: 'hostDeviceModelName', label: 'hostDeviceModelName' },
  { key: 'hostDeviceOnlineStatus', label: 'hostDeviceOnlineStatus' },
  { key: 'hostDeviceDeviceProjectCallsign', label: 'hostDeviceDeviceProjectCallsign' },
  { key: 'hostDeviceOrganizationCallsign', label: 'hostDeviceOrganizationCallsign' },
  { key: 'hostBatteryCapacityPercent', label: 'hostBatteryCapacityPercent' },
  { key: 'hostBatteryFirmwareVersion', label: 'hostBatteryFirmwareVersion' },
  { key: 'hostBatteryHighVoltageStorageDays', label: 'hostBatteryHighVoltageStorageDays' },
  { key: 'hostBatteryLoopTimes', label: 'hostBatteryLoopTimes' },
  { key: 'hostBatterySn', label: 'hostBatterySn' },
  { key: 'hostDeviceStateFirmwareUpgradeStatus', label: 'hostDeviceStateFirmwareUpgradeStatus' },
  { key: 'hostDeviceStateFirmwareVersion', label: 'hostDeviceStateFirmwareVersion' },
  { key: 'hostDeviceStateFlysafeDatabaseVersion', label: 'hostDeviceStateFlysafeDatabaseVersion' },
  { key: 'hostDeviceStateTrackId', label: 'hostDeviceStateTrackId' },
  { key: 'hostDeviceStateWpmzVersion', label: 'hostDeviceStateWpmzVersion' },
  { key: 'parentDeviceModelName', label: 'parentDeviceModelName' },
  { key: 'parentDeviceOnlineStatus', label: 'parentDeviceOnlineStatus' },
  { key: 'parentDeviceProjectCallsign', label: 'parentDeviceProjectCallsign' },
  { key: 'parentDeviceOrganizationCallsign', label: 'parentDeviceOrganizationCallsign' },
  { key: 'parentDeviceStateDroneChargeStateState', label: 'parentDeviceStateDroneChargeStateState' },
  { key: 'parentDeviceStateDroneInDock', label: 'parentDeviceStateDroneInDock' },
  { key: 'parentIndex', label: 'parentIndex' },
  { key: 'parentDeviceSn', label: 'parentDeviceSn' }
];

export function AdminView() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');

  const { getFreshTopologies } = useExtensionData();

  // 3. Swap the dummy data out for real state!
  const [devices, setDevices] = useState<FlatDevice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof FlatDevice; direction: SortDirection } | null>(null);

  // 4. Fetch and Map the Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const freshTopologies = await getFreshTopologies(orgId, projectId, sourceTabId);
        log.info('fresh data received', freshTopologies);

        // // FlightHub APIs usually return data inside a .list or .data array, or maybe it's the raw array. 
        // // Adjust `freshTopologies.list` to whatever the actual array is!
        // const itemsArray = Array.isArray(freshTopologies) ? freshTopologies : freshTopologies?.list || [];

        // // Run every item through your awesome mapper, and filter out any nulls!
        // const mappedDevices = itemsArray
        //   .map(toFlatDevice)
        //   .filter((device: any): device is FlatDevice => device !== null);

        setDevices(freshTopologies);
      } catch (error) {
        log.error("Failed to load topologies:", error);
      }
    };

    loadData();
  }, [orgId, projectId, sourceTabId, getFreshTopologies]);


  // 5. Update Search & Sort Logic
  const processedData = useMemo(() => {
    let data = [...devices];

    // Step A: Search dynamically across all the defined columns!
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      data = data.filter(device =>
        COLUMNS.some(col => {
          const val = device[col.key];
          return val ? String(val).toLowerCase().includes(lowerQuery) : false;
        })
      );
    }

    // Step B: Sort
    if (sortConfig) {
      data.sort((a, b) => {
        const valueA = a[sortConfig.key] ?? '';
        const valueB = b[sortConfig.key] ?? '';

        if (valueA < valueB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [devices, searchQuery, sortConfig]);

  // Handlers
  const handleSort = (key: keyof FlatDevice) => {
    setSortConfig(current => {
      if (current && current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: keyof FlatDevice) => {
    if (sortConfig?.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div style={{ padding: '30px', backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Device Administration</h1>

        <input
          type="text"
          placeholder="Search devices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '10px 16px', borderRadius: '6px', border: '1px solid #333',
            backgroundColor: '#1a1a1a', color: '#fff', width: '300px', outline: 'none'
          }}
        />
      </div>

      {/* The Data Table */}
      <div style={{ backgroundColor: '#111', borderRadius: '8px', border: '1px solid #222', overflow: 'scroll' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>

          {/* Dynamic Table Headers */}
          <thead style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #333' }}>
            <tr>
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  style={{
                    padding: '16px', cursor: 'pointer', userSelect: 'none',
                    color: sortConfig?.key === key ? '#0066ff' : '#aaa',
                  }}
                >
                  {label} <span style={{ fontSize: '12px', opacity: 0.7 }}>{getSortIcon(key)}</span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {processedData.length > 0 ? (
              processedData.map((device, index) => (
                <tr
                  // If hostDeviceSn isn't guaranteed to be unique, fallback to index
                  key={device.hostDeviceSn ? String(device.hostDeviceSn) : index}
                  style={{ borderBottom: '1px solid #222', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Map through the columns array to output the correct values */}
                  {COLUMNS.map(({ key }) => (
                    <td key={key} style={{ padding: '16px', color: '#ccc' }}>
                      {String(device[key] ?? '--')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                  No devices found matching "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}