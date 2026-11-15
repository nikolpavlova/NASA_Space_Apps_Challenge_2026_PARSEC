import { Bell, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import styles from './AppHeader.module.css';

const ROUTES = [
  { to: '/about', label: 'About' },
  { to: '/', label: 'Explore' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/compare', label: 'Compare' },
];

/** Destinations named in the designs that are not part of this prototype yet. */
const UNAVAILABLE = ['Download'];

export function AppHeader() {
  return (
    <header className={styles.header}>
      <NavLink to="/" className={styles.brand} aria-label="FireSync home">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.flame}>
          <path d="M12 2c1 3-1 5-2.500 6.500C8 10 7 11.500 7 14a5 5 0 0 0 10 0c0-2-1-3.500-2-5-.5 1.500-1.200 2-2 2.500.5-3-.2-6.500-1-9.500z" />
        </svg>
        <span>FireSync</span>
      </NavLink>

      <nav aria-label="Main" className={styles.nav}>
        {ROUTES.map((route) => (
          <NavLink
            key={route.to}
            to={route.to}
            end
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            {route.label}
          </NavLink>
        ))}
        {UNAVAILABLE.map((label) => (
          <span key={label} className={`${styles.link} ${styles.disabled}`} aria-disabled="true" title="Not available in this prototype yet">
            {label}
            <span className={styles.soon}>Soon</span>
          </span>
        ))}
      </nav>

      {/* Presentation only: there is no account or notification system in this prototype. */}
      <div className={styles.account} aria-hidden="true">
        <Bell size={22} />
        <span className={styles.avatar}>
          <UserRound size={20} />
        </span>
      </div>
    </header>
  );
}
