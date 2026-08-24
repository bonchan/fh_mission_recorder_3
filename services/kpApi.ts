import { createLogger } from '@/utils/logger';

const log = createLogger('kpApi');

const URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export interface KpEntry {
  timeTag: string; // as reported by NOAA, e.g. "2026-07-23T15:00:00" (UTC, no offset marker)
  kp: number;
  aRunning: number | null;
  stationCount: number | null;
}

// NOAA gives "yyyy-MM-ddTHH:mm:ss" with no timezone marker. A date-time
// string with no offset is parsed as LOCAL time by `Date`, but these values
// are UTC, so `Z` has to be appended to get correct results.
function toDate(timeTag: string): Date {
  return new Date(`${timeTag}Z`);
}

export const kpApi = {
  async getPlanetaryKIndex(): Promise<KpEntry[]> {
    const response = await fetch(URL);
    if (!response.ok) {
      log.error(`NOAA Kp request failed with status ${response.status}`);
      throw new Error(`NOAA Kp request failed with status ${response.status}`);
    }

    // Response is a plain array of objects, e.g.
    // { "time_tag": "2026-07-23T15:00:00", "Kp": 2.67, "a_running": 12, "station_count": 8 }
    const entries: any[] = await response.json();

    return entries.map(entry => ({
      timeTag: entry.time_tag,
      kp: Number(entry.Kp),
      aRunning: entry.a_running != null ? Number(entry.a_running) : null,
      stationCount: entry.station_count != null ? Number(entry.station_count) : null,
    }));
  },

  // Entries land ~3 hours apart - find whichever one is actually current,
  // same idea as weatherApi.findCurrentHourIndex.
  findCurrentIndex(entries: KpEntry[]): number {
    if (!entries || entries.length === 0) return -1;

    const now = Date.now();
    let bestIndex = -1;
    let bestDiff = Infinity;

    entries.forEach((entry, index) => {
      const diff = Math.abs(toDate(entry.timeTag).getTime() - now);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });

    return bestIndex;
  },

  formatTime(timeTag: string): string {
    return toDate(timeTag).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  // Entries whose local calendar day matches today - the API returns entries
  // spanning several days, and timeTag is UTC, so "today" is judged after
  // converting to the viewer's local time, not by matching the UTC date.
  getTodayEntries(entries: KpEntry[]): KpEntry[] {
    const now = new Date();
    return entries.filter(entry => {
      const entryDate = toDate(entry.timeTag);
      return entryDate.getFullYear() === now.getFullYear()
        && entryDate.getMonth() === now.getMonth()
        && entryDate.getDate() === now.getDate();
    });
  },
};
