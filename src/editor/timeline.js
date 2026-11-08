/**
 * @fileoverview Timeline calculation mathematics and DOM rendering helpers.
 * Calculation functions are pure and suitable for unit tests.
 */

import { formatShortTime } from '../utils/formatters.js';
import { createId } from '../utils/ids.js';

export const BASE_PIXELS_PER_SECOND = 15;

/**
 * Calculates total playback duration across all active video clip segments.
 * @param {Array<{ duration: number }>} clips - Array of clip objects.
 * @returns {number} Summed duration in seconds.
 */
export function getTotalTimelineDuration(clips) {
  if (!Array.isArray(clips) || clips.length === 0) return 0;
  return clips.reduce((sum, c) => sum + (c && typeof c.duration === 'number' ? c.duration : 0), 0);
}

/**
 * Maps a timeline scrubber position (in seconds) to the corresponding original video source timestamp.
 * @param {number} timelineTime - Scrubber timestamp in seconds.
 * @param {Array<{ start: number, end: number, duration: number }>} clips - Clip segments list.
 * @returns {number} Source video timestamp in seconds.
 */
export function timelineToSourceTime(timelineTime, clips) {
  if (!Array.isArray(clips) || clips.length === 0) return 0;
  let accum = 0;
  for (const clip of clips) {
    if (timelineTime >= accum && timelineTime <= accum + clip.duration) {
      return clip.start + (timelineTime - accum);
    }
    accum += clip.duration;
  }
  return clips[clips.length - 1].end;
}

/**
 * Maps a raw video source element timestamp to timeline scrubber position.
 * @param {number} sourceTime - Video element currentTime in seconds.
 * @param {Array<{ start: number, end: number, duration: number }>} clips - Clip segments list.
 * @returns {number} Timeline position in seconds.
 */
export function sourceToTimelineTime(sourceTime, clips) {
  if (!Array.isArray(clips) || clips.length === 0) return 0;
  let accum = 0;
  for (const clip of clips) {
    if (sourceTime >= clip.start && sourceTime <= clip.end) {
      return accum + (sourceTime - clip.start);
    }
    accum += clip.duration;
  }
  return accum;
}

/**
 * Splits an existing clip segment at the playhead position into two consecutive segments.
 * @param {Array<{ id: string, start: number, end: number, duration: number }>} clips - Clips array.
 * @param {number} playheadTime - Timeline split point in seconds.
 * @returns {{ success: boolean, clips?: Array<object>, error?: string }}
 */
export function splitClipAtTime(clips, playheadTime) {
  if (!Array.isArray(clips) || clips.length === 0) {
    return { success: false, error: 'No clips available to split.' };
  }

  let accum = 0;
  let targetIndex = -1;
  let targetClip = null;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (playheadTime > accum && playheadTime < accum + clip.duration) {
      targetClip = clip;
      targetIndex = i;
      break;
    }
    accum += clip.duration;
  }

  if (!targetClip || targetIndex === -1) {
    return {
      success: false,
      error: 'Cannot split at clip boundary. Position playhead inside a clip block.'
    };
  }

  const offset = playheadTime - accum;
  const clip1 = {
    id: createId('clip'),
    start: targetClip.start,
    end: targetClip.start + offset,
    duration: offset
  };

  const clip2 = {
    id: createId('clip'),
    start: targetClip.start + offset,
    end: targetClip.end,
    duration: targetClip.duration - offset
  };

  const newClips = [...clips];
  newClips.splice(targetIndex, 1, clip1, clip2);
  return { success: true, clips: newClips };
}

/**
 * Deletes a clip segment by ID.
 * @param {Array<{ id: string }>} clips - Array of clips.
 * @param {string} clipId - ID of clip to remove.
 * @returns {Array<object>} New clips array with segment removed.
 */
export function deleteClipSegment(clips, clipId) {
  if (!Array.isArray(clips)) return [];
  return clips.filter((c) => c && c.id !== clipId);
}

/**
 * Computes pixels per second based on zoom level.
 * @param {number} zoomLevel - Zoom multiplier (1 to 5).
 * @param {number} [basePps=BASE_PIXELS_PER_SECOND] - Base pixels per second.
 * @returns {number}
 */
export function getPixelsPerSecond(zoomLevel, basePps = BASE_PIXELS_PER_SECOND) {
  return basePps * Math.max(1, Math.min(5, zoomLevel));
}

/**
 * Computes ruler tick intervals based on zoom level and duration.
 * @param {number} duration - Total timeline duration.
 * @param {number} zoomLevel - Current zoom factor.
 * @returns {Array<{ time: number, isMajor: boolean, label: string }>}
 */
export function generateRulerTicks(duration, zoomLevel) {
  if (duration <= 0) return [];
  let step = 1;
  if (zoomLevel < 1.5) step = 5;
  if (zoomLevel < 0.8) step = 10;

  const ticks = [];
  for (let t = 0; t <= duration; t += step) {
    const isMajor = t % 5 === 0;
    ticks.push({
      time: t,
      isMajor,
      label: isMajor ? formatShortTime(t) : ''
    });
  }
  return ticks;
}
