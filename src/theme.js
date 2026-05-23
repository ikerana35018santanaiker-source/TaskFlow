// ═══════════════════════════════════════════════════════════════
// TASKFLOW — Theme Manager
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'taskflow-theme';

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'dark';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme() {
  const saved = getTheme();
  setTheme(saved);
}
