import { Calendar, ChevronDown, Globe } from 'lucide-react';
import { REGIONS } from '../../data/regions';
import { parseMonth, toMonthKey } from '../../utils/dates';
import shared from '../../styles/shared.module.css';

interface SelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export function RegionSelect({ id, value, onChange }: SelectProps) {
  return (
    <div>
    <label htmlFor={id} className={shared.fieldLabel}>
    Region
    </label>
    <div className={shared.selectWrap}>
    <Globe size={18} aria-hidden="true" />
    <select id={id} className={shared.select} value={value} onChange={(e) => onChange(e.target.value)}>
    {REGIONS.map((region) => (
      <option key={region.id} value={region.id}>
      {region.label}
      </option>
    ))}
    </select>
    <ChevronDown size={18} aria-hidden="true" />
    </div>
    </div>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
'July', 'August', 'September', 'October', 'November', 'December',
];

// years downloaded from NASA FIRMS (VIIRS only exists from 2012, so 2003 and 2010 are MODIS only)
const AVAILABLE_YEARS = [2024, 2023, 2021, 2018, 2017, 2010, 2003];

function availableMonthsForYear(_year: number): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

export function MonthSelect({ id, value, onChange }: SelectProps) {
  const { year, month } = parseMonth(value);
  const monthsForYear = availableMonthsForYear(year);

  const handleYearChange = (newYear: number) => {
    const months = availableMonthsForYear(newYear);
    // keep the same month if available, otherwise fall back to the first available
    const newMonth = months.includes(month) ? month : months[0];
    onChange(toMonthKey(newYear, newMonth));
  };

  const handleMonthChange = (newMonth: number) => {
    onChange(toMonthKey(year, newMonth));
  };

  return (
    <div>
    <span className={shared.fieldLabel}>Date</span>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
    <div className={shared.selectWrap}>
    <Calendar size={18} aria-hidden="true" />
    <select
    id={id}
    className={shared.select}
    value={month}
    onChange={(e) => handleMonthChange(Number(e.target.value))}
    aria-label="Month"
    >
    {monthsForYear.map((m) => (
      <option key={m} value={m}>
      {MONTH_NAMES[m - 1]}
      </option>
    ))}
    </select>
    <ChevronDown size={18} aria-hidden="true" />
    </div>
    <div className={shared.selectWrap}>
    <select
    id={`${id}-year`}
    className={shared.select}
    value={year}
    onChange={(e) => handleYearChange(Number(e.target.value))}
    aria-label="Year"
    >
    {AVAILABLE_YEARS.map((y) => (
      <option key={y} value={y}>
      {y}
      </option>
    ))}
    </select>
    <ChevronDown size={18} aria-hidden="true" />
    </div>
    </div>
    </div>
  );
}