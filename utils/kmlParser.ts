import { createLogger } from './logger';

const log = createLogger('kmlParser');

export interface ParsedPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  description?: string;
}

export async function parseKML(file: File): Promise<ParsedPoint[]> {
  const content = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid KML file');
  }

  const points: ParsedPoint[] = [];
  const placemarks = xmlDoc.getElementsByTagName('Placemark');

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = placemark.getElementsByTagName('name')[0]?.textContent || `Point ${i + 1}`;
    const description = placemark.getElementsByTagName('description')[0]?.textContent;

    // Try Point first, then LineString coordinates
    let coordText =
      placemark.getElementsByTagName('Point')[0]?.getElementsByTagName('coordinates')[0]?.textContent ||
      placemark.getElementsByTagName('LineString')[0]?.getElementsByTagName('coordinates')[0]?.textContent ||
      placemark.getElementsByTagName('Polygon')[0]?.getElementsByTagName('LinearRing')[0]?.getElementsByTagName('coordinates')[0]?.textContent;

    if (!coordText) continue;

    const coords = coordText.trim().split('\n')[0].split(',');
    const longitude = parseFloat(coords[0]);
    const latitude = parseFloat(coords[1]);
    const altitude = coords[2] ? parseFloat(coords[2]) : undefined;

    if (!isNaN(latitude) && !isNaN(longitude)) {
      points.push({
        id: `kml_${i}`,
        name,
        latitude,
        longitude,
        altitude,
        description,
      });
    }
  }

  log.info(`Parsed ${points.length} points from KML`);
  return points;
}
