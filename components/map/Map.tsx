import React, { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import { LineLayer, PolygonLayer } from '@deck.gl/layers';
import { MapController } from 'deck.gl'; // <-- FIX: Pull directly from the installed package
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass } from '@/components/map/Compass';
import { LiveDroneData } from '@/utils/interfaces';

// --- THE EVENT HACK: Remapping Middle Click to Orbit ---
class MiddleClickOrbitController extends MapController {
    handleEvent(event: any) {
        // Intercept middle click
        if (event.middleButton || (event.srcEvent && event.srcEvent.buttons === 4)) {
            event.rightButton = true;   // Force orbit
            event.middleButton = false; // Kill the middle click
        }
        // FIX: Return the boolean to satisfy TypeScript and Deck.gl
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
            minzoom: 16,
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
        const droneCoord = [longitude, latitude, altitude];

        const sizeKm = 0.004; 
        const n2D = turf.destination([longitude, latitude], sizeKm, heading, { units: 'kilometers' }).geometry.coordinates;
        const bl2D = turf.destination([longitude, latitude], sizeKm * 0.8, heading - 140, { units: 'kilometers' }).geometry.coordinates;
        const br2D = turf.destination([longitude, latitude], sizeKm * 0.8, heading + 140, { units: 'kilometers' }).geometry.coordinates;
        
        const floatingPolygon = [
            [n2D[0], n2D[1], altitude],
            [br2D[0], br2D[1], altitude],
            [bl2D[0], bl2D[1], altitude],
            [n2D[0], n2D[1], altitude]
        ];

        const pitchRad = (gimbalPitch * Math.PI) / 180;
        const MAX_LASER_LENGTH = 500; 

        let rayLength = MAX_LASER_LENGTH;
        if (gimbalPitch < 0) {
            const distanceToGround = altitude / Math.abs(Math.sin(pitchRad));
            rayLength = Math.min(MAX_LASER_LENGTH, distanceToGround);
        }

        const deltaZ = rayLength * Math.sin(pitchRad); 
        const targetAlt = Math.max(0, altitude + deltaZ); 
        const horizontalDist = rayLength * Math.cos(pitchRad); 
        
        const targetCoord2D = turf.destination(
            [longitude, latitude],
            horizontalDist / 1000, 
            heading,
            { units: 'kilometers' }
        ).geometry.coordinates;

        const targetCoord3D = [targetCoord2D[0], targetCoord2D[1], targetAlt];

        return [
            new PolygonLayer({
                id: 'drone-3d-body',
                data: [{ polygon: floatingPolygon }],
                getPolygon: (d: any) => d.polygon,
                getFillColor: [0, 255, 0, 255], 
                extruded: false, 
                wireframe: false
            }),

            new LineLayer({
                id: 'gimbal-laser',
                data: [{ source: droneCoord, target: targetCoord3D }],
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: [0, 255, 0, 255],
                getWidth: 3,
                widthUnits: 'pixels'
            }),

            new LineLayer({
                id: 'altitude-stalk',
                data: [{ source: droneCoord, target: [longitude, latitude, 0] }],
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: [255, 0, 0, 180], 
                getWidth: 1,
                widthUnits: 'pixels'
            })
        ];
    }, [liveDroneData]);

    const handleCompassClick = () => {
        setViewState(prev => ({ ...prev, bearing: 0, pitch: 0, transitionDuration: 100 }));
    };

    return (
        <div 
            style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}
            // Keep this so the browser menu doesn't pop up if you accidentally right-click
            onContextMenu={e => e.preventDefault()} 
        >
            <DeckGL
                viewState={viewState}
                onViewStateChange={(e) => setViewState(e.viewState as ViewState)}
                controller={{ 
                    type: MiddleClickOrbitController, 
                    dragPan: true, 
                    scrollZoom: true, 
                    dragRotate: true, 
                    // FIX: Drop this to 85. Anything higher breaks panning math.
                    // maxPitch: 85,
                    // minZoom: 14,
                    // maxZoom: 22
                }} 
                layers={layers}
            >
                <MapLibreMap
                    mapStyle={GOOGLE_SATELLITE_STYLE as any}
                    maplibreLogo={true}
                />
            </DeckGL>

            <Compass rotation={viewState.bearing} onClick={handleCompassClick} />
        </div>
    );
}