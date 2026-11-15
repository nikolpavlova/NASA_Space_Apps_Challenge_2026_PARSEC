/**
 * Explore data adapter: real NASA FIRMS data from the PARSEC API (phase3/api.py).
 * MODIS is used because it is the only sensor covering every downloaded year (VIIRS starts in 2012).
 */
import type { ActivityCell, FireObservation, Period } from '../types/fire';
import { toMonthKey } from '../utils/dates';
import { type ApiObservation, getJson, toObservation } from './api';

export const IS_DEMO_DATA = false;
export const EXPLORE_REGION = 'british_columbia';
export const EXPLORE_SENSOR = 'MODIS';
export const ACTIVITY_UNIT = 'MODIS fire detections per month';
/** Shown when no month is selected: July 2023, the record fire season. */
export const DEFAULT_PERIOD: Period = { year: 2023, month: 7 };
/** Enough for every month in the data, so the map is never cut off part way through a month. */
const MAX_POINTS = 50000;

interface ApiActivityRow {
  year: number;
  month: number;
  detections: number;
}

/** Year x month detection counts; every downloaded year gets all 12 months (no row = 0 detections). */
export async function fetchActivityMatrix(signal?: AbortSignal): Promise<ActivityCell[]> {
  const rows = await getJson<ApiActivityRow[]>('/activity', { region: EXPLORE_REGION, sensor: EXPLORE_SENSOR }, signal);
  const byKey = new Map(rows.map((r) => [`${r.year}-${r.month}`, r.detections]));
  const years = [...new Set(rows.map((r) => r.year))];
  return years.flatMap((year) =>
    Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1, value: byKey.get(`${year}-${i + 1}`) ?? 0 })),
  );
}

/** All MODIS detections of one month for the map. */
export async function fetchExploreObservations(period: Period, signal?: AbortSignal): Promise<FireObservation[]> {
  const rows = await getJson<ApiObservation[]>(
    '/observations',
    { region: EXPLORE_REGION, month: toMonthKey(period.year, period.month), sensor: EXPLORE_SENSOR, limit: MAX_POINTS },
    signal,
  );
  return rows.map(toObservation);
}