/**
 * @fileoverview Text overlay management and accessible modal dialog controls.
 */

import { createId } from '../utils/ids.js';
import { validateTimeRange } from '../utils/validation.js';

/**
 * Creates a new text title overlay object with safe boundaries.
 * @param {string} text - Title text string.
 * @param {number} start - Start timestamp in seconds.
 * @param {number} [duration=4] - Duration of title in seconds.
 * @param {number} [maxDuration=Infinity] - Total timeline duration limit.
 * @returns {object} Text overlay object.
 */
export function createTextOverlay(text = 'CYBER TITLE', start = 0, duration = 4, maxDuration = Infinity) {
  const safeStart = Math.max(0, start);
  const safeEnd = isFinite(maxDuration) && maxDuration > 0
    ? Math.min(safeStart + duration, maxDuration)
    : safeStart + duration;

  return {
    id: createId('txt'),
    text: text.trim() || 'TITLE',
    start: safeStart,
    end: Math.max(safeStart + 0.5, safeEnd),
    fontSize: 28,
    color: '#ffffff',
    x: 50,
    y: 50
  };
}

/**
 * Updates a specific text overlay by ID in the texts array.
 * @param {Array<object>} texts - Current texts array.
 * @param {string} id - Identifier of the overlay to update.
 * @param {object} updates - Properties to merge.
 * @returns {{ success: boolean, texts: Array<object>, error?: string }}
 */
export function updateTextOverlay(texts, id, updates) {
  if (!Array.isArray(texts)) return { success: false, texts: [], error: 'Invalid texts collection.' };

  const target = texts.find(t => t.id === id);
  if (!target) return { success: false, texts, error: 'Text overlay not found.' };

  const newStart = typeof updates.start === 'number' ? updates.start : target.start;
  const newEnd = typeof updates.end === 'number' ? updates.end : target.end;

  const validation = validateTimeRange(newStart, newEnd);
  if (!validation.isValid) {
    return { success: false, texts, error: validation.error };
  }

  const updatedTexts = texts.map(t => {
    if (t.id === id) {
      return {
        ...t,
        ...updates,
        text: (updates.text !== undefined ? updates.text : t.text).trim() || 'TITLE',
        start: newStart,
        end: newEnd,
        fontSize: updates.fontSize || t.fontSize || 28,
        color: updates.color || t.color || '#ffffff',
        x: updates.x !== undefined ? updates.x : t.x,
        y: updates.y !== undefined ? updates.y : t.y
      };
    }
    return t;
  });

  return { success: true, texts: updatedTexts };
}

/**
 * Removes a text overlay by ID.
 * @param {Array<object>} texts - Current texts array.
 * @param {string} id - Identifier of overlay to delete.
 * @returns {Array<object>} Filtered texts array.
 */
export function removeTextOverlay(texts, id) {
  if (!Array.isArray(texts)) return [];
  return texts.filter(t => t && t.id !== id);
}

/**
 * Traps keyboard focus within an accessible modal container.
 * @param {HTMLElement} modalElement - The modal DOM element.
 * @param {KeyboardEvent} e - Keydown event.
 */
export function handleModalFocusTrap(modalElement, e) {
  if (e.key !== 'Tab') return;

  const focusable = modalElement.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const firstFocusable = /** @type {HTMLElement} */ (focusable[0]);
  const lastFocusable = /** @type {HTMLElement} */ (focusable[focusable.length - 1]);

  if (e.shiftKey) {
    if (document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    }
  } else {
    if (document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  }
}

