import { describe, it, expect } from 'vitest';
import {
  validateVideoFile,
  validateTimeRange,
  validateProjectJson,
  MAX_VIDEO_SIZE_BYTES
} from '../src/utils/validation.js';

describe('validation.js', () => {
  describe('validateVideoFile', () => {
    it('returns error when file is null or undefined', () => {
      expect(validateVideoFile(null).isValid).toBe(false);
      expect(validateVideoFile(undefined).isValid).toBe(false);
      expect(validateVideoFile(null).error).toContain('No file selected');
    });

    it('rejects non-video files by MIME type and extension', () => {
      const textFile = { name: 'document.txt', type: 'text/plain', size: 1024 };
      const res = validateVideoFile(textFile);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Unsupported format');
    });

    it('accepts valid video file by MIME type', () => {
      const validMp4 = { name: 'sample.mp4', type: 'video/mp4', size: 5 * 1024 * 1024 };
      expect(validateVideoFile(validMp4).isValid).toBe(true);
    });

    it('accepts valid video file by extension even if MIME is empty', () => {
      const validWebm = { name: 'sample.webm', type: '', size: 2 * 1024 * 1024 };
      expect(validateVideoFile(validWebm).isValid).toBe(true);

      const validMov = { name: 'clip.MOV', type: 'application/octet-stream', size: 1024 };
      expect(validateVideoFile(validMov).isValid).toBe(true);
    });

    it('rejects files exceeding max size limit', () => {
      const hugeFile = {
        name: 'huge.mp4',
        type: 'video/mp4',
        size: MAX_VIDEO_SIZE_BYTES + 1024
      };
      const res = validateVideoFile(hugeFile);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('File is too large');
    });

    it('handles custom max size override correctly', () => {
      const smallLimit = 10 * 1024 * 1024; // 10 MB
      const file = { name: 'test.mp4', type: 'video/mp4', size: 15 * 1024 * 1024 };
      expect(validateVideoFile(file, smallLimit).isValid).toBe(false);
    });
  });

  describe('validateTimeRange', () => {
    it('rejects non-numeric timestamps', () => {
      expect(validateTimeRange('0', 5).isValid).toBe(false);
      expect(validateTimeRange(0, NaN).isValid).toBe(false);
    });

    it('rejects negative start times', () => {
      const res = validateTimeRange(-1, 5);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('negative');
    });

    it('rejects end times less than or equal to start times', () => {
      expect(validateTimeRange(5, 5).isValid).toBe(false);
      expect(validateTimeRange(6, 4).isValid).toBe(false);
    });

    it('rejects start times that exceed total duration', () => {
      const res = validateTimeRange(15, 20, 10);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot exceed total duration');
    });

    it('accepts valid in/out time ranges', () => {
      expect(validateTimeRange(0, 10, 60).isValid).toBe(true);
      expect(validateTimeRange(2.5, 8.2).isValid).toBe(true);
    });
  });

  describe('validateProjectJson', () => {
    it('rejects non-objects or null', () => {
      expect(validateProjectJson(null).isValid).toBe(false);
      expect(validateProjectJson('string').isValid).toBe(false);
      expect(validateProjectJson(123).isValid).toBe(false);
    });

    it('rejects objects missing sarjcam_project signature', () => {
      const res = validateProjectJson({ clips: [] });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('missing SARJ-CAM project signature');
    });

    it('rejects project missing clips array', () => {
      const res = validateProjectJson({ sarjcam_project: true, clips: 'not-an-array' });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('clips array is missing');
    });

    it('accepts valid project JSON schema', () => {
      const validConfig = {
        sarjcam_project: true,
        version: '1.0.0',
        name: 'Retro Reel',
        clips: [{ id: 'clip-1', start: 0, end: 5, duration: 5 }]
      };
      expect(validateProjectJson(validConfig).isValid).toBe(true);
    });
  });
});
