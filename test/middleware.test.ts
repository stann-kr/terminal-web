import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '../middleware';

const visit = (url: string) => middleware(new NextRequest(url, { headers: { accept: 'text/html' } }));

describe('middleware', () => {
  it('sends plain http on the public host to the same address over https', () => {
    const response = visit('http://terminal.stann.kr/events/TRM-03?invite=CODE');
    expect(response?.status).toBe(308);
    expect(response?.headers.get('location')).toBe('https://terminal.stann.kr/events/TRM-03?invite=CODE');
  });
  it('leaves http alone elsewhere (local dev, previews)', () => {
    expect(visit('http://100.80.0.12:3005/q')?.headers.get('location') ?? null).toBeNull();
  });
  it('takes the upper-case QR path as /q', () => {
    expect(visit('https://terminal.stann.kr/Q')?.headers.get('x-middleware-rewrite')).toBe('https://terminal.stann.kr/q');
  });
});
