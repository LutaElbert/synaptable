import { describe, expect, it } from 'vitest';
import { formatStorageBytes, isQuotaExceededError, storageUsageRatio } from './storage-health';

describe('storage health', () => {
  it('recognizes browser quota errors without classifying ordinary failures', () => {
    expect(isQuotaExceededError(new DOMException('Full', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaExceededError(new DOMException('Failed', 'UnknownError'))).toBe(false);
    expect(isQuotaExceededError(new Error('QuotaExceededError'))).toBe(false);
  });

  it('bounds storage ratios and handles missing estimates', () => {
    expect(storageUsageRatio({ supported: true, usage: 25, quota: 100, persisted: false })).toBe(0.25);
    expect(storageUsageRatio({ supported: true, usage: 150, quota: 100, persisted: false })).toBe(1);
    expect(storageUsageRatio({ supported: false, usage: null, quota: null, persisted: null })).toBeNull();
  });

  it('formats approximate storage sizes for recovery copy', () => {
    expect(formatStorageBytes(null)).toBe('Unknown');
    expect(formatStorageBytes(1_536)).toBe('1.5 KB');
    expect(formatStorageBytes(12 * 1024 * 1024)).toBe('12 MB');
  });
});
