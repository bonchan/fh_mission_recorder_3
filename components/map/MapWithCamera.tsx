import React, { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView, FirstPersonView, View } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { LineLayer, PolygonLayer, PathLayer, TextLayer, ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
import { MapController } from 'deck.gl';
import * as turf from '@turf/turf';
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
        const pitchTransitionAngle = 30;
        const altitudeScale = Math.min(viewState.pitch / pitchTransitionAngle, 1);

        const polygonData: any[] = [];
        const laserData: any[] = [];
        const stalkData: any[] = [];
        const textData: any[] = [];
        const flightPathCoords: number[][] = [];

        // --- SHARED SATELLITE CONFIG ---
        // We reuse this config so we don't have to write the fetch interceptor twice
        const sharedTileProps = {
            data: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            minZoom: 0,
            maxZoom: 22,
            tileSize: 256,
            
            // Prevent 404s from crashing the map
            onTileError: () => true, 

            renderSubLayers: (props: any) => {
                // Quick cast to 'any' to avoid the TS bbox union error
                const { west, south, east, north } = props.tile.bbox as any;
                
                return new BitmapLayer(props, {
                    data: undefined,
                    image: props.data,
                    bounds: [west, south, east, north]
                });
            }
        };

        // --- PROBLEM 2 FIX: TWO SEPARATE TILE LAYERS ---
        const satelliteMain = new TileLayer({ id: 'google-satellite-main', ...sharedTileProps });
        const satelliteDrone = new TileLayer({ id: 'google-satellite-drone', ...sharedTileProps });


        const processDroneGeometry = (data: LiveDroneData, isLive: boolean, index?: number) => {
            const { latitude, longitude, heading, gimbalPitch, altitude } = data;

            const visualAltitude = altitude * altitudeScale;
            const droneCoord = [longitude, latitude, visualAltitude];
            const textCoord = [longitude, latitude, visualAltitude + 4];

            if (!isLive) flightPathCoords.push(droneCoord);

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

            stalkData.push({
                source: droneCoord,
                target: [longitude, latitude, 0]
            });

            if (!isLive) {
                textData.push({
                    position: textCoord,
                    text: `${(index || 0) + 1}`,
                    isLive
                });
            }
        };

        if (waypoints && waypoints.length > 0) {
            waypoints.forEach((wp, index) => processDroneGeometry(wp as LiveDroneData, false, index));
        }

        if (liveDroneData) {
            processDroneGeometry(liveDroneData, true);
        }

        return [
            // Inject both satellite layers at the bottom
            satelliteMain,
            satelliteDrone,

            new PathLayer({
                id: 'flight-path',
                data: [{ path: flightPathCoords }],
                getPath: (d: any) => d.path,
                getColor: [255, 200, 0, 200],
                getWidth: 2,
                widthUnits: 'pixels'
            }),

            new LineLayer({
                id: 'gimbal-lasers',
                data: laserData,
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: (d: any) => d.isLive ? [0, 255, 0, 255] : [255, 0, 0, 150],
                getWidth: (d: any) => d.isLive ? 3 : 1,
                widthUnits: 'pixels'
            }),

            new PolygonLayer({
                id: 'drone-3d-bodies',
                data: polygonData,
                getPolygon: (d: any) => d.polygon,
                getFillColor: [0, 255, 0, 255],
                extruded: false,
                wireframe: false
            }),

            new LineLayer({
                id: 'altitude-stalks',
                data: stalkData,
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: [255, 255, 255, 120],
                getWidth: 1,
                widthUnits: 'pixels'
            }),

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

            new ScatterplotLayer({
                id: 'annotation-markers',
                data: annotations || [],
                getPosition: (d: Annotation) => [d.longitude, d.latitude, 1],
                getFillColor: (d: Annotation) => hexToRgb(d.color),
                getRadius: 6,
                radiusUnits: 'pixels',
                stroked: true,
                getLineColor: [255, 255, 255, 0],
                lineWidthMinPixels: 1,
                pickable: true,
            }),

            new TextLayer({
                id: 'annotation-labels',
                data: annotations || [],
                getPosition: (d: Annotation) => [d.longitude, d.latitude, 10],
                getText: (d: Annotation) => d.name,
                getSize: 12,
                getColor: (d: Annotation) => hexToRgb(d.color),
                getBackgroundColor: [0, 0, 0, 160],
                background: true,
                backgroundPadding: [4, 2],
                pixelOffset: [44, 30], 
                alignmentBaseline: 'center',
                getTextAnchor: 'start',
                billboard: true
            })
        ];
    }, [liveDroneData, waypoints, annotations, viewState.pitch]);

    // --- DYNAMIC VIEWS CONFIGURATION ---
    const views: View[] = [
        new MapView({ id: 'main', controller: { type: MiddleClickOrbitController } })
    ];

    if (liveDroneData) {
        views.push(
            new FirstPersonView({
                id: 'drone-cam',
                x: 20,
                y: 'calc(100% - 620px)',
                width: 800,
                height: 600,
                clear: true,
                focalDistance: 100 
            })
        );
    }

    // --- MULTI-VIEW STATE MAPPING ---
    const layerViewState = {
        main: viewState,
        'drone-cam': {
            longitude: liveDroneData?.longitude || 0,
            latitude: liveDroneData?.latitude || 0,
            position: [0, 0, liveDroneData?.altitude || 0],
            bearing: liveDroneData?.heading || 0,
            
            // --- PROBLEM 1 FIX: PITCH INVERSION ---
            // FirstPersonView treats negative as down and positive as up.
            // If your drone outputs -90 for down but looks at the sky, we invert it!
            pitch: -(liveDroneData?.gimbalPitch || 0), 
            
            // --- PROBLEM 2 (PART B) FIX: ZOOM FALLBACK ---
            // The FPV camera needs a zoom level to tell the TileLayer how high-res 
            // the images should be downloaded. 18 is standard high definition!
            zoom: 18
        }
    };

    const handleCompassClick = () => {
        setViewState(prev => ({ ...prev, bearing: 0, pitch: 0, transitionDuration: 100 }));
    };

    return (
        <div
            style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}
            onContextMenu={e => e.preventDefault()}
        >
            <DeckGL
                views={views}
                viewState={layerViewState as any}
                onViewStateChange={(e) => {
                    if (e.viewId === 'main') {
                        setViewState(e.viewState as unknown as ViewState);
                    }
                }}
                layers={layers}

                // --- PROBLEM 2 (PART A) FIX: LAYER FILTERING ---
                // This stops the TileLayers from conflicting and culling each other's tiles.
                layerFilter={({ layer, viewport }) => {
                    // Isolate the base maps to their specific cameras
                    if (layer.id === 'google-satellite-main' && viewport.id !== 'main') return false;
                    if (layer.id === 'google-satellite-drone' && viewport.id !== 'drone-cam') return false;

                    // Everything else (lasers, points) renders in BOTH viewports
                    return true;
                }}
            />

            <Compass rotation={viewState.bearing} onClick={handleCompassClick} />

            {/* --- FPV UI FRAME --- */}
            {liveDroneData && (
                <div style={{
                    position: 'absolute',
                    bottom: 20, left: 20,
                    width: '800px', height: '600px',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        display: 'flex', justifyContent: 'space-between', 
                        padding: '4px 8px', background: 'rgba(0, 0, 0, 0.6)', 
                        fontSize: '11px', color: '#00ff00', fontFamily: 'monospace', fontWeight: 'bold'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff4444', animation: 'pulse 2s infinite' }} />
                            GIMBAL SIMULATION
                        </span>
                        <span>ALT: {Math.round(liveDroneData.altitude)}m</span>
                    </div>

                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: 14, height: 2, background: 'rgba(0,255,0,0.5)', transform: 'translate(-50%, -50%)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 14, background: 'rgba(0,255,0,0.5)', transform: 'translate(-50%, -50%)' }} />
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.3; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}