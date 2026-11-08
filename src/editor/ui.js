/**
 * @fileoverview Editor UI helpers: status indicators, focus trap, responsive banner, and tilt.
 */

/**
 * Updates the editor header status badge.
 * @param {string} text - Status label (e.g. 'SYSTEM: ONLINE').
 * @param {'green'|'orange'|'pink'} [theme='green'] - Dot color theme.
 */
export function setStatusText(text, theme = 'green') {
  const statusText = document.querySelector('#editor-status .status-text');
  const statusDot = document.querySelector('#editor-status .status-dot');
  if (statusText) statusText.textContent = text;
  if (statusDot) statusDot.className = `status-dot ${theme}`;
}

/**
 * Toggles 'active' class on a collection of buttons matching a data attribute value.
 * @param {NodeListOf<Element>|Array<Element>} elements
 * @param {string} value
 * @param {string} dataAttr
 */
export function setActiveToggle(elements, value, dataAttr) {
  elements.forEach((btn) => {
    if (btn.getAttribute(`data-${dataAttr}`) === value) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Adds 3D parallax mouse tilt hover effect to an element.
 * @param {HTMLElement|null} el
 * @param {number} [strength=8]
 */
export function addTilt(el, strength = 8) {
  if (!el) return;
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    el.style.transform = `perspective(800px) rotateY(${dx * strength}deg) rotateX(${-dy * strength}deg) scale(1.01)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
}

/**
 * Sets up an accessible focus trap and Escape-to-close behavior for any modal dialog.
 * @param {HTMLElement} modalBackdrop - Modal backdrop container.
 * @param {HTMLElement} closeButton - Close button trigger.
 * @param {Function} onClose - Callback invoked when modal is dismissed.
 * @returns {() => void} Teardown cleanup function.
 */
export function setupAccessibleModal(modalBackdrop, closeButton, onClose) {
  const handleKeyDown = (e) => {
    if (
      modalBackdrop.classList.contains('hidden') ||
      modalBackdrop.getAttribute('aria-hidden') === 'true'
    ) {
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = modalBackdrop.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const first = /** @type {HTMLElement} */ (focusables[0]);
      const last = /** @type {HTMLElement} */ (focusables[focusables.length - 1]);

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  if (closeButton) closeButton.addEventListener('click', onClose);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Checks screen width and displays a friendly non-blocking banner if viewed on phone screens (< 768px).
 */
export function checkMobileResponsiveness() {
  const existing = document.getElementById('mobile-viewport-warning');
  if (window.innerWidth < 768) {
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'mobile-viewport-warning';
      banner.setAttribute('role', 'alert');
      banner.style.cssText = `
        background: #161e24;
        color: var(--color-cyan, #2ddbde);
        border-bottom: 2px solid var(--color-cyan, #2ddbde);
        padding: 8px 16px;
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        z-index: 1000;
      `;
      banner.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 16px;">devices</span>
        <span>Desktop or tablet view (>= 768px) is recommended for timeline editing.</span>
      `;
      document.body.prepend(banner);
    }
  } else {
    if (existing) existing.remove();
  }
}
