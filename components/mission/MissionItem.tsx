import React, { useState, useRef } from 'react';
import { createLogger } from '@/utils/logger';
import { isInRange } from '@/utils/utils';
import { Mission, Waypoint, ViewContext, MissionType, Annotation, WaypointType } from '@/utils/interfaces';
import { WaypointList } from '@/components/waypoint/WaypointList';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { useLiveMissions } from '@/hooks/useLiveMissions';


import { generateWaypointsFromTemplate } from '@/components/mission/missionGenerator'
import { TemplateSelector } from '@/components/mission/TemplateSelector'
import { MissionTemplate } from '@/components/mission/templates'

import { useToast } from '@/providers/ToastProvider';

import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';

import { TemplateWaypoint } from '@/components/mission/templates'

interface MissionItemProps {
  mission: Mission;
  annotations: Annotation[];
  isExpanded: boolean;
  viewContext?: ViewContext;
  onToggleExpand: () => void;
}

const log = createLogger('MissionItem');

export function MissionItem({ mission, annotations, isExpanded, viewContext, onToggleExpand }: MissionItemProps) {
  // --- UI STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(mission.name);

  const { getDroneTelemetry, getCockpitData } = useExtensionData();
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const [template, setTemplate] = useState<MissionTemplate | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();

  const { updateMission, createWaypoints, updateWaypoint, deleteWaypoint } = useLiveMissions(mission.orgId, mission.projectId);


  // --- MISSION NAME EDITING ---
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the chevron toggle from firing
    setIsEditing(true);
    setEditName(mission.name);
  };

  const handleConfirmName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== mission.name) {
      updateMission({ ...mission, name: trimmed, updatedDate: Date.now() });
    }
    setIsEditing(false);
  };

  // --- WAYPOINT LOGIC ---
  const handleUpdateWaypoint = (wpId: string, updates: Partial<Waypoint>) => {
    updateWaypoint(mission, wpId, updates)
  };

  const handleDeleteWaypoint = (wpId: string) => {
    deleteWaypoint(mission, wpId)
  };

  const handleAddWaypointClick = async (e?: React.MouseEvent) => {
    e?.stopPropagation();

    // Safety check just in case legacy missions don't have these IDs
    if (!mission.orgId || !mission.projectId) {
      log.error("Missing Project or Org IDs on this mission!");
      return;
    }


    if (template) {
      const cockpitData: any = await getCockpitData(mission.orgId, mission.projectId);
      const originItem: TemplateWaypoint | undefined = template.template.find(step => step.x === 0 && step.y === 0 && step.z === 0);

      let paramError = false

      if (!originItem) {
        showToast(`Error de template`, `el template no tiene origen`, 'error')
        return
      }

      if (!isInRange(originItem.pitch, cockpitData.pitch)) {
        showToast(`PITCH ERROR`, `Pitch must be ${originItem.pitch}, not ${cockpitData.pitch}`, 'error')
        paramError = true
      }

      if (!isInRange(originItem.zoomFactor, cockpitData.zoomFactor)) {
        showToast(`ZOOM ERROR`, `Zoom must be ${originItem.zoomFactor}, not ${cockpitData.zoomFactor}`, 'error')
        paramError = true
      }
      if (paramError) return
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
          hoverTime: 0,
          // tag: '' // Default to empty string
          turn: "CW",
          type: 'picture',
          actionGroup: null,
        };


        if (template) {
          const cluster = generateWaypointsFromTemplate(newWaypoint, template);
          await createWaypoints(mission, cluster)
          showToast(`Added (${cluster.length}) waypoints from template`, template.name, 'warning')

        } else {
          await createWaypoints(mission, newWaypoint)
          showToast('Added waypoint', ``)
        }

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
      scrollRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 100);
  };

  // --- RC BUTTON LISTENER ---
  useEffect(() => {
    // 1. If this specific mission isn't open, ignore the controller completely
    if (!isExpanded) return;

    const handleRcButtonTap = (e: Event) => {
      const customEvent = e as CustomEvent;

      if (customEvent.detail === 'TR') {
        // 2. Only fire if it's a Waypoint mission (since that's where the button exists)
        // and prevent double-clicks if it's already fetching.
        if (mission.missionType === MissionType.WAYPOINT && !isFetchingLocation) {
          handleAddWaypointClick();
        }
      }
    };

    window.addEventListener('RC_BUTTON_TAP', handleRcButtonTap);

    return () => {
      window.removeEventListener('RC_BUTTON_TAP', handleRcButtonTap);
    };
  }, [isExpanded, mission.missionType, isFetchingLocation, handleAddWaypointClick]);



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



  const handleAnnotationClick = async (annotation: Annotation) => {

    // FIXME move this values to a config file
    let elevation = 100
    let hoverTime = 0
    let yaw = 0
    let pitch = -90
    let zoom = 1
    let type: WaypointType = 'picture'

    if (mission.missionType == MissionType.ZENITHAL) {
      elevation = 70
    }
    if (mission.missionType == MissionType.CLAMP) {
      elevation = 50
      hoverTime = 10
      type = 'hover'
    }

    const newWaypoint: Waypoint = {
      id: crypto.randomUUID(),
      latitude: annotation.latitude,
      longitude: annotation.longitude,
      elevation: elevation,
      height: elevation,
      yaw: yaw,
      pitch: pitch,
      zoom: zoom,
      hoverTime: hoverTime,
      turn: 'CW',
      type: type,
      actionGroup: null,
    };

    await createWaypoints(mission, newWaypoint)
    showToast(`Added waypoint at annotation: ${annotation.name}`, ``)

    setTimeout(() => {
      scrollRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 100);

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
    <div
      style={{
        background: '#1e1e1e',
        borderRadius: '8px',
        marginBottom: '10px',
        border: `1px solid ${isExpanded ? '#dd9611' : '#333'}`
      }}
    >
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

          <div style={{ fontSize: '10px', color: '#888', paddingTop: '5px' }}>
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
            onCreate={undefined}
            onUpdate={handleUpdateWaypoint}
            onDelete={handleDeleteWaypoint}
            viewContext={viewContext as any}
          />
          <div ref={scrollRef}></div>
          {mission.missionType == MissionType.WAYPOINT && <>
            <TemplateSelector onSelectTemplate={setTemplate} />
            <Button
              onClick={handleAddWaypointClick}
              disabled={isFetchingLocation}
            >
              {isFetchingLocation ? "Fetching Drone Location..." : template ? "+ Add Template at Drone Position" : "+ Add Waypoint at Drone Position"}
            </Button>
          </>
          }

          {(mission.missionType == MissionType.ZENITHAL || mission.missionType == MissionType.CLAMP) && <>

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