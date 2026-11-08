/**
 * @fileoverview Accessible inline toast notification system replacing window.alert().
 */

/** @type {HTMLElement|null} */
let toastContainer = null;
let currentTimer = null;

/**
 * Creates or retrieves the singleton notification container element.
 * @returns {HTMLElement}
 */
function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'editor-toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-label', 'Editor Notifications');
    toastContainer.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Shows an inline notification toast in the UI.
 * @param {string} message - Message text to display.
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Severity level.
 * @param {number} [duration=4500] - Duration in ms before auto-dismissing.
 */
export function showNotification(message, type = 'info', duration = 4500) {
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.className = `editor-toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  const colorMap = {
    info: 'var(--color-cyan, #2ddbde)',
    success: '#10b981',
    warning: '#f59e0b',
    error: 'var(--color-accent-pink, #ec648c)'
  };
  const iconMap = {
    info: 'info',
    success: 'check_circle',
    warning: 'warning',
    error: 'error'
  };

  const accentColor = colorMap[type] || colorMap.info;
  const iconName = iconMap[type] || iconMap.info;

  toast.style.cssText = `
    background: #161e24;
    color: #ffffff;
    border: 2px solid ${accentColor};
    border-radius: 6px;
    padding: 12px 16px;
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    line-height: 1.5;
    box-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    pointer-events: auto;
    transition: opacity 0.25s ease, transform 0.25s ease;
    animation: toastSlideIn 0.25s ease-out;
  `;

  toast.innerHTML = `
    <span class="material-symbols-outlined" style="color: ${accentColor}; font-size: 20px; flex-shrink: 0; margin-top: 1px;">${iconName}</span>
    <div style="flex-grow: 1; word-break: break-word;">${message}</div>
    <button type="button" aria-label="Dismiss notification" style="background: transparent; border: none; color: #999; cursor: pointer; padding: 2px; margin-left: 6px; display: flex; align-items: center;">
      <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
    </button>
  `;

  const closeBtn = toast.querySelector('button');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };

  if (closeBtn) closeBtn.addEventListener('click', dismiss);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  container.appendChild(toast);
}
