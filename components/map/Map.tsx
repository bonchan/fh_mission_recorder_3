import React, { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import { LineLayer, PolygonLayer, PathLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapController } from 'deck.gl';
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass } from '@/components/map/Compass';
import { LiveDroneData, LiveWaypointData, Annotation } from '@/utils/interfaces';
import { hexToRgb } from '@/utils/utils';

// --- THE EVENT HACK: Remapping Middle Click & Disabling Right Click ---
class MiddleClickOrbitController extends MapController {
    constructor(props: any) {
        super({
            ...props,
            maxPitch: 85,
            minZoom: 14,
            maxZoom: 22
        });
    }

    handleEvent(event: any) {
        if (event.rightButton && !(event.srcEvent && event.srcEvent.buttons === 4)) {
            event.rightButton = false;
            event.handled = true;
            return true;
        }

        if (event.middleButton || (event.srcEvent && event.srcEvent.buttons === 4)) {
            event.rightButton = true;
            event.middleButton = false;
        }

        return super.handleEvent(event);
    }
}

const GOOGLE_SATELLITE_STYLE = {
    version: 8,
    sources: {
        'google-sat': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
            tileSize: 256,
            maxzoom: 20
        }
    },
    layers: [
        {
            id: 'google-sat',
            type: 'raster',
            source: 'google-sat',
            minzoom: 1,
            maxzoom: 22
        }
    ]
};

interface MapProps {
    initialCenter?: [number, number];
    initialZoom?: number;
    liveDroneData?: LiveDroneData;
    waypoints?: LiveWaypointData[];
    annotations?: Annotation[];
}

type ViewState = {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
    transitionDuration?: number;
};

