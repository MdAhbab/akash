import { useUI } from '../store/ui.js';

// Animated sun -> storm toggle.
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useUI();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      className={`relative grid h-9 w-9 place-items-center rounded-full border border-hairline transition hover:border-line ${className}`}
      data-cursor
    >
      <svg width="16" height="16" viewBox="0 0 24 24" className="transition-transform duration-500" style={{ transform: dark ? 'rotate(0deg)' : 'rotate(180deg)' }}>
        {dark ? (
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
            fill="none"
            stroke="rgb(var(--accent-violet))"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        ) : (
          <g fill="none" stroke="rgb(var(--accent-magenta))" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
          </g>
        )}
      </svg>
    </button>
  );
}
