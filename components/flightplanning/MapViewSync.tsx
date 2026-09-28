import { RefObject, useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { MapView } from '@/utils/interfaces';

// The three planning maps share one viewport: whichever is visible records where
// it is, and the next one to take over adopts that position. Held in a ref, so
// panning never re-renders the tabs.
export function MapViewSync({ isActive, viewRef }: { isActive: boolean; viewRef: RefObject<MapView | null> }) {
  const map = useMap();
  const isAdopting = useRef(false);

  useMapEvents({
    moveend: () => {
      // invalidateSize and setView both fire moveend synchronously while this
      // map is still catching up, and recording those would overwrite the
      // shared view with wherever this map happened to be sitting
      if (!isActive || isAdopting.current) return;

      const center = map.getCenter();
      viewRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() };
    },
  });

  useEffect(() => {
    if (!isActive) return;

    // Read the shared view up front — resizing the map below moves it
    const view = viewRef.current;

    // A hidden tab measures 0x0, so the map has to be re-measured before it can
    // be moved anywhere meaningful
    const timer = setTimeout(() => {
      isAdopting.current = true;
      map.invalidateSize();
      if (view) map.setView(view.center, view.zoom, { animate: false });
      isAdopting.current = false;
    }, 0);

    return () => clearTimeout(timer);
  }, [isActive, map, viewRef]);

  return null;
}
