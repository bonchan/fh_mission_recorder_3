import React, { useState, useMemo, useEffect } from 'react';
import { createLogger } from '@/utils/logger';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { toFlatDevice } from '@/utils/mapper';
import { FlatDevice } from '@/utils/interfaces';
import { filterObjectTree } from '@/utils/utils';
import SearchInput from '@/components/ui/SearchInput';
import { HostRowItem, ParentRowItem } from '@/entrypoints/adminview/DeviceDetails'

const log = createLogger('AdminView');
type SortDirection = 'asc' | 'desc';

const COLUMNS: { key: keyof FlatDevice; label: string }[] = [
  { key: 'parentCallsign', label: 'Dock name' },
  { key: 'parentModel', label: 'Dock Model' },
  { key: 'parentStatus', label: 'Dock Status' },
  { key: 'hostStatus', label: 'Drone Status' },
];

export function AdminView() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get('orgId') || '';
  const projectId = params.get('projectId') || '';
  const sourceTabId = parseInt(params.get('sourceTabId') || '0');
  const debugMode = params.get('debugMode') === 'true';

  const { getFreshTopologies } = useExtensionData();

  const [devices, setDevices] = useState<FlatDevice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof FlatDevice; direction: SortDirection } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      try {
        const freshTopologies = await getFreshTopologies(orgId, projectId, sourceTabId);
        setDevices(freshTopologies);
      } catch (error) {
        log.error("Failed to load topologies:", error);
      }
    };
    loadData();
  }, [orgId, projectId, sourceTabId, getFreshTopologies]);

  const processedData = useMemo(() => {
    let data = [...devices];

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      data = data.reduce((acc: any[], device) => {
        let rowHasMatch = false;
        const processedDevice = { ...device };

        // 1. Check standard UI columns (Strings)
        COLUMNS.forEach(col => {
          const val = device[col.key];
          if (val && String(val).toLowerCase().includes(lowerQuery)) {
            rowHasMatch = true;
          }
        });

        // 2. Check and Prune Deep Objects (Save them to NEW properties!)
        const deepObjects = [
          { key: 'rawHost', debugKey: 'debugHost' },
          { key: 'rawParent', debugKey: 'debugParent' }
        ];

        deepObjects.forEach(({ key, debugKey }) => {
          const val = device[key];
          if (val && typeof val === 'object') {
            const { isMatch, filtered } = filterObjectTree(val, lowerQuery);
            if (isMatch) {
              processedDevice[debugKey] = filtered; // Save to debugHost/debugParent
              rowHasMatch = true;
            } else {
              processedDevice[debugKey] = null; // Explicitly null if no match found inside
            }
          }
        });

        if (rowHasMatch) acc.push(processedDevice);
        return acc;
      }, []);
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const actualSortKey = sortConfig.key === 'parentCallsign' ? 'parentIndex' : sortConfig.key;
        const valueA = a[actualSortKey as keyof FlatDevice] ?? '';
        const valueB = b[actualSortKey as keyof FlatDevice] ?? '';

        if (valueA < valueB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [devices, searchQuery, sortConfig]);

  const handleSort = (key: keyof FlatDevice) => {
    setSortConfig(current => {
      if (current && current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const isAllExpanded = processedData.length > 0 && expandedRows.size === processedData.length;

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      // Collapse all
      setExpandedRows(new Set());
    } else {
      // Expand all currently visible rows
      setExpandedRows(new Set(processedData.map(device => device.id)));
    }
  };

  return (
    <div style={{
      padding: '30px',
      backgroundColor: '#0a0a0a',
      height: '100vh', // 1. Lock the page height
      boxSizing: 'border-box',
      display: 'flex', // 2. Use flexbox
      flexDirection: 'column',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexShrink: 0 // Prevent header from collapsing
      }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Device Administration</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

          <button
            onClick={toggleExpandAll}
            style={{
              padding: '8px 16px',
              backgroundColor: isAllExpanded ? '#2a2a2a' : '#1a1a1a',
              color: isAllExpanded ? '#fff' : '#ccc',
              border: '1px solid #333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              height: '38px' // Matches most standard input heights
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isAllExpanded ? '#2a2a2a' : '#1a1a1a'}
          >
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>

          <SearchInput onSearch={setSearchQuery} initialValue={searchQuery} placeholder="Search devices deep JSON..." />
        </div>
      </div>

      <div style={{
        backgroundColor: '#111',
        borderRadius: '8px',
        border: '1px solid #222',
        overflow: 'auto', // 3. Allow only the table to scroll
        flex: 1, // Fill remaining space
        minHeight: 0 // Critical flexbox trick to prevent infinite stretching
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{
                padding: '16px',
                width: '40px',
                position: 'sticky', // 4. Sticky header
                top: 0,
                backgroundColor: '#1a1a1a', // Must be solid so rows hide behind it
                zIndex: 10,
                borderBottom: '2px solid #333'
              }}></th>
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={String(key)}
                  onClick={() => handleSort(key)}
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortConfig?.key === key ? '#0066ff' : '#aaa',
                    position: 'sticky', // 4. Sticky header
                    top: 0,
                    backgroundColor: '#1a1a1a', // Must be solid
                    zIndex: 10,
                    borderBottom: '2px solid #333'
                  }}
                >
                  {label} {sortConfig?.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {processedData.length > 0 ? (
              processedData.map((device) => {
                const isExpanded = expandedRows.has(device.id);

                return (
                  <React.Fragment key={device.id}>
                    <tr
                      onClick={() => toggleRow(device.id)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #222',
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? '#1a1a1a' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#161616' }}
                      onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <td style={{ padding: '16px', color: '#666' }}>
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      {COLUMNS.map(({ key }) => (
                        <td key={String(key)} style={{ padding: '16px', color: '#ccc' }}>
                          {String(device[key] ?? '--')}
                        </td>
                      ))}
                    </tr>

                    {isExpanded && (
                      <>
                        <tr style={{ borderBottom: '1px solid #222', backgroundColor: '#151515' }}>
                          <td colSpan={COLUMNS.length + 1} style={{ padding: '20px' }}>

                            {/* We use grid here to ensure both cards stretch to equal height */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                              {/* The beautifully formatted Drone details! */}
                              <HostRowItem host={device.rawHost} />

                              {/* The beautifully formatted Dock details! */}
                              <ParentRowItem parent={device.rawParent} />

                            </div>

                          </td>
                        </tr>

                        {debugMode &&
                          <tr style={{ borderBottom: '1px solid #222', backgroundColor: '#151515' }}>
                            <td colSpan={COLUMNS.length + 1} style={{ padding: '20px' }}>
                              <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ flex: 1, backgroundColor: '#000', padding: '16px', borderRadius: '6px', border: '1px solid #333' }}>
                                  <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#888' }}>
                                    RAW HOST (DRONE) DATA {searchQuery && ' - FILTERED'}
                                  </h3>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', color: '#a0aec0', maxHeight: '400px', overflowY: 'auto' }}>
                                    {JSON.stringify(device.debugHost || device.rawHost, null, 2)}
                                  </pre>
                                </div>

                                <div style={{ flex: 1, backgroundColor: '#000', padding: '16px', borderRadius: '6px', border: '1px solid #333' }}>
                                  <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#888' }}>
                                    RAW PARENT (DOCK) DATA {searchQuery && ' - FILTERED'}
                                  </h3>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', color: '#a0aec0', maxHeight: '400px', overflowY: 'auto' }}>
                                    {JSON.stringify(device.debugParent || device.rawParent, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        }
                      </>

                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
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