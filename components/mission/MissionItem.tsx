import React, { useState } from 'react';
import { Mission, Waypoint, ViewContext } from '@/utils/interfaces';
import { WaypointList } from '@/components/waypoint/WaypointList';
import { useExtensionData } from '@/providers/ExtensionDataProvider';

interface MissionItemProps {
  mission: Mission;
  isExpanded: boolean;
  viewContext?: ViewContext;
  onToggleExpand: () => void;
  onUpdate: (updatedMission: Mission) => void;
}

export function MissionItem({ mission, isExpanded, viewContext, onToggleExpand, onUpdate }: MissionItemProps) {
  // --- UI STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(mission.name);

  const { getDroneTelemetry } = useExtensionData();
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // --- MISSION NAME EDITING ---
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the chevron toggle from firing
    setIsEditing(true);
    setEditName(mission.name);
  };

  const handleConfirmName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== mission.name) {
      onUpdate({ ...mission, name: trimmed, updatedDate: Date.now() });
    }
    setIsEditing(false);
  };

  // --- WAYPOINT LOGIC ---
  const handleUpdateWaypoint = (wpId: string, updates: Partial<Waypoint>) => {
    const updatedWaypoints = (mission.waypoints || []).map(wp =>
      wp.id === wpId ? { ...wp, ...updates } : wp
    );
    onUpdate({ ...mission, waypoints: updatedWaypoints, updatedDate: Date.now() });
  };

  const handleDeleteWaypoint = (wpId: string) => {
    const updatedWaypoints = (mission.waypoints || []).filter(wp => wp.id !== wpId);
    onUpdate({ ...mission, waypoints: updatedWaypoints, updatedDate: Date.now() });
  };

  const handleAddWaypointClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Safety check just in case legacy missions don't have these IDs
    if (!mission.orgId || !mission.projectId) {
      console.error("Missing Project or Org IDs on this mission!");
      return;
    }

    setIsFetchingLocation(true);

    try {
      // 1. Fetch FRESH topologies (bypassing the 12-hour cache by passing true!)
      // Signature: (orgId, projectId, tabId?, forceFetch?)
      const currentDroneData = await getDroneTelemetry(mission.orgId, mission.projectId, mission.device.deviceSn);

      // 3. Extract the live telemetry
      if (currentDroneData && currentDroneData.latitude && currentDroneData.longitude) {

        const newWaypoint: Waypoint = {
          id: crypto.randomUUID(),
          latitude: currentDroneData.latitude,
          longitude: currentDroneData.longitude,
          elevation: currentDroneData.elevation || 0,
          height: currentDroneData.height || 0,
          yaw: currentDroneData.yaw || 0,
          pitch: currentDroneData.pitch || 0,
          zoom: currentDroneData.zoom || 1,
          // tag: '' // Default to empty string
        };

        // 4. Update the mission array and send it to the parent!
        const updatedWaypoints = [...(mission.waypoints || []), newWaypoint];
        onUpdate({ ...mission, waypoints: updatedWaypoints, updatedDate: Date.now() });

      } else {
        alert("Could not find active telemetry for this drone. Is it turned on?");
      }
    } catch (error) {
      console.error("Failed to fetch drone location:", error);
      alert("Error fetching location: " + (error as Error).message);
    } finally {
      setIsFetchingLocation(false);
    }
  };

  return (
    <div style={{ background: '#1e1e1e', borderRadius: '8px', marginBottom: '10px', border: '1px solid #333' }}>

      {/* HEADER SECTION (Clickable to expand) */}
      <div
        onClick={() => !isEditing && onToggleExpand()}
        style={{
          padding: '12px',
          cursor: isEditing ? 'default' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {/* Left Side: Name and Dock Info */}
        <div style={{ flexGrow: 1, marginRight: '16px' }}>
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmName();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                onClick={(e) => e.stopPropagation()} // Don't collapse when clicking inside the input
                style={{
                  background: '#2c2c2c', border: '1px solid #0066ff', color: 'white',
                  padding: '4px 8px', borderRadius: '4px', outline: 'none', width: '100%',
                  fontSize: '14px', fontWeight: 'bold'
                }}
              />
              <button onClick={(e) => { e.stopPropagation(); handleConfirmName(); }} style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '16px' }}>✓</button>
              <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
          ) : (
            <div
              onDoubleClick={handleDoubleClick}
              title="Double click to edit"
              style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px', cursor: 'text' }}
            >
              {mission.name}
            </div>
          )}

          <div style={{ fontSize: '10px', color: '#888' }}>
            Dock: {mission.device?.parent?.deviceSn} • {(mission.waypoints || []).length} Waypoints
          </div>
        </div>

        {/* Right Side: Chevron */}
        <div style={{ fontSize: '18px', color: '#555', userSelect: 'none', padding: '0 8px' }}>
          {isExpanded ? '▾' : '▸'}
        </div>
      </div>

      {/* EXPANDED SECTION (Waypoints List) */}
      {isExpanded && (
        <div style={{ padding: '12px', borderTop: '1px solid #333', background: '#181818', borderRadius: '0 0 8px 8px' }}>

          <WaypointList
            waypoints={mission.waypoints}
            onUpdate={handleUpdateWaypoint}
            onDelete={handleDeleteWaypoint}
            viewContext={viewContext as any}
          />

          {/* Add Waypoint Button (Placeholder) */}
          <button
            onClick={handleAddWaypointClick}
            disabled={isFetchingLocation}
            style={{
              width: '100%',
              padding: '10px',
              background: isFetchingLocation ? '#333' : '#0066ff',
              color: isFetchingLocation ? '#888' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isFetchingLocation ? 'not-allowed' : 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              fontWeight: 'bold',
              marginTop: '8px'
            }}
          >
            {isFetchingLocation ? (
              "Fetching Drone Location..."
            ) : (
              "+ Add Waypoint at Drone Position"
            )}
          </button>
        </div>
      )}
    </div>
  );
}