import { describe, it, expect } from 'vitest';
import { getOriginPattern, siteListToOriginPatterns } from './permissions';

describe('permissions helpers', () => {
  it('builds origin patterns from valid http/https URLs only', () => {
    expect(getOriginPattern('https://example.com')).toBe('https://example.com/*');
    expect(getOriginPattern('http://example.com:8080')).toBe('http://example.com:8080/*');
    expect(getOriginPattern('chrome://extensions')).toBeNull();
    expect(getOriginPattern('not a url')).toBeNull();
  });

  it('converts site patterns into origin match patterns', () => {
    // Test sitePatternToOriginPatterns behavior via siteListToOriginPatterns
    expect(siteListToOriginPatterns(['example.com'])).toEqual([
      'http://example.com/*',
      'https://example.com/*',
    ]);

    expect(siteListToOriginPatterns(['https://example.com/admin'])).toEqual([
      'https://example.com/*',
    ]);

    expect(siteListToOriginPatterns(['*.example.com'])).toEqual([
      'http://*.example.com/*',
      'https://*.example.com/*',
    ]);

    expect(siteListToOriginPatterns(['*'])).toEqual(['http://*/*', 'https://*/*']);
    expect(siteListToOriginPatterns(['# comment'])).toEqual([]);
    expect(siteListToOriginPatterns(['http://'])).toEqual([]);
  });

  it('dedupes origin patterns from a list', () => {
    const origins = siteListToOriginPatterns(['example.com', 'https://example.com']);
    expect(origins).toEqual(['http://example.com/*', 'https://example.com/*']);
  });
});
