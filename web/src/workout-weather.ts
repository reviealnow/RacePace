import type { Workout } from './workout';

export type WeatherKind = 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';
export type WorkoutWeather = { code: number; kind: WeatherKind; timezone: string };

export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const shiftDate = (time: number, days: number) => isoDate(time + days * 86400000);

type WeatherResponse = {
  timezone?: string;
  hourly?: { time?: number[]; weather_code?: number[] };
};

async function query(endpoint: string, workout: Workout, signal: AbortSignal): Promise<WorkoutWeather | null> {
  const started = workout.points[0].time;
  const point = workout.points[0];
  // Weather grids do not benefit from precise GPS. About 1 km resolution avoids
  // transmitting the exact start point to the weather provider.
  const params = new URLSearchParams({
    latitude: point.lat.toFixed(2),
    longitude: point.lon.toFixed(2),
    start_date: shiftDate(started, -1),
    end_date: shiftDate(started, 1),
    hourly: 'weather_code',
    timezone: 'auto',
    timeformat: 'unixtime',
  });
  const response = await fetch(`${endpoint}?${params}`, { signal });
  if (!response.ok) return null;
  const data = await response.json() as WeatherResponse;
  const times = data.hourly?.time;
  const codes = data.hourly?.weather_code;
  if (!data.timezone || !times?.length || !codes || times.length !== codes.length) return null;
  const target = started / 1000;
  let closest = 0;
  for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - target) < Math.abs(times[closest] - target)) closest = i;
  const code = codes[closest];
  return Number.isFinite(code) ? { code, kind: weatherKind(code), timezone: data.timezone } : null;
}

export async function workoutWeather(workout: Workout, signal: AbortSignal): Promise<WorkoutWeather | null> {
  for (const endpoint of ['https://api.open-meteo.com/v1/forecast', 'https://archive-api.open-meteo.com/v1/archive']) {
    try {
      const result = await query(endpoint, workout, signal);
      if (result) return result;
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  return null;
}

export function workoutDateLabel(started: number, timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(started));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} · ${value('hour')}:${value('minute')}`;
}
