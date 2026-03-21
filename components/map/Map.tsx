import React, { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import { LineLayer, PolygonLayer } from '@deck.gl/layers';
import { MapController } from 'deck.gl';
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass } from '@/components/map/Compass';
import { LiveDroneData } from '@/utils/interfaces';

// --- THE EVENT HACK: Remapping Middle Click & Disabling Right Click ---
class MiddleClickOrbitController extends MapController {
    handleEvent(event: any) {
        // If the user is physically holding the Right Mouse Button, KILL the event
        if (event.rightButton && !(event.srcEvent && event.srcEvent.buttons === 4)) {
            event.rightButton = false;
            event.handled = true; // Tell DeckGL we took care of it (by doing nothing)
            return true;
        }
        // Intercept actual middle click and spoof it as a right click for the orbit engine
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
            minzoom: 1, //16,
            maxzoom: 22
        }
    ]
};

interface MapProps {
    initialCenter?: [number, number];
    initialZoom?: number;
    liveDroneData?: LiveDroneData;
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
    liveDroneData
}: MapProps) {
    const [viewState, setViewState] = useState<ViewState>({
        longitude: initialCenter[0],
        latitude: initialCenter[1],
        zoom: initialZoom,
        pitch: 0,
        bearing: 0
    });

    const layers = useMemo(() => {
        if (!liveDroneData) return [];

        const { latitude, longitude, heading, gimbalPitch, altitude } = liveDroneData;

        // --- Dynamic Altitude Scaling ---
        // Pitch is 0 when looking straight down. Let's make the drone fully rise 
        // to its true height by the time the camera hits 30 degrees of pitch.
        const pitchTransitionAngle = 30;
        const altitudeScale = Math.min(viewState.pitch / pitchTransitionAngle, 1);

        // All Z-coordinates will use this visual altitude instead of the raw altitude
        const visualAltitude = altitude * altitudeScale;
        const droneCoord = [longitude, latitude, visualAltitude];

        // 1. Drone Body
        const sizeKm = 0.004;
        const n2D = turf.destination([longitude, latitude], sizeKm, heading, { units: 'kilometers' }).geometry.coordinates;
        const bl2D = turf.destination([longitude, latitude], sizeKm * 0.8, heading - 140, { units: 'kilometers' }).geometry.coordinates;
        const br2D = turf.destination([longitude, latitude], sizeKm * 0.8, heading + 140, { units: 'kilometers' }).geometry.coordinates;

        const floatingPolygon = [
            [n2D[0], n2D[1], visualAltitude],
            [br2D[0], br2D[1], visualAltitude],
            [bl2D[0], bl2D[1], visualAltitude],
            [n2D[0], n2D[1], visualAltitude]
        ];

        // 2. Gimbal Laser Math
        const pitchRad = (gimbalPitch * Math.PI) / 180;
        const MAX_LASER_LENGTH = 500;

        let rayLength = MAX_LASER_LENGTH;
        if (gimbalPitch < 0) {
            const distanceToGround = altitude / Math.abs(Math.sin(pitchRad));
            rayLength = Math.min(MAX_LASER_LENGTH, Math.max(0, distanceToGround - 0.1));
        }

        const deltaZ = rayLength * Math.sin(pitchRad);
        // Scale the target altitude so the laser also flattens to the ground!
        const targetAlt = Math.max(0, altitude + deltaZ) * altitudeScale;
        const horizontalDist = rayLength * Math.cos(pitchRad);

        const targetCoord2D = turf.destination(
            [longitude, latitude],
            horizontalDist / 1000,
            heading,
            { units: 'kilometers' }
        ).geometry.coordinates;

        const targetCoord3D = [targetCoord2D[0], targetCoord2D[1], targetAlt];

        return [
            new LineLayer({
                id: 'gimbal-laser',
                data: [{ source: droneCoord, target: targetCoord3D }],
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: [0, 255, 0, 255],
                getWidth: 1,
                widthUnits: 'pixels'
            }),

            new PolygonLayer({
                id: 'drone-3d-body',
                data: [{ polygon: floatingPolygon }],
                getPolygon: (d: any) => d.polygon,
                getFillColor: [0, 255, 0, 100],
                extruded: false,
                wireframe: false
            }),

            new LineLayer({
                id: 'altitude-stalk',
                data: [{ source: droneCoord, target: [longitude, latitude, 0] }],
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: [255, 255, 255, 180],
                getWidth: 1,
                widthUnits: 'pixels'
            })
        ];
        // IMPORTANT: Add viewState.pitch to dependencies so it recalculates while orbiting
    }, [liveDroneData, viewState.pitch]);

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
                    // minZoom={16}
                    maxZoom={22}
                />
            </DeckGL>

            <Compass rotation={viewState.bearing} onClick={handleCompassClick} />
        </div>
    );
}