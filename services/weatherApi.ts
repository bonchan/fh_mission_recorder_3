import { createLogger } from '@/utils/logger';

const log = createLogger('weatherApi');

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// Keep in sync with the fields actually read off WeatherForecast['hourly'].
const HOURLY_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation_probability',
  'rain',
  'wind_speed_10m',
  'wind_speed_120m',
  'wind_gusts_10m',
  'visibility',
] as const;

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly_units: Record<string, string>;
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    rain: number[];
    wind_speed_10m: number[];
    wind_speed_120m: number[];
    wind_gusts_10m: number[];
    visibility: number[];
  };
}

export const weatherApi = {
  // timezone=auto lets Open-Meteo resolve the right local timezone for
  // whatever coordinates get passed in, instead of hardcoding one region.
  async getForecast(latitude: number, longitude: number, forecastDays = 1): Promise<WeatherForecast> {
    const url = `${BASE_URL}?latitude=${latitude}&longitude=${longitude}&hourly=${HOURLY_VARS.join(',')}&timezone=auto&forecast_days=${forecastDays}&wind_speed_unit=ms`;

    const response = await fetch(url);
    if (!response.ok) {
      log.error(`Open-Meteo request failed with status ${response.status}`, { latitude, longitude });
      throw new Error(`Open-Meteo request failed with status ${response.status}`);
    }

    return response.json();
  },

  // hourly.time entries are local timestamps (per timezone=auto) - find the
  // one closest to right now so callers can show "current" conditions out
  // of what is otherwise an hour-by-hour forecast array.
  findCurrentHourIndex(times: string[]): number {
    if (!times || times.length === 0) return -1;

    const now = Date.now();
    let bestIndex = -1;
    let bestDiff = Infinity;

    times.forEach((time, index) => {
      const diff = Math.abs(new Date(time).getTime() - now);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });

    return bestIndex;
  },
};
