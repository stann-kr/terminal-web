import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HostPage } from '../features/host/HostPage';

const search = vi.hoisted(() => ({ value: 't=abc' }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const view = {
  artist: 'STANN LUMO',
  event: { id: 'TRM-03', session: 'TERMINAL [03]', subtitle: 'Vulpecula Junction', date: '2026-11-28', time: '23:00 KST', venue: 'FAUST SEOUL', status: 'UPCOMING' },
  code: 'K7QM',
  limit: 10,
  count: 2,
  open: true,
  guests: [
    { name: '김지현', createdAt: '2026-10-29T05:02:00.000Z' },
    { name: 'Park Minjun', createdAt: '2026-10-29T04:40:00.000Z' },
  ],
};
const page = (artistId = '03-A') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <HostPage artistId={artistId} />
  </QueryClientProvider>,
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  search.value = 't=abc';
});

describe('artist host page', () => {
  it('shows the invite link, the count against the limit and the guest names', async () => {
    const fetch = vi.fn().mockResolvedValue(json(view));
    vi.stubGlobal('fetch', fetch);
    page();
    expect(await screen.findByRole('heading', { level: 1, name: 'STANN LUMO 게스트 초대' })).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ artistId: '03-A', t: 'abc' });
    expect(screen.getByText('terminal.stann.kr/events/TRM-03/request?invite=K7QM')).toBeInTheDocument();
    expect(screen.getByText('OPEN · 8 LEFT')).toBeInTheDocument();
    const guests = screen.getByRole('list', { name: '신청한 게스트' });
    expect(guests).toHaveTextContent('김지현');
    expect(guests).toHaveTextContent('10.29 14:02');
    expect(guests.querySelectorAll('li')).toHaveLength(2);
  });

  it('copies the guest invite address', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(view)));
    // userEvent installs its own clipboard, so ours goes in after it.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    page();
    await user.click(await screen.findByRole('button', { name: /링크 복사/ }));
    expect(writeText).toHaveBeenCalledWith('https://terminal.stann.kr/events/TRM-03/request?invite=K7QM');
    expect(await screen.findByRole('button', { name: /링크 복사됨/ })).toBeInTheDocument();
  });

  it('marks a full list closed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, count: 10, open: false })));
    page();
    expect(await screen.findByText('FULL · INVITE CLOSED')).toHaveAttribute('data-state', 'closed');
  });

  it('shows only a count for an unlimited list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, limit: 10_000 })));
    page();
    expect(await screen.findByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('NO LIMIT')).toBeInTheDocument();
  });

  it('says nothing about the artist for a link that does not hold', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'INVALID_HOST_LINK' }, 404)));
    page();
    expect(await screen.findByRole('alert')).toHaveTextContent('링크를 확인할 수 없습니다');
    expect(screen.queryByText('STANN LUMO')).not.toBeInTheDocument();
  });

  it('does not ask the server without a token', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    search.value = '';
    page();
    expect(screen.getByRole('alert')).toHaveTextContent('링크를 확인할 수 없습니다');
    expect(fetch).not.toHaveBeenCalled();
  });
});
