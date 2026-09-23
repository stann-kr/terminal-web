import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

function luminance([r, g, b]: number[]): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number[], b: number[]): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('terminal content color contract', () => {
  it('keeps text and primary actions readable on workspace surfaces', async () => {
    const css = await readFile('app/globals.css', 'utf8');
    const token = (name: string) => {
      const match = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
      expect(match, `${name} token`).not.toBeNull();
      return match!.slice(1).map(Number);
    };
    for (const surface of ['color-bg-base', 'color-bg-panel']) {
      for (const name of ['color-text-primary', 'color-text-subdued', 'color-text-muted', 'color-accent-tertiary', 'color-accent-alert']) {
        expect(contrast(token(name), token(surface)), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(token('color-bg-base'), token('color-accent-primary'))).toBeGreaterThanOrEqual(4.5);
  });
});
