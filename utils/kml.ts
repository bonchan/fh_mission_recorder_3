import { PolygonGeometry } from '@/utils/interfaces';

// Pulls the first <Polygon> ring out of a KML file. Good enough for a simple
// fence/AOI export — doesn't handle MultiGeometry, inner holes, or non-polygon KML.
export function parseKmlPolygon(kmlText: string): PolygonGeometry | null {
  const doc = new DOMParser().parseFromString(kmlText, 'text/xml');

  if (doc.querySelector('parsererror')) return null;

  const coordsEl =
    doc.querySelector('Polygon outerBoundaryIs LinearRing coordinates') ||
    doc.querySelector('coordinates');

  if (!coordsEl?.textContent) return null;

  const ring = coordsEl.textContent
    .trim()
    .split(/\s+/)
    .map(pair => {
      const [lon, lat] = pair.split(',').map(Number);
      return [lon, lat];
    })
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));

  if (ring.length < 3) return null;

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

  return { type: 'Polygon', coordinates: [ring] };
}
