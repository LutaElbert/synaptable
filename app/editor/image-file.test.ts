import { describe, expect, it } from 'vitest';
import { detectImageType } from './image-file';

describe('detectImageType', () => {
  it('recognizes PNG, JPEG, and WebP signatures', () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageType(new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]))).toBe('image/webp');
  });

  it('rejects content with only a misleading extension or MIME type', () => {
    expect(detectImageType(new TextEncoder().encode('not an image'))).toBeNull();
  });
});

