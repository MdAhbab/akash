// Global UI store: theme (Obsidian/Porcelain) + language + motion preference.
import { create } from 'zustand';

const stored = (k, d) => {
  try { return localStorage.getItem(k) ?? d; } catch { return d; }
};

const systemPrefersDark =
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const initialTheme = stored('qs-theme', systemPrefersDark ? 'dark' : 'dark'); // default dark

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#0A0A0C' : '#F6F4EF',
  );
}

export const useUI = create((set, get) => ({
  theme: initialTheme,
  lang: stored('qs-lang', 'en'),
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('qs-theme', theme); } catch { /* ignore */ }
    set({ theme });
  },
  setLang: (lang) => {
    try { localStorage.setItem('qs-lang', lang); } catch { /* ignore */ }
    set({ lang });
  },
  initTheme: () => applyTheme(get().theme),
}));
