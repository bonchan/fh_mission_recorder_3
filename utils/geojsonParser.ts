import { createLogger } from './logger';

const log = createLogger('geojsonParser');

export interface ParsedPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  description?: string;
}

export async function parseGeoJSON(file: File): Promise<ParsedPoint[]> {
  const content = await file.text();
  const geojson = JSON.parse(content);

  if (!geojson.type || !geojson.features) {
    throw new Error('Invalid GeoJSON format');
  }

  const points: ParsedPoint[] = [];

  geojson.features.forEach((feature: any, index: number) => {
    const geometry = feature.geometry;
    const properties = feature.properties || {};
    const name = properties.name || properties.title || `Point ${index + 1}`;
    const description = properties.description || '';

    if (!geometry || !geometry.coordinates) return;

    let latitude: number;
    let longitude: number;
    let altitude: number | undefined;

    // Handle different geometry types
    if (geometry.type === 'Point') {
      [longitude, latitude, altitude] = geometry.coordinates;
    } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
      const coords = geometry.coordinates[0] || geometry.coordinates;
      [longitude, latitude, altitude] = coords;
    } else if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0]?.[0];
      if (!coords) return;
      [longitude, latitude, altitude] = coords;
    } else {
      return;
    }

    if (!isNaN(latitude) && !isNaN(longitude)) {
      points.push({
        id: `geojson_${index}`,
        name,
        latitude,
        longitude,
        altitude,
        description,
      });
    }
  });

  log.info(`Parsed ${points.length} points from GeoJSON`);
  return points;
}
