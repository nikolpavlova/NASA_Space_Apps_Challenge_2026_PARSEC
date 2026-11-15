# FireSync

Wildfire data explorer with three pages: **Explore** (`/`), **Analytics** (`/analytics`) and **Compare** (`/compare`).
React + TypeScript + Vite, MapLibre GL JS for maps, Recharts for charts, CSS Modules for styling.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type check + production build
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
```

## Demo data

There is no backend yet. Every number, chart point and map point is **generated demo data**, labeled "Demo data"
in the UI. It is seeded, so it is identical on every reload.

- `src/data/demoModel.ts`: the seasonal model (activity by month and year).
- `src/data/demoSensors.ts`: per-sensor records shared by Analytics and Compare. California, August 2024 reproduces
  the design reference values exactly.
- `src/data/demoActivity.ts`, `src/data/demoFires.ts`: Explore heatmap values and map points.

## Connecting the backend

Components never import demo data directly; they go through the service adapters. Replace the bodies of these
functions with API calls and keep the return types:

| Page | Adapter | Return type |
| --- | --- | --- |
| Explore | `src/services/fireData.ts`, `src/services/geocoding.ts` | `ActivityCell[]`, `FireObservation[]`, `SelectedLocation[]` |
| Analytics | `src/services/analyticsService.ts` → `fetchAnalytics` | `AnalyticsResponse` |
| Compare | `src/services/comparisonService.ts` → `fetchComparison` | `ComparisonResponse` |

Set `isDemo: false` and a real `updatedAt` in the responses and the "Demo data" badges turn into update times.
Stale requests are already cancelled (`src/hooks/useServiceQuery.ts`).

Decisions still open before live data (see the `methodology` strings in the services): the anomaly baseline, what
"Total FRP" aggregates, how clusters are defined, and how the harmonized record is produced. The demo never sums
MODIS and VIIRS.

## Map imagery

The basemap defaults to Esri World Imagery raster tiles with attribution. Review the provider's terms before
production use, or point to another provider in `.env` (see `.env.example`):

```
VITE_SATELLITE_TILES=https://example.com/tiles/{z}/{x}/{y}.jpg
VITE_SATELLITE_ATTRIBUTION=© Example Imagery
```

If tiles fail to load, the map says so and still draws the fire points.

## Structure

```
src/
  app/App.tsx                 routes (pages are lazy-loaded)
  pages/                      ExplorePage, AnalyticsPage, ComparePage (+ CSS modules)
  components/layout/          AppHeader
  components/map/             FireMap (shared by all pages), controls, legend, popup, style
  components/search/          SearchPanel, SearchModeToggle
  components/activity/        ActivityHeatmap, ActivityLegend
  components/filters/         Region/Month selects, AnalyticsFilters
  components/metrics/         MetricsGrid
  components/charts/          FrpTimeChart, DetectionComparisonChart, ChartDataTable, ChartTooltip
  components/compare/         ComparisonToolbar, SensorMapCard, SensorTrendCard, ...
  hooks/                      data queries, synced map camera, search, reduced motion
  services/                   data adapters (demo now, API later)
  data/                       regions, sensor config, demo generators
  types/ utils/ styles/
```
