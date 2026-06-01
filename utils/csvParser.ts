import { createLogger } from './logger';

const log = createLogger('csvParser');

export interface ParsedPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  description?: string;
}

export async function parseCSV(file: File): Promise<ParsedPoint[]> {
  const content = await file.text();
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file must have at least 2 rows (header + data)');
  }

  // Parse header and detect column indices
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());

  let latIndex = header.findIndex(h => h === 'lat' || h === 'latitude' || h === 'y');
  let lonIndex = header.findIndex(h => h === 'lon' || h === 'longitude' || h === 'lng' || h === 'x');
  let altIndex = header.findIndex(h => h === 'alt' || h === 'altitude' || h === 'elevation' || h === 'height' || h === 'z');
  let nameIndex = header.findIndex(h => h === 'name' || h === 'title' || h === 'label');
  let descIndex = header.findIndex(h => h === 'description' || h === 'desc' || h === 'remarks');

  if (latIndex === -1 || lonIndex === -1) {
    throw new Error('CSV must contain latitude and longitude columns (names: lat, latitude, lon, longitude, lng, x, y)');
  }

  const points: ParsedPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());

    const latitude = parseFloat(values[latIndex]);
    const longitude = parseFloat(values[lonIndex]);

    if (isNaN(latitude) || isNaN(longitude)) {
      log.warn(`Skipping row ${i + 1}: Invalid coordinates`);
      continue;
    }

    const altitude = altIndex !== -1 ? parseFloat(values[altIndex]) : undefined;
    const name = nameIndex !== -1 ? values[nameIndex] : `Point ${i}`;
    const description = descIndex !== -1 ? values[descIndex] : '';

    points.push({
      id: `csv_${i}`,
      name: name || `Point ${i}`,
      latitude,
      longitude,
      altitude: altitude !== undefined && !isNaN(altitude) ? altitude : undefined,
      description,
    });
  }

  log.info(`Parsed ${points.length} points from CSV`);
  return points;
}
