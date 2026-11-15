from __future__ import annotations
import calendar

import numpy as np
import pandas as pd

from phase2.phase2_config import Phase2Config, load_config
from phase2.phase2_database import connect, store
from phase2.phase2_schema import columns_of

#   fire_calendar       year x month activity, raw and harmonized kept apart (view column)
#   seasonal_baselines  what a normal month looks like, from complete months of other years
#   fire_anomalies      how unusual each month is (percentile, z-score, class)
# months with unknown coverage (outage / sensor_unavailable) never count as 0 and are left
# out of baselines; partial months (days_in_range < days in month) are left out too.

CAL_COLS = columns_of('fire_calendar')
BASE_COLS = columns_of('seasonal_baselines')
ANOM_COLS = columns_of('fire_anomalies')
METRICS = ['n_detections', 'frp_sum_mw']
MIN_YEARS = 3          # fewer baseline years than this -> insufficient_history
KNOWN = ['observed', 'no_detections']


def load_monthly(region: str, db_path=None, demo=False, cfg: Phase2Config | None = None):
    """Monthly raw history (2.16), monthly harmonized history and fire events of a region."""
    cfg = cfg or load_config(demo_mode=demo)
    tables = ['historical_observations', 'historical_harmonized_activity', 'fire_events']
    with connect(db_path, demo, tables=tables) as con:
        raw = con.execute('''SELECT * FROM historical_observations
                             WHERE time_window = 'month' AND region = ? AND dataset_version = ?''',
                          [region, cfg.version('history')]).df()
        harm = con.execute('''SELECT * FROM historical_harmonized_activity
                              WHERE time_window = 'month' AND region = ? AND dataset_version = ?''',
                           [region, cfg.version('history')]).df()
        events = con.execute('SELECT event_id, first_seen_utc FROM fire_events '
                             'WHERE region = ? AND dataset_version = ?',
                             [region, cfg.version('events')]).df()
    return raw, harm, events


def _year_month(dates) -> pd.DataFrame:
    d = pd.to_datetime(pd.Series(dates))
    return pd.DataFrame({'year': d.dt.year.astype(int), 'month': d.dt.month.astype(int)})


def build_calendar(raw: pd.DataFrame, harm: pd.DataFrame, events: pd.DataFrame,
                   cfg: Phase2Config | None = None) -> pd.DataFrame:
    """fire_calendar rows: raw months per satellite + harmonized months per model run."""
    cfg = cfg or load_config()
    parts = []
    if not raw.empty:
        r = pd.concat([_year_month(raw['period_start']), raw.reset_index(drop=True)], axis=1)
        r['view'], r['model_run_id'] = 'raw_observed', ''
        if not events.empty:
            started = _year_month(pd.to_datetime(events['first_seen_utc'], utc=True).dt.tz_localize(None))
            counts = started.value_counts().rename('n_fire_events_started').reset_index()
            r = r.merge(counts, on=['year', 'month'], how='left')
            r['n_fire_events_started'] = r['n_fire_events_started'].fillna(0)
        else:
            r['n_fire_events_started'] = np.nan
        parts.append(r)
    if not harm.empty:
        h = pd.concat([_year_month(harm['period_start']), harm.reset_index(drop=True)], axis=1)
        h = h.rename(columns={'harmonized_frp_sum_mw': 'frp_sum_mw', 'n_units': 'n_detections'})
        h['sensor_family'], h['satellite'] = 'MODIS', 'harmonized'
        h['view'], h['coverage_state'] = 'harmonized_estimate', 'observed'
        h['days_in_range'], h['n_fire_events_started'] = np.nan, np.nan
        parts.append(h)
    if not parts:
        return pd.DataFrame(columns=CAL_COLS)
    out = pd.concat(parts, ignore_index=True)
    for col in ['days_in_range', 'n_detections', 'n_fire_events_started']:
        out[col] = pd.to_numeric(out[col]).astype('Int64')
    out['dataset_version'] = cfg.version('analytics')
    return out[CAL_COLS]


def _usable(cal: pd.DataFrame) -> pd.DataFrame:
    """Raw months with known coverage that are complete (all days of the month in range)."""
    raw = cal[(cal['view'] == 'raw_observed') & cal['coverage_state'].isin(KNOWN)].copy()
    days = [calendar.monthrange(y, m)[1] for y, m in zip(raw['year'], raw['month'])]
    return raw[raw['days_in_range'].astype(float).to_numpy() == np.array(days, float)]


def build_baselines(cal: pd.DataFrame, cfg: Phase2Config | None = None) -> pd.DataFrame:
    """seasonal_baselines rows: per region, satellite, calendar month and metric."""
    cfg = cfg or load_config()
    use = _usable(cal)
    rows = []
    for key, g in use.groupby(['region', 'sensor_family', 'satellite', 'month']):
        for metric in METRICS:
            v = g[metric].astype(float).dropna()
            if v.empty:
                continue
            rows.append(dict(zip(['region', 'sensor_family', 'satellite', 'month'], key),
                             metric=metric, n_years=len(v), first_year=int(g['year'].min()),
                             last_year=int(g['year'].max()), mean=v.mean(), median=v.median(),
                             std=v.std(ddof=1) if len(v) > 1 else np.nan,
                             p10=v.quantile(0.1), p90=v.quantile(0.9), min=v.min(), max=v.max()))
    out = pd.DataFrame(rows, columns=[c for c in BASE_COLS if c != 'dataset_version'])
    out['dataset_version'] = cfg.version('analytics')
    return out[BASE_COLS]


