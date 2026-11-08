/**
 * @fileoverview Offline canvas video rendering engine using HTMLCanvasElement.captureStream and MediaRecorder.
 */

import { computeLetterbox } from './canvasRenderer.js';
import { getCssFilterString, renderScanlines } from './filters.js';
import { drawTextOverlays } from './canvasRenderer.js';
import { getTotalTimelineDuration, timelineToSourceTime, sourceToTimelineTime } from './timeline.js';

/**
 * Checks whether the current browser supports HTML5 Canvas video export.
 * @returns {{ supported: boolean, error?: string }}
 */
export function checkRenderSupport() {
  if (typeof window === 'undefined') {
    return { supported: false, error: 'Window environment not available.' };
  }

  const canvas = document.createElement('canvas');
  const hasCaptureStream = typeof canvas.captureStream === 'function' ||
                           // @ts-ignore
                           typeof canvas.mozCaptureStream === 'function';

  if (!hasCaptureStream) {
    return {
      supported: false,
      error: 'Canvas captureStream API is not supported in this browser. Please use Chrome, Edge, or Firefox.'
    };
  }

  if (typeof window.MediaRecorder === 'undefined') {
    return {
      supported: false,
      error: 'MediaRecorder API is not supported in this browser. Video export is unavailable.'
    };
  }

  return { supported: true };
}

/**
 * Detects the highest quality supported WebM mime type on current platform.
 * @returns {string}
 */
export function getSupportedVideoMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

/**
 * Starts the offline canvas video render recording process.
 * @param {object} params
 * @param {HTMLCanvasElement} params.exportCanvas
 * @param {HTMLVideoElement} params.videoElement
 * @param {object} params.project
 * @param {Function} params.onProgress - (percent: number) => void
 * @param {Function} params.onComplete - (blobUrl: string) => void
 * @param {Function} params.onError - (err: Error) => void
 * @returns {{ abort: () => void }}
 */
export function startExportRender({
  exportCanvas,
  videoElement,
  project,
  onProgress,
  onComplete,
  onError
}) {
  const support = checkRenderSupport();
  if (!support.supported) {
    onError(new Error(support.error));
    return { abort: () => {} };
  }

  const durationTotal = getTotalTimelineDuration(project.clips);
  if (durationTotal <= 0) {
    onError(new Error('Timeline has zero duration. Please import a video first.'));
    return { abort: () => {} };
  }

  const mimeType = getSupportedVideoMimeType();
  const expCtx = exportCanvas.getContext('2d');
  if (!expCtx) {
    onError(new Error('Failed to acquire 2D rendering context for export.'));
    return { abort: () => {} };
  }

  // @ts-ignore
  const stream = exportCanvas.captureStream ? exportCanvas.captureStream(30) : exportCanvas.mozCaptureStream(30);

  // Capture audio track if available
  try {
    // @ts-ignore
    const audioStream = videoElement.captureStream ? videoElement.captureStream() : (videoElement.mozCaptureStream ? videoElement.mozCaptureStream() : null);
    if (audioStream) {
      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
      }
    }
  } catch (e) {
    console.warn('[ExportRender] Audio track sync skipped:', e);
  }

  let mediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 3500000
    });
  } catch (err) {
    onError(new Error(`Failed to initialize MediaRecorder: ${err.message}`));
    return { abort: () => {} };
  }

  const recordedChunks = [];
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  let isAborted = false;
  let renderInterval = null;

  mediaRecorder.onstop = () => {
    if (isAborted) return;
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    onComplete(url);
  };

  // Prepare source video element
  videoElement.muted = false;
  videoElement.currentTime = timelineToSourceTime(0, project.clips);

  mediaRecorder.start();
  videoElement.play().catch(err => {
    console.warn('[ExportRender] Video playback start issue during render:', err);
  });

  renderInterval = setInterval(() => {
    if (isAborted) {
      clearInterval(renderInterval);
      return;
    }

    const sTime = videoElement.currentTime;
    const currentRenderTime = sourceToTimelineTime(sTime, project.clips);

    if (currentRenderTime >= durationTotal || videoElement.ended) {
      clearInterval(renderInterval);
      videoElement.pause();
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      return;
    }

    // Render frame onto export canvas
    expCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

    const { drawW, drawH, x, y } = computeLetterbox(
      videoElement.videoWidth,
      videoElement.videoHeight,
      exportCanvas.width,
      exportCanvas.height
    );

    const filterKey = project.filter || 'none';
    expCtx.filter = getCssFilterString(filterKey);
    expCtx.drawImage(videoElement, x, y, drawW, drawH);

    if (filterKey === 'scanlines' || filterKey === 'vhs-cyber') {
      renderScanlines(expCtx, exportCanvas.width, exportCanvas.height);
    }

    drawTextOverlays(expCtx, project.texts, currentRenderTime, exportCanvas.width, exportCanvas.height);

    const progress = Math.min(100, Math.floor((currentRenderTime / durationTotal) * 100));
    onProgress(progress);
  }, 33.3);

  return {
    abort: () => {
      isAborted = true;
      if (renderInterval) clearInterval(renderInterval);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      videoElement.pause();
    }
  };
}

