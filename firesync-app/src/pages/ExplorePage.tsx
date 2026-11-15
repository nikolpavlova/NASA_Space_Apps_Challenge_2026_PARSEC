import { useCallback } from 'react';
import { ActivityHeatmap } from '../components/activity/ActivityHeatmap';
import { ActivityLegend } from '../components/activity/ActivityLegend';
import { FireMap } from '../components/map/FireMap';
import { SearchPanel } from '../components/search/SearchPanel';
import { ErrorState, LoadingState } from '../components/shared/States';
import { REGIONS } from '../data/regions';
import { useExploreFilters } from '../hooks/useExploreFilters';
import { useLocationSearch } from '../hooks/useLocationSearch';
import { ACTIVITY_UNIT, DEFAULT_PERIOD, EXPLORE_REGION, fetchActivityMatrix, fetchExploreObservations } from '../services/fireData';
import { useServiceQuery } from '../hooks/useServiceQuery';
import type { SearchMode } from '../types/fire';
import { MONTH_SHORT, monthLabel, toMonthKey } from '../utils/dates';
import { formatCount } from '../utils/formatters';
import shared from '../styles/shared.module.css';
import styles from './ExplorePage.module.css';

export function ExplorePage() {
  const { filters, setMode, setQuery, setLocation, togglePeriod, clearPeriod } = useExploreFilters();
  const search = useLocationSearch(setLocation);
  const unit = ACTIVITY_UNIT;
  const activity = useServiceQuery('explore-activity', fetchActivityMatrix);
  const cells = activity.data ?? [];
  // no month selected: show the default month so the map is never empty
  const shown = filters.selectedPeriod ?? DEFAULT_PERIOD;
  const shownKey = toMonthKey(shown.year, shown.month);
  const points = useServiceQuery(`explore-${shownKey}`, (signal) => fetchExploreObservations(shown, signal));
  const observations = points.data ?? [];
  const loadingPoints = points.status === 'loading' || points.isUpdating;
  const region = REGIONS.find((r) => r.id === EXPLORE_REGION)!;

  const changeMode = useCallback(
    (mode: SearchMode) => {
      setMode(mode);
      search.reset();
    },
    [setMode, search],
  );

  const period = filters.selectedPeriod;
  const years = [...new Set(cells.map((c) => c.year))].sort((a, b) => b - a);

  return (
    <main className={shared.page}>
      <h1 className="visually-hidden">Explore wildfire activity</h1>

      <SearchPanel
        mode={filters.mode}
        query={filters.query}
        loading={search.status === 'loading'}
        error={search.error}
        choices={search.choices}
        location={filters.selectedLocation}
        onModeChange={changeMode}
        onQueryChange={setQuery}
        onSubmit={() => search.search(filters.mode, filters.query)}
        onChoose={search.choose}
        onClearLocation={() => setLocation(null)}
      />

      <section className={styles.activity} aria-label="Fire activity calendar">
        {activity.status === 'error' && <ErrorState message={activity.error ?? ''} onRetry={activity.retry} />}
        {activity.status === 'loading' && <LoadingState label="Loading fire activity…" />}
        {activity.status === 'ready' && <ActivityHeatmap cells={cells} unit={unit} selected={period} onToggle={togglePeriod} />}
        <ActivityLegend />
      </section>

      <div className={styles.periodBar}>
        <p aria-live="polite">
          {points.status === 'error' ? (
            <>Map data could not be loaded: {points.error}</>
          ) : loadingPoints ? (
            <>Loading <strong>{monthLabel(shownKey)}</strong> detections…</>
          ) : period ? (
            <>
              Showing <strong>{monthLabel(shownKey)}</strong>: {formatCount(observations.length)} MODIS detections on the map.{' '}
              <button type="button" className={styles.linkButton} onClick={clearPeriod}>
                Back to July 2023
              </button>
            </>
          ) : (
            <>
              Showing <strong>{monthLabel(shownKey)}</strong>, the record fire season: {formatCount(observations.length)} MODIS
              detections on the map. Select a month above to see another.
            </>
          )}
        </p>
      </div>

      <FireMap
        className={styles.map}
        label="Wildfire map of British Columbia"
        observations={observations}
        bounds={region.bounds}
        cities={region.cities}
        focus={filters.selectedLocation}
      />

      <details className={shared.details}>
        <summary>View activity values as a table</summary>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <caption className="visually-hidden">Monthly {unit}</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                {MONTH_SHORT.map((m) => (
                  <th key={m} scope="col">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  {cells
                    .filter((c) => c.year === year)
                    .sort((a, b) => a.month - b.month)
                    .map((c) => (
                      <td key={c.month}>{formatCount(c.value)}</td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </main>
  );
}