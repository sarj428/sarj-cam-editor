/**
 * @fileoverview Retro Canvas filter presets and CRT scanline rendering.
 * All math and configuration is pure and easily unit testable.
 */

/**
 * Filter preset configuration metadata and CSS filter properties.
 * @type {Record<string, { id: string, name: string, cssFilter: string }>}
 */
export const FILTER_PRESETS = {
  none: {
    id: 'none',
    name: 'None',
    cssFilter: 'none'
  },
  scanlines: {
    id: 'scanlines',
    name: 'CRT Scanlines',
    cssFilter: 'contrast(1.15) saturate(1.1)'
  },
  'vhs-cyber': {
    id: 'vhs-cyber',
    name: 'VHS Cyber',
    cssFilter: 'contrast(1.25) saturate(1.4) hue-rotate(-20deg) sepia(0.15)'
  },
  'neon-glitch': {
    id: 'neon-glitch',
    name: 'Neon Glitch',
    cssFilter: 'contrast(1.5) saturate(1.8) hue-rotate(140deg)'
  },
  grayscale: {
    id: 'grayscale',
    name: 'Retro Mono',
    cssFilter: 'grayscale(1) contrast(1.1) brightness(0.95)'
  }
};

/**
 * Returns the CSS filter string corresponding to a preset key.
 * @param {string} filterKey - Key of the filter (e.g. 'vhs-cyber').
 * @returns {string} CSS filter string.
 */
export function getCssFilterString(filterKey) {
  const preset = FILTER_PRESETS[filterKey];
  return preset ? preset.cssFilter : 'none';
}

/**
 * Renders CRT horizontal scanlines and subtle glitch bars onto a Canvas 2D context.
 * Baked into the canvas buffer so exported videos contain the effect.
 * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
 * @param {number} width - Canvas width in pixels.
 * @param {number} height - Canvas height in pixels.
 * @param {number} [lineSpacing=3] - Pixel spacing between scanlines.
 * @param {number} [alpha=0.13] - Opacity of each scanline.
 * @param {number} [randomSeed=Math.random()] - Deterministic or random trigger for glitch pulses.
 */
export function renderScanlines(ctx, width, height, lineSpacing = 3, alpha = 0.13, randomSeed = Math.random()) {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  for (let y = 0; y < height; y += lineSpacing) {
    ctx.fillRect(0, y, width, 1);
  }

  // Occasional subtle glitch line
  if (randomSeed < 0.05) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    const glitchY = (randomSeed * 20) * height % height;
    const glitchHeight = (randomSeed * 100) % 6 + 2;
    ctx.fillRect(0, glitchY, width, glitchHeight);
  }
  ctx.restore();
}

