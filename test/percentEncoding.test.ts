import { describe, expect, it } from 'vitest';
import { hasMalformedPercentEncoding } from '../lib/http/percentEncoding';

describe('malformed percent-encoding path check', () => {
  it('flags truncated or invalid escapes', () => {
    expect(hasMalformedPercentEncoding('/events/%E0%A4%A')).toBe(true);
    expect(hasMalformedPercentEncoding('/artists/%E0%A4%A')).toBe(true);
    expect(hasMalformedPercentEncoding('/%E0%A4%A')).toBe(true);
    expect(hasMalformedPercentEncoding('/events/%')).toBe(true);
    expect(hasMalformedPercentEncoding('/events/%ZZ')).toBe(true);
  });

  it('passes valid encoded and plain paths', () => {
    expect(hasMalformedPercentEncoding('/artists/appearance%3ATRM-02%3A02-D')).toBe(false);
    expect(hasMalformedPercentEncoding('/artists/%EC%95%84%ED%8B%B0%EC%8A%A4%ED%8A%B8')).toBe(false);
    expect(hasMalformedPercentEncoding('/events/TRM-03/request')).toBe(false);
    expect(hasMalformedPercentEncoding('/')).toBe(false);
  });
});
