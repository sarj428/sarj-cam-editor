import { describe, it, expect } from 'vitest';
import {
  getTotalTimelineDuration,
  timelineToSourceTime,
  sourceToTimelineTime,
  splitClipAtTime,
  deleteClipSegment,
  getPixelsPerSecond,
  generateRulerTicks,
  BASE_PIXELS_PER_SECOND
} from '../src/editor/timeline.js';

describe('timeline.js math & logic', () => {
  describe('getTotalTimelineDuration', () => {
    it('returns 0 for empty or invalid clips', () => {
      expect(getTotalTimelineDuration([])).toBe(0);
      expect(getTotalTimelineDuration(null)).toBe(0);
      expect(getTotalTimelineDuration(undefined)).toBe(0);
    });

    it('sums clip durations accurately', () => {
      const clips = [{ duration: 4.5 }, { duration: 2.5 }, { duration: 3 }];
      expect(getTotalTimelineDuration(clips)).toBe(10);
    });

    it('ignores non-numeric durations gracefully', () => {
      const clips = [{ duration: 5 }, { duration: 'invalid' }, { duration: 3 }];
      expect(getTotalTimelineDuration(clips)).toBe(8);
    });
  });

  describe('timelineToSourceTime & sourceToTimelineTime mapping', () => {
    const clips = [
      { id: 'c1', start: 10, end: 15, duration: 5 }, // Timeline: 0-5s -> Source: 10-15s
      { id: 'c2', start: 30, end: 35, duration: 5 } // Timeline: 5-10s -> Source: 30-35s
    ];

    it('maps timeline time to source video time', () => {
      expect(timelineToSourceTime(2, clips)).toBe(12);
      expect(timelineToSourceTime(5, clips)).toBe(15);
      expect(timelineToSourceTime(7, clips)).toBe(32);
    });

    it('handles edge cases when timeline time exceeds total duration', () => {
      expect(timelineToSourceTime(20, clips)).toBe(35); // returns end of last clip
      expect(timelineToSourceTime(0, [])).toBe(0);
    });

    it('maps source video time to timeline time', () => {
      expect(sourceToTimelineTime(12, clips)).toBe(2);
      expect(sourceToTimelineTime(15, clips)).toBe(5);
      expect(sourceToTimelineTime(32, clips)).toBe(7);
    });

    it('returns accumulated time when source time is beyond all clips', () => {
      expect(sourceToTimelineTime(50, clips)).toBe(10);
      expect(sourceToTimelineTime(10, [])).toBe(0);
    });
  });

  describe('splitClipAtTime', () => {
    const initialClips = [{ id: 'c1', start: 0, end: 10, duration: 10 }];

    it('returns error when clips array is empty', () => {
      const res = splitClipAtTime([], 5);
      expect(res.success).toBe(false);
      expect(res.error).toContain('No clips available');
    });

    it('rejects split at exact start or end boundary', () => {
      expect(splitClipAtTime(initialClips, 0).success).toBe(false);
      expect(splitClipAtTime(initialClips, 10).success).toBe(false);
      expect(splitClipAtTime(initialClips, -1).success).toBe(false);
      expect(splitClipAtTime(initialClips, 15).success).toBe(false);
    });

    it('splits clip accurately into two pieces at valid timestamp', () => {
      const res = splitClipAtTime(initialClips, 4);
      expect(res.success).toBe(true);
      expect(res.clips).toHaveLength(2);

      const [first, second] = res.clips;
      expect(first.start).toBe(0);
      expect(first.end).toBe(4);
      expect(first.duration).toBe(4);

      expect(second.start).toBe(4);
      expect(second.end).toBe(10);
      expect(second.duration).toBe(6);
    });

    it('splits across multi-clip sequences correctly', () => {
      const multi = [
        { id: 'c1', start: 0, end: 5, duration: 5 },
        { id: 'c2', start: 10, end: 20, duration: 10 } // Timeline: 5-15s
      ];
      const res = splitClipAtTime(multi, 8); // splits c2 at offset 3
      expect(res.success).toBe(true);
      expect(res.clips).toHaveLength(3);
      expect(res.clips[0].id).toBe('c1');
      expect(res.clips[1].start).toBe(10);
      expect(res.clips[1].end).toBe(13);
      expect(res.clips[1].duration).toBe(3);
      expect(res.clips[2].start).toBe(13);
      expect(res.clips[2].end).toBe(20);
      expect(res.clips[2].duration).toBe(7);
    });
  });

  describe('deleteClipSegment', () => {
    it('returns empty array when clips is invalid', () => {
      expect(deleteClipSegment(null, 'c1')).toEqual([]);
    });

    it('deletes specific clip by id while preserving order', () => {
      const clips = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const result = deleteClipSegment(clips, 'b');
      expect(result).toEqual([{ id: 'a' }, { id: 'c' }]);
    });

    it('returns identical copy if id is not found', () => {
      const clips = [{ id: 'a' }, { id: 'b' }];
      expect(deleteClipSegment(clips, 'non-existent')).toEqual([{ id: 'a' }, { id: 'b' }]);
    });
  });

  describe('getPixelsPerSecond & generateRulerTicks', () => {
    it('calculates clamped pixels per second based on zoom', () => {
      expect(getPixelsPerSecond(1)).toBe(BASE_PIXELS_PER_SECOND);
      expect(getPixelsPerSecond(2)).toBe(BASE_PIXELS_PER_SECOND * 2);
      expect(getPixelsPerSecond(10)).toBe(BASE_PIXELS_PER_SECOND * 5); // clamped to 5
      expect(getPixelsPerSecond(0.5)).toBe(BASE_PIXELS_PER_SECOND); // clamped to 1
    });

    it('generates correct ruler ticks for timeline', () => {
      expect(generateRulerTicks(0, 1)).toEqual([]);
      const ticks = generateRulerTicks(10, 2);
      expect(ticks.length).toBe(11); // 0 to 10 step 1
      expect(ticks[0].isMajor).toBe(true);
      expect(ticks[0].label).toBe('0:00');
      expect(ticks[5].isMajor).toBe(true);
      expect(ticks[1].isMajor).toBe(false);
    });
  });
});
