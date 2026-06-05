// [lat, lng] pairs
export type PolygonCoords = [number, number][];

export function isPointInPolygon(lat: number, lng: number, polygon: PolygonCoords): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export async function parseKMLPolygon(file: File): Promise<PolygonCoords | null> {
  const content = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) return null;

  const coordsEl =
    xmlDoc.querySelector('Polygon outerBoundaryIs LinearRing coordinates') ??
    xmlDoc.querySelector('Polygon LinearRing coordinates') ??
    xmlDoc.querySelector('Polygon coordinates');

  if (!coordsEl?.textContent) return null;
  return parseKMLCoordString(coordsEl.textContent);
}

export async function parseGeoJSONPolygon(file: File): Promise<PolygonCoords | null> {
  const content = await file.text();
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }

  const ring = findFirstRing(data);
  if (!ring) return null;
  // GeoJSON coords are [lng, lat]
  return ring.map(([lng, lat]: number[]) => [lat, lng] as [number, number]);
}

function findFirstRing(obj: any): number[][] | null {
  if (!obj) return null;
  if (obj.type === 'Polygon') return obj.coordinates?.[0] ?? null;
  if (obj.type === 'MultiPolygon') return obj.coordinates?.[0]?.[0] ?? null;
  if (obj.type === 'Feature') return findFirstRing(obj.geometry);
  if (obj.type === 'FeatureCollection') {
    for (const f of obj.features ?? []) {
      const r = findFirstRing(f);
      if (r) return r;
    }
  }
  return null;
}

function parseKMLCoordString(text: string): PolygonCoords {
  return text
    .trim()
    .split(/\s+/)
    .map(coord => {
      const parts = coord.split(',');
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      return [lat, lng] as [number, number];
    })
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
}
