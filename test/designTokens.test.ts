import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activePalette, palettes } from '@/features/shell/palette';

type Rgb = [number, number, number];

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const hex = (value: string): Rgb => {
  const digits = value.replace('#', '');
  return [0, 2, 4].map(index => parseInt(digits.slice(index, index + 2), 16)) as Rgb;
};
/** `color-mix(in srgb, a p%, b)`, as the browser mixes it. */
const mix = (a: Rgb, b: Rgb, share: number): Rgb => a.map((value, index) => value * share + b[index] * (1 - share)) as Rgb;

const ROLES = ['panel', 'inset', 'paper', 'feature', 'mark', 'alert', 'calm', 'fresh'];

/** Each palette block's declarations, with its own `var(--…)` references resolved to hex. */
async function readPalettes() {
  const css = await readFile('app/palettes.css', 'utf8');
  const blocks = new Map<string, (name: string) => string | undefined>();
  for (const [, id, body] of css.matchAll(/\[data-palette='([\w-]+)'\]\s*\{([^}]*)\}/g)) {
    const values = new Map<string, string>();
    for (const [, name, value] of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([\w-]+):\s*([^;]+);/g)) values.set(name, value.trim());
    const resolve = (name: string): string | undefined => {
      const value = values.get(name);
      const ref = value?.match(/^var\(--([\w-]+)\)$/);
      return ref ? resolve(ref[1]) : value;
    };
    blocks.set(id, resolve);
  }
  return blocks;
}

describe('palette contract', () => {
  it('defines every palette the site can wear, and wears one of them', async () => {
    const blocks = await readPalettes();
    expect([...blocks.keys()].sort()).toEqual([...palettes].sort());
    expect(palettes).toContain(activePalette);
  });

  it('keeps every text pair of every role readable in every palette', async () => {
    for (const [id, token] of await readPalettes()) {
      const color = (name: string) => {
        const value = token(name);
        expect(value, `${id}: --${name}`).toMatch(/^#[0-9a-f]{6}$/i);
        return hex(value!);
      };
      expect(color('field'), `${id}: --field`).toBeDefined();
      // The scroll cue is an icon: graphics need 3:1.
      expect(contrast(color('on-cue'), color('cue')), `${id}: on-cue`).toBeGreaterThanOrEqual(3);
      for (const role of ROLES) {
        const plate = color(role);
        const fill = color(`${role}-fill`);
        const onFill = color(`${role}-on-fill`);
        const onFillMuted = token(`${role}-on-fill-muted`) ? color(`${role}-on-fill-muted`) : mix(onFill, fill, 0.72);
        const pairs: [string, Rgb, Rgb][] = [
          ['ink', color(`${role}-ink`), plate],
          ['muted', color(`${role}-muted`), plate],
          ['accent', color(`${role}-accent`), plate],
          ['danger', color(`${role}-danger`), plate],
          ['on-fill', onFill, fill],
          ['on-fill-muted', onFillMuted, fill],
          ['on-hi', color(`${role}-on-hi`), color(`${role}-hi`)],
        ];
        for (const [name, text, ground] of pairs) {
          expect(contrast(text, ground), `${id} ${role}: ${name}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('maps every role to plate tokens, so a nested plate reads its own ink', async () => {
    const css = await readFile('app/globals.css', 'utf8');
    for (const role of ROLES) {
      const block = css.match(new RegExp(`\\[data-surface=${role}\\]\\s*\\{([^}]*)\\}`));
      expect(block, `${role} mapping`).not.toBeNull();
      for (const name of ['ink', 'muted', 'accent', 'fill', 'on-fill', 'hi', 'on-hi', 'danger']) {
        expect(block![1]).toContain(`--${name}: var(--${role}-${name})`);
      }
    }
  });

  it('keeps colour values out of component styles, so a palette change touches one file', async () => {
    const offenders: string[] = [];
    const walk = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (path.endsWith('.css')) {
          (await readFile(path, 'utf8')).split('\n').forEach((line, index) => {
            // Blend and mask operands are not palette colours.
            if (/mask-image|^\s*color: #fff;$/.test(line)) return;
            if (/#[0-9a-f]{3,8}\b|rgba?\(/i.test(line)) offenders.push(`${path}:${index + 1}`);
          });
        }
      }
    };
    await walk('features');
    expect(offenders).toEqual([]);
  });
});
