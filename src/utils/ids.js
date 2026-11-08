/**
 * @fileoverview Unique ID generation utility.
 */

/**
 * Generates a unique alphanumeric identifier with timestamp.
 * Uses Math.random() + String.substring() and Date.now().
 * @param {string} [prefix='id'] - Optional prefix for the generated ID.
 * @returns {string} Unique identifier string.
 */
export function createId(prefix = 'id') {
  const rand = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${rand}_${Date.now()}`;
}
