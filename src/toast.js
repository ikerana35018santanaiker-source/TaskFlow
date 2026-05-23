// ═══════════════════════════════════════════════════════════════
// TASKFLOW — Toast Notifications
// ═══════════════════════════════════════════════════════════════

const container = document.getElementById('toast-container');

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠'
};

let toastCount = 0;

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - ms
 */
export function showToast(message, type = 'info', duration = 4000) {
  if (!message) return;

  const id = ++toastCount;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.id = `toast-${id}`;
  toast.innerHTML = `
    <span class="toast-icon">${ICONS[type]}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Cerrar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  // Auto remove
  const timer = setTimeout(() => removeToast(toast), duration);
  toast.dataset.timer = timer;

  return id;
}

function removeToast(toast) {
  if (!toast || toast.classList.contains('toast-exit')) return;
  clearTimeout(Number(toast.dataset.timer));
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  setTimeout(() => toast.remove(), 400); // fallback
}

// Convenience wrappers
export const toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  error: (msg, d) => showToast(msg, 'error', d),
  info: (msg, d) => showToast(msg, 'info', d),
  warning: (msg, d) => showToast(msg, 'warning', d),
};
