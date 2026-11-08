import { describe, it, expect } from 'vitest';
import { FILTER_PRESETS, getCssFilterString } from '../src/editor/filters.js';
import { createId } from '../src/utils/ids.js';
import { formatTime, formatShortTime, formatBytes } from '../src/utils/formatters.js';

describe('filters.js', () => {
  it('defines 5 exact preset filters with required metadata', () => {
    const keys = Object.keys(FILTER_PRESETS);
    expect(keys).toEqual(['none', 'scanlines', 'vhs-cyber', 'neon-glitch', 'grayscale']);

    expect(FILTER_PRESETS.none.name).toBe('None');
    expect(FILTER_PRESETS.none.cssFilter).toBe('none');

    expect(FILTER_PRESETS.scanlines.name).toBe('CRT Scanlines');
    expect(FILTER_PRESETS['vhs-cyber'].name).toBe('VHS Cyber');
    expect(FILTER_PRESETS['neon-glitch'].name).toBe('Neon Glitch');
    expect(FILTER_PRESETS.grayscale.name).toBe('Retro Mono');
  });

  it('getCssFilterString returns the corresponding CSS filter or none', () => {
    expect(getCssFilterString('none')).toBe('none');
    expect(getCssFilterString('vhs-cyber')).toContain('contrast');
    expect(getCssFilterString('grayscale')).toContain('grayscale(1)');
    expect(getCssFilterString('unknown-filter')).toBe('none');
  });
});

describe('ids.js', () => {
  it('generates IDs with correct prefix and structure without deprecated substr', () => {
    const id1 = createId('clip');
    const id2 = createId('clip');
    const txtId = createId('txt');

    expect(id1.startsWith('clip_')).toBe(true);
    expect(txtId.startsWith('txt_')).toBe(true);
    expect(id1).not.toBe(id2);
  });
});

describe('formatters.js', () => {
  it('formats seconds into MM:SS.SS timecode', () => {
    expect(formatTime(0)).toBe('00:00.00');
    expect(formatTime(65.5)).toBe('01:05.50');
    expect(formatTime('invalid')).toBe('00:00.00');
  });

  it('formats short timeline ticks MM:SS', () => {
    expect(formatShortTime(0)).toBe('0:00');
    expect(formatShortTime(125)).toBe('2:05');
  });

  it('formats byte sizes into readable units', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024 * 15)).toBe('15 MB');
  });
});
