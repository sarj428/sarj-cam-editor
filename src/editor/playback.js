/**
 * @fileoverview Playback engine synchronizing HTMLVideoElement with timeline playhead.
 */

import { timelineToSourceTime, getTotalTimelineDuration } from './timeline.js';
import { getPlayheadTime, setPlayheadTime, setIsPlaying, getIsPlaying } from './state.js';

let animationFrameId = null;

/**
 * Starts timeline video playback loop.
 * @param {HTMLVideoElement} videoElement
 * @param {object} project - Current project state.
 * @param {Function} onFrame - Callback invoked every rendered frame.
 * @param {Function} onStateChange - Callback invoked when playback begins or pauses.
 */
export function startPlayback(videoElement, project, onFrame, onStateChange) {
  if (!project.videoBlob && !videoElement.src) return;

  setIsPlaying(true);
  if (onStateChange) onStateChange(true);

  const totalD = getTotalTimelineDuration(project.clips);
  let curTime = getPlayheadTime();

  // If at or past end, wrap to start
  if (curTime >= totalD) {
    curTime = 0;
    setPlayheadTime(0);
  }

  videoElement.currentTime = timelineToSourceTime(curTime, project.clips);
  videoElement.play().catch(err => {
    console.warn('[Playback] Play prevented by browser autoplay policy:', err);
    pausePlayback(videoElement, onStateChange);
  });

  const frameLoop = () => {
    if (!getIsPlaying()) return;

    const sTime = videoElement.currentTime;

    // Determine current timeline playhead position based on source time
    let accum = 0;
    let foundActive = false;

    for (const clip of project.clips) {
      if (sTime >= clip.start && sTime < clip.end) {
        setPlayheadTime(accum + (sTime - clip.start));
        foundActive = true;
        break;
      }
      accum += clip.duration;
    }

    if (!foundActive) {
      const totalDuration = getTotalTimelineDuration(project.clips);
      if (getPlayheadTime() >= totalDuration || videoElement.ended) {
        pausePlayback(videoElement, onStateChange);
        setPlayheadTime(totalDuration);
      } else {
        videoElement.currentTime = timelineToSourceTime(getPlayheadTime(), project.clips);
      }
    }

    if (onFrame) onFrame();
    animationFrameId = requestAnimationFrame(frameLoop);
  };

  animationFrameId = requestAnimationFrame(frameLoop);
}

/**
 * Pauses playback and cancels animation frame loop.
 * @param {HTMLVideoElement} videoElement
 * @param {Function} [onStateChange]
 */
export function pausePlayback(videoElement, onStateChange) {
  setIsPlaying(false);
  if (onStateChange) onStateChange(false);

  if (videoElement) {
    videoElement.pause();
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Seeks to target timestamp in seconds.
 * @param {number} targetTime
 * @param {HTMLVideoElement} videoElement
 * @param {object} project
 * @param {Function} onRenderFrame
 */
export function seekTimeline(targetTime, videoElement, project, onRenderFrame) {
  const totalD = getTotalTimelineDuration(project.clips);
  const clamped = Math.max(0, Math.min(targetTime, totalD));
  setPlayheadTime(clamped);

  if (videoElement) {
    videoElement.currentTime = timelineToSourceTime(clamped, project.clips);
  }

  if (onRenderFrame) onRenderFrame();
}
