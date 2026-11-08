/**
 * @fileoverview HTML5 Canvas 2D frame rendering pipeline, aspect letterboxing, and text overlays.
 */

import { getCssFilterString, renderScanlines } from './filters.js';

/**
 * Computes canvas width and height for a selected aspect ratio.
 * @param {'16/9'|'9/16'|'1/1'|string} ratio
 * @returns {{ width: number, height: number }}
 */
export function computeAspectRatioDimensions(ratio) {
  if (ratio === '9/16') {
    return { width: 360, height: 640 };
  }
  if (ratio === '1/1') {
    return { width: 480, height: 480 };
  }
  return { width: 640, height: 360 }; // Default 16:9 widescreen
}

/**
 * Computes letterboxed or pillarboxed destination rectangle to preserve source aspect ratio.
 * Pure function suitable for unit tests.
 * @param {number} sourceW - Source video natural width.
 * @param {number} sourceH - Source video natural height.
 * @param {number} targetW - Destination canvas width.
 * @param {number} targetH - Destination canvas height.
 * @returns {{ drawW: number, drawH: number, x: number, y: number }}
 */
export function computeLetterbox(sourceW, sourceH, targetW, targetH) {
  if (!sourceW || !sourceH || !targetW || !targetH) {
    return { drawW: targetW, drawH: targetH, x: 0, y: 0 };
  }

  const targetRatio = targetW / targetH;
  const sourceRatio = sourceW / sourceH;

  let drawW = targetW;
  let drawH = targetH;
  let x = 0;
  let y = 0;

  if (sourceRatio > targetRatio) {
    drawH = targetW / sourceRatio;
    y = (targetH - drawH) / 2;
  } else {
    drawW = targetH * sourceRatio;
    x = (targetW - drawW) / 2;
  }

  return { drawW, drawH, x, y };
}

/**
 * Draws the standby test-grid and status message when no video is loaded.
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context.
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 * @param {string} [message="CAM VIEWER: STANDBY"] - Standby text string.
 */
export function drawStandbyCanvas(ctx, width, height, message = 'CAM VIEWER: STANDBY') {
  ctx.save();
  ctx.fillStyle = '#0b0f12';
  ctx.fillRect(0, 0, width, height);

  // Background grid
  ctx.strokeStyle = 'rgba(45, 219, 222, 0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Centered neon status message
  ctx.font = "bold 20px 'JetBrains Mono', monospace";
  ctx.fillStyle = '#2ddbde';
  ctx.shadowColor = '#2ddbde';
  ctx.shadowBlur = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
  ctx.restore();
}

/**
 * Draws active text overlays positioned at current timeline playhead.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<object>} texts - Text title overlay objects.
 * @param {number} playheadTime - Current timeline time in seconds.
 * @param {number} canvasWidth - Width of canvas.
 * @param {number} canvasHeight - Height of canvas.
 */
export function drawTextOverlays(ctx, texts, playheadTime, canvasWidth, canvasHeight) {
  if (!Array.isArray(texts) || texts.length === 0) return;

  ctx.save();
  ctx.filter = 'none';

  for (const item of texts) {
    if (playheadTime >= item.start && playheadTime <= item.end) {
      const fontSize = item.fontSize || 28;
      const color = item.color || '#ffffff';
      const text = (item.text || '').toUpperCase();

      ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const pxX = ((item.x || 50) / 100) * canvasWidth;
      const pxY = ((item.y || 50) / 100) * canvasHeight;

      // Cyber glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.fillText(text, pxX, pxY);
    }
  }
  ctx.restore();
}

/**
 * Renders a complete frame: background, video frame, retro shaders, scanlines, and title overlays.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLVideoElement} videoElement
 * @param {object} project - Current project state.
 * @param {number} playheadTime - Current playhead timestamp in seconds.
 */
export function drawCanvasFrame(ctx, canvas, videoElement, project, playheadTime) {
  if (!videoElement || videoElement.readyState < 2) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { drawW, drawH, x, y } = computeLetterbox(
    videoElement.videoWidth,
    videoElement.videoHeight,
    canvas.width,
    canvas.height
  );

  // Apply CSS filter
  const filterKey = project.filter || 'none';
  ctx.filter = getCssFilterString(filterKey);

  // Draw scaled video frame
  ctx.drawImage(videoElement, x, y, drawW, drawH);

  // Apply scanlines overlay if CRT or VHS filter is active
  if (filterKey === 'scanlines' || filterKey === 'vhs-cyber') {
    renderScanlines(ctx, canvas.width, canvas.height);
  }

  // Draw active title overlays on top
  drawTextOverlays(ctx, project.texts, playheadTime, canvas.width, canvas.height);
}
