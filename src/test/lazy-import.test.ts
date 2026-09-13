import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '@/lib/lazy-import';

describe('lazy page loading', () => {
  it('recognizes browser chunk fetch failures', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk Vendors failed'))).toBe(true);
  });

  it('does not classify application errors as chunk failures', () => {
    expect(isChunkLoadError(new Error('Unable to load vendors from the database'))).toBe(false);
    expect(isChunkLoadError('chunk failed')).toBe(false);
  });
});