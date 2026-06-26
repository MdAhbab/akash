/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Mapped to CSS variables (themed in index.css) so dark/light swap is instant.
        base: 'rgb(var(--bg-base) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        ink: 'rgb(var(--text-primary) / <alpha-value>)',
        muted: 'rgb(var(--text-secondary) / <alpha-value>)',
        faint: 'rgb(var(--text-muted) / <alpha-value>)',
        line: 'var(--line-strong)',
        hairline: 'var(--line-subtle)',
        violet: 'rgb(var(--accent-violet) / <alpha-value>)',
        magenta: 'rgb(var(--accent-magenta) / <alpha-value>)',
        mint: 'rgb(var(--accent-mint) / <alpha-value>)',
        champagne: 'rgb(var(--champagne) / <alpha-value>)',
        // severity
        'sev-low': '#5FB587',
        'sev-medium': '#E0B23C',
        'sev-high': '#F0743A',
        'sev-critical': '#FF3B5C',
      },
      fontFamily: {
        display: ['"Clash Display"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        bn: ['"Hind Siliguri"', 'Satoshi', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        label: '0.14em',
      },
      maxWidth: {
        shell: '1440px',
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
        smooth: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      keyframes: {
        pulseCritical: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(255,59,92,0.5)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 0 8px rgba(255,59,92,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'pulse-critical': 'pulseCritical 1.8s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
