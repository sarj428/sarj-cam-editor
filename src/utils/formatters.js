/**
 * @fileoverview Formatting utility functions for time, durations, and byte sizes.
 * All functions are pure and suitable for unit testing.
 */

/**
 * Format time in seconds to "mm:ss.ms" display string (e.g. 01:23.45).
 * @param {number} sec - Time in seconds.
 * @returns {string} Formatted string.
 */
export function formatTime(sec) {
  if (typeof sec !== 'number' || isNaN(sec) || sec < 0) {
    return '00:00.00';
  }
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

/**
 * Format time in seconds to "m:ss" (e.g. 1:05 or 12:30).
 * @param {number} sec - Time in seconds.
 * @returns {string} Formatted short time string.
 */
export function formatShortTime(sec) {
  if (typeof sec !== 'number' || isNaN(sec) || sec < 0) {
    return '0:00';
  }
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a byte count into a human-readable size string (e.g. 12.34 MB).
 * @param {number} bytes - Number of bytes.
 * @returns {string} Formatted size string.
 */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${val} ${sizes[i]}`;
}

/**
 * Pad a number with leading zeroes to 2 digits.
 * @param {number} n - Number to pad.
 * @returns {string} Padded 2-digit string.
 */
export function padZero(n) {
  return String(Math.floor(n)).padStart(2, '0');
}
