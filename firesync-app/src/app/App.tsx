import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { LoadingState } from '../components/shared/States';
import shared from '../styles/shared.module.css';
import { AboutPage } from '../pages/AboutPage';

// Each page is its own chunk, so the charting code only loads where it is used.
const ExplorePage = lazy(() => import('../pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const ComparePage = lazy(() => import('../pages/ComparePage').then((m) => ({ default: m.ComparePage })));

export function App() {
  return (
    <>
      <AppHeader />
      <Suspense
        fallback={
          <div className={shared.page}>
            <LoadingState label="Loading page…" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<ExplorePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
