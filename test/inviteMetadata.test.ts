import { describe, expect, it, vi } from 'vitest';
import type { TerminalEvent } from '../lib/events/types';

vi.mock('../features/events/inviteImages.json', () => ({ default: ['03-A'] }));
const { SHARE_IMAGE, inviteMetadata } = await import('../features/events/metadata');

const event: TerminalEvent = {
  id: 'TRM-03', session: 'TERMINAL [03]', subtitle: 'Vulpecula Junction', date: '2026-11-28', time: '23:00 KST',
  venue: 'FAUST SEOUL', district: 'SEOUL', coords: '', capacity: '', sound: '', status: 'UPCOMING', artists: [],
};

describe('invite link preview', () => {
  it('leads with the inviting artist and uses its rendered image', () => {
    const metadata = inviteMetadata(event, { artistId: '03-A', name: 'STANN LUMO' });
    expect(metadata.title).toEqual({ absolute: 'STANN LUMO · TERMINAL [03] 게스트 초대' });
    expect(metadata.description).toBe('2026-11-28 23:00 KST · FAUST SEOUL · 게스트 신청');
    expect(metadata.openGraph?.images).toEqual([
      { url: '/og/invite/03-A.png', width: 1200, height: 630, alt: 'STANN LUMO · TERMINAL [03] 게스트 초대' },
    ]);
  });

  it('falls back to the site image for an artist without one yet', () => {
    expect(inviteMetadata(event, { artistId: '03-B', name: 'OTHER' }).openGraph?.images).toEqual([SHARE_IMAGE]);
  });
});