def anomaly_class(percentile: float, n_years: int) -> str:
    if n_years < MIN_YEARS or pd.isna(percentile):
        return 'insufficient_history'
    if percentile >= 90:
        return 'much_above_normal'
    if percentile >= 75:
        return 'above_normal'
    if percentile <= 10:
        return 'much_below_normal'
    if percentile <= 25:
        return 'below_normal'
    return 'normal'


def build_anomalies(cal: pd.DataFrame, cfg: Phase2Config | None = None) -> pd.DataFrame:
    """fire_anomalies rows: each usable month against the same month in all OTHER years."""
    cfg = cfg or load_config()
    use = _usable(cal)
    rows = []
    for key, g in use.groupby(['region', 'sensor_family', 'satellite', 'month']):
        for metric in METRICS:
            series = g.set_index('year')[metric].astype(float).dropna()
            for year, value in series.items():
                others = series.drop(year)
                n = len(others)
                pct = 100 * ((others < value).sum() + 0.5 * (others == value).sum()) / n if n else np.nan
                std = others.std(ddof=1) if n > 1 else np.nan
                rows.append(dict(zip(['region', 'sensor_family', 'satellite', 'month'], key),
                                 year=year, metric=metric, value=value, n_baseline_years=n,
                                 baseline_median=others.median() if n else np.nan,
                                 baseline_mean=others.mean() if n else np.nan, baseline_std=std,
                                 z_score=(value - others.mean()) / std if std and std > 0 else np.nan,
                                 percentile=pct, anomaly_class=anomaly_class(pct, n)))
    out = pd.DataFrame(rows, columns=[c for c in ANOM_COLS if c != 'dataset_version'])
    out['dataset_version'] = cfg.version('analytics')
    return out[ANOM_COLS]


def region_ranking(cal: pd.DataFrame, year: int, month: int | None = None,
                   metric='frp_sum_mw', satellite='all') -> pd.DataFrame:
    """Rank regions by activity in a year (or one month), raw observed view."""
    c = cal[(cal['view'] == 'raw_observed') & (cal['satellite'] == satellite) & (cal['year'] == year)]
    if month:
        c = c[c['month'] == month]
    out = c.groupby(['region', 'sensor_family'])[metric].sum().reset_index()
    out['rank'] = out.groupby('sensor_family')[metric].rank(ascending=False, method='min').astype(int)
    return out.sort_values(['sensor_family', 'rank']).reset_index(drop=True)


def event_summary(region: str, db_path=None, demo=False, cfg: Phase2Config | None = None) -> pd.DataFrame:
    """Per year and month: how many fire events started, how long and how strong they were."""
    cfg = cfg or load_config(demo_mode=demo)
    sql = '''
        SELECT year(first_seen_utc) AS year, month(first_seen_utc) AS month,
               COUNT(*) AS n_events,
               SUM(CASE WHEN sensors = 'MODIS,VIIRS' THEN 1 ELSE 0 END) AS n_seen_by_both,
               median(duration_hours) AS median_duration_hours,
               MAX(duration_hours) AS max_duration_hours,
               SUM(frp_sum_mw) AS frp_sum_mw, MAX(frp_max_mw) AS frp_max_mw
        FROM fire_events WHERE region = ? AND dataset_version = ?
        GROUP BY ALL ORDER BY year, month
    '''
    with connect(db_path, demo, tables=['fire_events']) as con:
        return con.execute(sql, [region, cfg.version('events')]).df()


def make_analytics(region=None, db_path=None, demo=False, cfg: Phase2Config | None = None,
                   save=True) -> dict:
    """Build calendar, baselines and anomalies from the saved history; save tables + Parquet."""
    cfg = cfg or load_config(demo_mode=demo)
    region = region or cfg.default_region
    raw, harm, events = load_monthly(region, db_path, demo, cfg)
    if raw.empty:
        raise RuntimeError('no monthly history: run phase2_history.py first')
    cal = build_calendar(raw, harm, events, cfg)
    out = {'fire_calendar': cal, 'seasonal_baselines': build_baselines(cal, cfg),
           'fire_anomalies': build_anomalies(cal, cfg)}
    if save:
        folder = cfg.output_dir('analytics', region)
        for table, df in out.items():
            store(df, table, db_path=db_path, demo=demo)
            df.to_parquet(folder / f'{table}.parquet', index=False)
        event_summary(region, db_path, demo, cfg).to_parquet(folder / 'event_summary.parquet', index=False)
        print(f'dashboard files: {folder}')
    return out


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Fire calendar, baselines and anomalies (Task 2.17)')
    parser.add_argument('--region', default=None)
    parser.add_argument('--demo', action='store_true')
    args = parser.parse_args()

    _out = make_analytics(args.region, demo=args.demo)
    _cal = _out['fire_calendar']
    print('\nfire calendar (all satellites per sensor + harmonized):')
    print(_cal[_cal['satellite'].isin(['all', 'harmonized'])][
        ['year', 'month', 'sensor_family', 'satellite', 'days_in_range', 'n_detections',
         'frp_sum_mw', 'n_fire_events_started']].round(1).to_string(index=False))
    print(f"\nbaseline rows: {len(_out['seasonal_baselines'])}, anomaly rows: {len(_out['fire_anomalies'])}")
    if not _out['fire_anomalies'].empty:
        print(_out['fire_anomalies']['anomaly_class'].value_counts().to_string())
    print('\nfire events per month:')
    print(event_summary(args.region or load_config().default_region, demo=args.demo).round(1).to_string(index=False))
