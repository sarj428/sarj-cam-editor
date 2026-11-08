/**
 * @fileoverview Validation utilities for video files, time ranges, and JSON configurations.
 * All functions are pure and return standard { isValid: boolean, error?: string } objects.
 */

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB limit

/**
 * Validates a video file object against type and size limits.
 * @param {File|Blob|null|undefined} file - File object to validate.
 * @param {number} [maxSizeBytes=MAX_VIDEO_SIZE_BYTES] - Maximum allowed size in bytes.
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateVideoFile(file, maxSizeBytes = MAX_VIDEO_SIZE_BYTES) {
  if (!file) {
    return { isValid: false, error: 'No file selected. Please choose a video file.' };
  }

  const isVideoMime = typeof file.type === 'string' && file.type.startsWith('video/');
  const fileName = file && file.name ? file.name : '';
  const hasVideoExtension = /\.(mp4|webm|mov|ogg|mkv|m4v)$/i.test(fileName);

  if (!isVideoMime && !hasVideoExtension) {
    return {
      isValid: false,
      error: `Unsupported format "${file.type || 'unknown'}". Please select an MP4, WebM, or MOV video file.`
    };
  }

  if (typeof file.size === 'number' && file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `File is too large (${sizeMb} MB). Maximum supported file size is ${limitMb} MB.`
    };
  }

  return { isValid: true };
}

/**
 * Validates start and end timestamps for clips and text titles.
 * @param {number} start - Start time in seconds.
 * @param {number} end - End time in seconds.
 * @param {number} [maxDuration=Infinity] - Total timeline duration limit.
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateTimeRange(start, end, maxDuration = Infinity) {
  if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) {
    return { isValid: false, error: 'Timestamps must be valid numbers.' };
  }
  if (start < 0) {
    return { isValid: false, error: 'Start time cannot be negative.' };
  }
  if (end <= start) {
    return { isValid: false, error: 'End time must be greater than start time.' };
  }
  if (isFinite(maxDuration) && maxDuration > 0 && start >= maxDuration) {
    return {
      isValid: false,
      error: `Start time (${start.toFixed(1)}s) cannot exceed total duration (${maxDuration.toFixed(1)}s).`
    };
  }
  return { isValid: true };
}

/**
 * Validates imported project JSON schema.
 * @param {unknown} config - Parsed JSON object.
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateProjectJson(config) {
  if (!config || typeof config !== 'object') {
    return { isValid: false, error: 'Invalid JSON file: file content must be a JSON object.' };
  }

  const obj = /** @type {Record<string, unknown>} */ (config);
  if (!obj.sarjcam_project) {
    return {
      isValid: false,
      error: 'Invalid project file: missing SARJ-CAM project signature header.'
    };
  }

  if (!Array.isArray(obj.clips)) {
    return { isValid: false, error: 'Corrupt project file: clips array is missing.' };
  }

  return { isValid: true };
}
