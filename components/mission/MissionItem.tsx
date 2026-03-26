import React, { useState, useRef } from 'react';
import { createLogger } from '@/utils/logger';
import { Mission, Waypoint, ViewContext, MissionType, Annotation } from '@/utils/interfaces';
import { WaypointList } from '@/components/waypoint/WaypointList';
import { useExtensionData } from '@/providers/ExtensionDataProvider';

import { generateWaypointsFromTemplate } from '@/components/mission/missionGenerator'
import { TemplateSelector } from '@/components/mission/TemplateSelector'
import { MissionTemplate } from '@/components/mission/templates'

import { useToast } from '@/providers/ToastProvider';

import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';

interface MissionItemProps {
  mission: Mission;
  annotations: Annotation[];
  isExpanded: boolean;
  viewContext?: ViewContext;
  onToggleExpand: () => void;
  onUpdate: (updatedMission: Mission) => void;
}

const log = createLogger('MissionItem');

export function MissionItem({ mission, annotations, isExpanded, viewContext, onToggleExpand, onUpdate }: MissionItemProps) {
  // --- UI STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(mission.name);

  const { getDroneTelemetry } = useExtensionData();
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const [template, setTemplate] = useState<MissionTemplate | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();




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
      log.error("Missing Project or Org IDs on this mission!");
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
          turn: "CW",
          actionGroup: null
        };

        let updatedWaypoints = [...(mission.waypoints || []), newWaypoint];

        if (template) {
          const cluster = generateWaypointsFromTemplate(newWaypoint, template);
          updatedWaypoints = [...(mission.waypoints || []), ...cluster];
          showToast('Added waypoints from template', template.name, 'warning')

        } else {
          showToast('Added waypoint', `Total: ${updatedWaypoints.length}`)
        }

        // 4. Update the mission array and send it to the parent!
        onUpdate({ ...mission, waypoints: updatedWaypoints, updatedDate: Date.now() });

      } else {
        showToast("Could not find active telemetry for this drone.", "Is it turned on?", 'warning');
      }
    } catch (error) {
      log.error("Failed to fetch drone location:", error);
      showToast('Error adding Waypoint:', (error as Error).message, 'error')
    } finally {
      setIsFetchingLocation(false);
    }

    setTimeout(() => {
      addButtonRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 100);
  };



  const handleViewDashboard = async (mission: Mission) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    browser.runtime.sendMessage({
      type: 'OPEN_DASHBOARD',
      missionId: mission.id,
      orgId: mission.orgId,
      projectId: mission.projectId,
      sourceTabId: tab.id,
      statusOverlay: false
    });
  };



  const handleAnnotationClick = (annotation: Annotation) => {
    const newWaypoint: Waypoint = {
      id: crypto.randomUUID(),
      latitude: annotation.latitude,
      longitude: annotation.longitude,
      elevation: 50,
      height: 50,
      yaw: 0,
      pitch: -90,
      zoom: 1,
      turn: 'CW',
      actionGroup: null
    };

    let updatedWaypoints = [...(mission.waypoints || []), newWaypoint];
    onUpdate({ ...mission, waypoints: updatedWaypoints, updatedDate: Date.now() });
    showToast(`Added waypoint at annotation: ${annotation.name}`, `Total: ${updatedWaypoints.length}`)


    // TODO change this ref to be something else that is below all in MissionItem
    // setTimeout(() => {
    //   addButtonRef.current?.scrollIntoView({
    //     behavior: 'smooth',
    //     block: 'center'
    //   });
    // }, 100);


    setSearchQuery(''); // Close the dropdown
  };

  const filteredAnnotations = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return annotations.filter(ann =>
      ann.name?.toLowerCase().includes(lowerQuery)
    );
  }, [annotations, searchQuery]);

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
              <Button onClick={(e) => { e.stopPropagation(); handleConfirmName(); }} style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '16px', maxWidth: '20px' }}>✓</Button>
              <Button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '16px', maxWidth: '20px' }}>✕</Button>
            </div>
          ) : (
            <div
              onDoubleClick={handleDoubleClick}
              title="Double click to edit"
              style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px', cursor: 'text' }}
            >
              {`${mission.name} • ${mission.device.parent?.deviceOrganizationCallsign}`}
            </div>
          )}

          <div style={{ fontSize: '10px', color: '#888' , paddingTop:'5px'}}>
            Mission Type: {mission.missionType.toUpperCase()} | {(mission.waypoints || []).length} Waypoints
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleViewDashboard(mission);
            }}
            variant='sad'
            style={{ padding: '5px 10px' }}>Dashboard</Button>

          {viewContext === ViewContext.SIDEPANEL && (
            <div style={{ fontSize: '18px', color: '#555', userSelect: 'none' }}>
              {isExpanded ? '▾' : '▸'}
            </div>
          )}
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
          {mission.missionType == MissionType.WAYPOINT && <>
            <TemplateSelector onSelectTemplate={setTemplate} />
            <Button
              onClick={handleAddWaypointClick}
              ref={addButtonRef}
              disabled={isFetchingLocation}
            >
              {isFetchingLocation ? "Fetching Drone Location..." : template ? "+ Add Template at Drone Position" : "+ Add Waypoint at Drone Position"}
            </Button>
          </>
          }

          {mission.missionType == MissionType.ZENITHAL && <>
            ZENITHAL NOT IMPLEMENTED
          </>
          }

          {mission.missionType == MissionType.CLAMP && <>

            <SearchInput
              width="100%"
              placeholder="Search annotations to add waypoint..."
              initialValue={searchQuery}
              onSearch={setSearchQuery} // Updates the parent state whenever the user types or clears
            />

            {filteredAnnotations.length > 0 && (
              <div style={{ position: 'relative', top: '100%', left: 0, right: 0, background: '#111', zIndex: 10, border: '1px solid #444', maxHeight: '150px', overflowY: 'auto' }}>
                {filteredAnnotations.map(ann => (
                  <div
                    key={ann.id}
                    onClick={() => handleAnnotationClick(ann)}
                    style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #333', fontSize: '12px' }}
                  >
                    <strong style={{ color: '#fff' }}>{ann.name}</strong>
                    <div style={{ color: '#888' }}>Lat: {ann.latitude?.toFixed(5)}</div>
                  </div>
                ))}
              </div>
            )}

          </>
          }


        </div>
      )}
    </div>
  );
}