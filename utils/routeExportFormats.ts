import { RoutePoint } from './routeOptimizer';
import { Route } from './routeSplitter';
import { createLogger } from './logger';

const log = createLogger('routeExportFormats');

/**
 * Export routes as CSV format
 * Similar to QGIS output: Ruta, Activo, Distancia_km
 */
export function exportRoutesAsCSV(routes: Route[], filename: string = 'routes'): string {
  const rows: string[] = [];
  
  // Header
  rows.push('Ruta,Punto,Orden,Distancia_km,Latitud,Longitud,Altitud');
  
  // Data
  routes.forEach((route, routeIdx) => {
    route.points.forEach((point, pointIdx) => {
      rows.push([
        `${filename}-${routeIdx + 1}`,
        point.name,
        pointIdx + 1,
        route.totalDistance.toFixed(2),
        point.latitude.toFixed(6),
        point.longitude.toFixed(6),
        (point.altitude || 0).toFixed(1),
      ].join(','));
    });
  });
  
  return rows.join('\n');
}

/**
 * Export routes as GeoJSON with LineString for each route
 */
export function exportRoutesAsGeoJSON(routes: Route[], projectName: string = 'Routes'): string {
  const features: any[] = [];
  
  // Create LineString features for each route
  routes.forEach((route, routeIdx) => {
    const coordinates = route.points.map(p => [p.longitude, p.latitude, p.altitude || 0]);
    
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {
        route_id: `${projectName}-${routeIdx + 1}`,
        distance_km: route.totalDistance,
        points_count: route.pointCount,
      },
    });
    
    // Create Point features for each waypoint
    route.points.forEach((point, pointIdx) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.longitude, point.latitude, point.altitude || 0],
        },
        properties: {
          route_id: `${projectName}-${routeIdx + 1}`,
          point_name: point.name,
          point_order: pointIdx + 1,
          distance_km: route.totalDistance,
        },
      });
    });
  });
  
  const geojson = {
    type: 'FeatureCollection',
    name: projectName,
    features,
  };
  
  return JSON.stringify(geojson, null, 2);
}

/**
 * Export routes as KML format (waypoints)
 * Creates separate KML for each route with waypoints
 */
export function exportRouteAsKML(route: Route, routeIndex: number, projectName: string = 'Routes'): string {
  const placemarks = route.points
    .map((point, idx) => `
    <Placemark>
      <name>${point.name}</name>
      <description>Waypoint ${idx + 1} - ${point.description || ''}</description>
      <Point>
        <coordinates>${point.longitude},${point.latitude},${point.altitude || 0}</coordinates>
      </Point>
    </Placemark>`)
    .join('\n');

  const lineString = route.points
    .map(p => `${p.longitude},${p.latitude},${p.altitude || 0}`)
    .join(' ');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${projectName}-Ruta${routeIndex + 1}</name>
    <description>Route ${routeIndex + 1} - ${route.pointCount} waypoints, ${route.totalDistance.toFixed(2)} km</description>
    <Style id="linestyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2</width>
      </LineStyle>
    </Style>
    <Folder>
      <name>Waypoints</name>
      ${placemarks}
    </Folder>
    <Folder>
      <name>Route Path</name>
      <Placemark>
        <name>Route ${routeIndex + 1}</name>
        <styleUrl>#linestyle</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${lineString}</coordinates>
        </LineString>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

  return kml;
}

/**
 * Export all routes as a single KML document
 */
export function exportAllRoutesAsKML(routes: Route[], projectName: string = 'Routes'): string {
  const folders = routes
    .map((route, routeIdx) => {
      const placemarks = route.points
        .map((point, idx) => `
        <Placemark>
          <name>${point.name}</name>
          <description>Route ${routeIdx + 1} - Waypoint ${idx + 1}</description>
          <Point>
            <coordinates>${point.longitude},${point.latitude},${point.altitude || 0}</coordinates>
          </Point>
        </Placemark>`)
        .join('\n');

      const lineString = route.points
        .map(p => `${p.longitude},${p.latitude},${p.altitude || 0}`)
        .join(' ');

      return `
    <Folder>
      <name>Route ${routeIdx + 1}</name>
      <description>${route.pointCount} waypoints, ${route.totalDistance.toFixed(2)} km</description>
      <Folder>
        <name>Waypoints</name>
        ${placemarks}
      </Folder>
      <Placemark>
        <name>Path</name>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${lineString}</coordinates>
        </LineString>
      </Placemark>
    </Folder>`;
    })
    .join('\n');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${projectName}</name>
    <description>${routes.length} routes, ${routes.reduce((sum, r) => sum + r.pointCount, 0)} total waypoints</description>
    <Style id="linestyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>2</width>
      </LineStyle>
    </Style>
    ${folders}
  </Document>
</kml>`;

  return kml;
}

/**
 * Download content as file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  log.info(`Downloaded: ${filename}`);
}

/**
 * Batch download multiple files
 */
export function downloadRoutes(routes: Route[], projectName: string = 'Routes'): void {
  try {
    // 1. Download CSV
    const csv = exportRoutesAsCSV(routes, projectName);
    downloadFile(csv, `${projectName}.csv`, 'text/csv');

    // 2. Download combined GeoJSON
    const geojson = exportRoutesAsGeoJSON(routes, projectName);
    downloadFile(geojson, `${projectName}.geojson`, 'application/geo+json');

    // 3. Download combined KML
    const kml = exportAllRoutesAsKML(routes, projectName);
    downloadFile(kml, `${projectName}.kml`, 'application/vnd.google-earth.kml+xml');

    // 4. Download individual route KMLs
    routes.forEach((route, idx) => {
      const routeKML = exportRouteAsKML(route, idx, projectName);
      downloadFile(routeKML, `${projectName}`, 'application/vnd.google-earth.kml+xml');
    });

    log.info(`Batch downloaded ${routes.length} routes`);
  } catch (err) {
    log.error('Download error:', err);
    throw err;
  }
}
