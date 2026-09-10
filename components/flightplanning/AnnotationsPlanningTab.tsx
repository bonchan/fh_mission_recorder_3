import React, { RefObject, useEffect, useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import { Wells } from '@/components/flightplanning/Wells';
import { AnnotationsMap } from '@/components/flightplanning/AnnotationsMap';
import { FlightArea, HomePoint, MapView, PlanningAnnotation, PolygonGeometry } from '@/utils/interfaces';

interface AnnotationsPlanningTabProps {
  orgId: string;
  projectId: string;
  sourceTabId: number;
  debugMode: boolean;
  onSelectionChange: (annotations: PlanningAnnotation[]) => void;
  homePoint: HomePoint | null;
  onHomePointChange: (home: HomePoint | null) => void;
  isActive: boolean;
  viewRef: RefObject<MapView | null>;
  flightAreas: FlightArea[];
}

export function AnnotationsPlanningTab({ orgId, projectId, sourceTabId, debugMode, onSelectionChange, homePoint, onHomePointChange, isActive, viewRef, flightAreas }: AnnotationsPlanningTabProps) {
  // Annotations from folders currently enabled in the Wells tree
  const [folderAnnotations, setFolderAnnotations] = useState<PlanningAnnotation[]>([]);
  const [allAnnotations, setAllAnnotations] = useState<PlanningAnnotation[]>([]);
  // Drawn-on-map or KML-uploaded filter polygon
  const [polygon, setPolygon] = useState<PolygonGeometry | null>(null);

  const selectedAnnotations = useMemo(() => {
    if (!polygon) return folderAnnotations;
    const poly = turf.polygon(polygon.coordinates);
    return folderAnnotations.filter(a =>
      turf.booleanPointInPolygon(turf.point([a.longitude, a.latitude]), poly)
    );
  }, [folderAnnotations, polygon]);

  useEffect(() => {
    onSelectionChange(selectedAnnotations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnnotations]);

  return (
    <div className="planning-split">
      <div className="planning-panel">
        <Wells
          orgId={orgId}
          projectId={projectId}
          sourceTabId={sourceTabId}
          debugMode={debugMode}
          onAnnotationsChange={setFolderAnnotations}
          onAllAnnotationsChange={setAllAnnotations}
        />
        <div className="selection-summary">
          {selectedAnnotations.length} of {folderAnnotations.length} annotations selected
          {polygon && ' · polygon filter active'}
        </div>
      </div>
      <div className="planning-map">
        <AnnotationsMap
          annotations={folderAnnotations}
          allAnnotations={allAnnotations}
          viewRef={viewRef}
          flightAreas={flightAreas}
          polygon={polygon}
          onPolygonChange={setPolygon}
          homePoint={homePoint}
          onHomePointChange={onHomePointChange}
          isActive={isActive}
        />
      </div>
    </div>
  );
}