export function Map({
    initialCenter = [0, 0],
    initialZoom = 17,
    liveDroneData,
    waypoints = [],
    annotations = []
}: MapProps) {
    const [viewState, setViewState] = useState<ViewState>({
        longitude: initialCenter[0],
        latitude: initialCenter[1],
        zoom: initialZoom,
        pitch: 0,
        bearing: 0
    });

    const layers = useMemo(() => {
        if (!liveDroneData && (!waypoints || waypoints.length === 0) && (!annotations || annotations.length === 0)) return [];

        const pitchTransitionAngle = 30;
        const altitudeScale = Math.min(viewState.pitch / pitchTransitionAngle, 1);

        const polygonData: any[] = [];
        const laserData: any[] = [];
        const stalkData: any[] = [];
        const textData: any[] = [];
        const flightPathCoords: number[][] = [];

        const processDroneGeometry = (data: LiveDroneData, isLive: boolean, index?: number) => {
            const { latitude, longitude, heading, gimbalPitch, altitude } = data;

            const visualAltitude = altitude * altitudeScale;
            const droneCoord = [longitude, latitude, visualAltitude];
            const textCoord = [longitude, latitude, visualAltitude + 4];

            if (!isLive) {
                flightPathCoords.push(droneCoord);
            }

            // 1. Drone Body (ONLY FOR LIVE DRONE)
            if (isLive) {
                const sizeKm = 0.004;
                const n2D = turf.destination([longitude, latitude], sizeKm, heading, { units: 'kilometers' }).geometry.coordinates;
                const bl2D = turf.destination([longitude, latitude], sizeKm * 0.8, heading - 140, { units: 'kilometers' }).geometry.coordinates;
                const br2D = turf.destination([longitude, latitude], sizeKm * 0.8, heading + 140, { units: 'kilometers' }).geometry.coordinates;

                polygonData.push({
                    isLive,
                    polygon: [
                        [n2D[0], n2D[1], visualAltitude],
                        [br2D[0], br2D[1], visualAltitude],
                        [bl2D[0], bl2D[1], visualAltitude],
                        [n2D[0], n2D[1], visualAltitude]
                    ]
                });
            }

            // 2. Gimbal Laser Math
            const pitchRad = (gimbalPitch * Math.PI) / 180;
            const MAX_LASER_LENGTH = 500;

            let rayLength = MAX_LASER_LENGTH;
            if (gimbalPitch < 0) {
                const distanceToGround = altitude / Math.abs(Math.sin(pitchRad));
                rayLength = Math.min(MAX_LASER_LENGTH, Math.max(0, distanceToGround - 0.1));
            }

            const deltaZ = rayLength * Math.sin(pitchRad);
            const targetAlt = Math.max(0, altitude + deltaZ) * altitudeScale;
            const horizontalDist = rayLength * Math.cos(pitchRad);

            const targetCoord2D = turf.destination(
                [longitude, latitude],
                horizontalDist / 1000,
                heading,
                { units: 'kilometers' }
            ).geometry.coordinates;

            laserData.push({
                isLive,
                source: droneCoord,
                target: [targetCoord2D[0], targetCoord2D[1], targetAlt]
            });

            // 3. Altitude Stalk
            stalkData.push({
                source: droneCoord,
                target: [longitude, latitude, 0]
            });

            // 4. Labels (ONLY FOR WAYPOINTS)
            if (!isLive) {
                textData.push({
                    position: textCoord,
                    // text: `${(index || 0) ? (index || 0) + 1 : 'S'}`,
                    text: `${(index || 0) + 1}`,
                    isLive
                });
            }
        };

        waypoints.forEach((wp, index) => processDroneGeometry(wp as LiveDroneData, false, index));

        if (liveDroneData) {
            processDroneGeometry(liveDroneData, true);
        }

        return [
            // --- FLIGHT PATH LINE ---
            new PathLayer({
                id: 'flight-path',
                data: [{ path: flightPathCoords }],
                getPath: (d: any) => d.path,
                getColor: [255, 200, 0, 200],
                getWidth: 2,
                widthUnits: 'pixels'
            }),

            // --- GIMBAL LASERS ---
            new LineLayer({
                id: 'gimbal-lasers',
                data: laserData,
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: (d: any) => d.isLive ? [0, 255, 0, 255] : [255, 0, 0, 150],
                getWidth: (d: any) => d.isLive ? 3 : 1,
                widthUnits: 'pixels'
            }),

            // --- DRONE BODIES ---
            new PolygonLayer({
                id: 'drone-3d-bodies',
                data: polygonData,
                getPolygon: (d: any) => d.polygon,
                getFillColor: [0, 255, 0, 255], // Now only renders the live drone anyway
                extruded: false,
                wireframe: false
            }),

            // --- ALTITUDE STALKS ---
            new LineLayer({
                id: 'altitude-stalks',
                data: stalkData,
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: [255, 255, 255, 120],
                getWidth: 1,
                widthUnits: 'pixels'
            }),

            // --- WAYPOINT LABELS ---
            new TextLayer({
                id: 'drone-labels',
                data: textData,
                getPosition: (d: any) => d.position,
                getText: (d: any) => d.text,
                getSize: 14,
                getColor: [255, 255, 255, 255],
                getBackgroundColor: [0, 0, 0, 180],
                background: true,
                backgroundPadding: [4, 4],
                pixelOffset: [0, -20],
                billboard: true
            }),

            // 2. ADD THE ANNOTATION LAYER AT THE BOTTOM OF THE ARRAY
            new ScatterplotLayer({
                id: 'annotation-markers',
                data: annotations,
                getPosition: (d: Annotation) => [d.longitude, d.latitude, 1], // Z=0 clamps to ground
                getFillColor: (d: Annotation) => hexToRgb(d.color),
                // billboard: true,
                getRadius: 6,
                radiusUnits: 'pixels', // Stays the same size regardless of zoom
                stroked: true,
                getLineColor: [255, 255, 255, 0], // White border makes them pop
                lineWidthMinPixels: 1,
                pickable: true, // Useful if you want to add tooltips later
            }),

            new TextLayer({
                id: 'annotation-labels',
                data: annotations,
                getPosition: (d: Annotation) => [d.longitude, d.latitude, 10],
                getText: (d: Annotation) => d.name,
                getSize: 12,
                // Match the text color to the marker color
                getColor: (d: Annotation) => hexToRgb(d.color),
                getBackgroundColor: [0, 0, 0, 160],
                background: true,
                backgroundPadding: [4, 2],
                // Position the text to the RIGHT of the dot
                pixelOffset: [44, 30], 
                alignmentBaseline: 'center',
                getTextAnchor: 'start',
                billboard: true
            })
            
        ];
    }, [liveDroneData, waypoints, viewState.pitch]);

    const handleCompassClick = () => {
        setViewState(prev => ({ ...prev, bearing: 0, pitch: 0, transitionDuration: 100 }));
    };

    return (
        <div
            style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}
            onContextMenu={e => e.preventDefault()}
        >
            <DeckGL
                viewState={viewState}
                onViewStateChange={(e) => setViewState(e.viewState as ViewState)}
                controller={{
                    type: MiddleClickOrbitController,
                    dragPan: true,
                    scrollZoom: true,
                    dragRotate: true
                }}
                layers={layers}
            >
                <MapLibreMap
                    mapStyle={GOOGLE_SATELLITE_STYLE as any}
                    maplibreLogo={true}
                    maxZoom={22}
                />
            </DeckGL>

            <Compass rotation={viewState.bearing} onClick={handleCompassClick} />
        </div>
    );
}