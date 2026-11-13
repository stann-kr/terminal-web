import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
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
  waitlist: [] as { id: string; name: string; instagram: string; createdAt: string }[],
  kit: [{ label: '티저', download: 'TERMINAL[03]_teaser.png', width: 2160, height: 2880, bytes: 5_952_827, href: '/api/invite/host/file?a=03-A&t=abc&f=trm-03%2Fteaser.png', thumb: '/api/invite/host/file?a=03-A&t=abc&f=trm-03%2Fteaser.thumb.jpg' }],
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

  it('thanks the artist, but not on TERMINAL\'s own page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(view)));
    page();
    expect(await screen.findByText(/TERMINAL \[03\]의 원정에 함께해 주셔서 진심으로 감사드립니다/)).toBeInTheDocument();
    cleanup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, artist: 'TERMINAL', limit: 10_000 })));
    page('03-HOST');
    await screen.findByText('NO LIMIT');
    expect(screen.queryByText(/감사드립니다/)).not.toBeInTheDocument();
  });

  it('offers the promo files to download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(view)));
    page();
    const key = await screen.findByRole('link', { name: /티저/ });
    expect(key).toHaveAttribute('href', '/api/invite/host/file?a=03-A&t=abc&f=trm-03%2Fteaser.png');
    expect(key).toHaveAttribute('download', 'TERMINAL[03]_teaser.png');
    expect(screen.getByText('PNG · 2160×2880 · 5.7MB')).toBeInTheDocument();
  });

  it('guides the artist step by step, with the limit only where there is one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(view)));
    page();
    const guide = await screen.findByRole('list', { name: '초대 안내' });
    expect(guide).toHaveTextContent('링크 보내기');
    expect(guide).toHaveTextContent('한도 10명');
    expect(guide).toHaveTextContent('신청은 이벤트 시작 전까지');
    cleanup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, limit: 10_000 })));
    page();
    expect(await screen.findByRole('list', { name: '초대 안내' })).not.toHaveTextContent('한도');
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

  it('marks a full list as taking the waitlist, in the band and in the guide alike', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, count: 10, open: false })));
    page();
    expect(await screen.findByText('FULL · WAITLIST')).toHaveAttribute('data-state', 'closed');
    expect(screen.getByRole('list', { name: '초대 안내' })).toHaveTextContent('차면 새 신청은 대기 명단으로 받습니다');
    expect(screen.queryByText(/링크가 마감됩니다/)).not.toBeInTheDocument();
  });

  it('keeps the list and what was typed when a later check fails, and reads again on request', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(view))
      .mockResolvedValueOnce(json({ error: 'INTERNAL_SERVER_ERROR' }, 500))
      .mockResolvedValueOnce(json({ ...view, count: 3 }));
    vi.stubGlobal('fetch', fetch);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(<QueryClientProvider client={client}><HostPage artistId="03-A" /></QueryClientProvider>);
    await user.type(await screen.findByLabelText(/게스트 이름/), '이서연');
    await act(async () => { await client.refetchQueries({ queryKey: ['host'] }); });
    expect(await screen.findByText('최신 현황을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByLabelText(/게스트 이름/)).toHaveValue('이서연');
    expect(screen.getByRole('list', { name: '신청한 게스트' })).toHaveTextContent('김지현');
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('OPEN · 7 LEFT')).toBeInTheDocument();
    expect(screen.queryByText('최신 현황을 불러오지 못했습니다')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/게스트 이름/)).toHaveValue('이서연');
  });

  it('stops showing the list once the link no longer holds', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(view)).mockResolvedValueOnce(json({ error: 'INVALID_HOST_LINK' }, 404));
    vi.stubGlobal('fetch', fetch);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><HostPage artistId="03-A" /></QueryClientProvider>);
    await screen.findByText('김지현');
    await act(async () => { await client.refetchQueries({ queryKey: ['host'] }); });
    expect(await screen.findByRole('alert')).toHaveTextContent('링크를 확인할 수 없습니다');
    expect(screen.queryByText('김지현')).not.toBeInTheDocument();
  });

  it('stops showing the list when a save is refused because the link no longer holds, even if the next check fails', async () => {
    const waiting = { id: 'req-w1', name: '최창배', instagram: '@cc_b3', createdAt: '2026-11-11T16:02:00.000Z' };
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ ...view, waitlist: [waiting] }))
      .mockResolvedValueOnce(json({ error: 'INVALID_HOST_LINK' }, 404))
      .mockResolvedValueOnce(json({ error: 'INTERNAL_SERVER_ERROR' }, 500));
    vi.stubGlobal('fetch', fetch);
    page();
    await userEvent.click(await screen.findByRole('button', { name: /명단에 올리기.*최창배/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('초대 현황을 불러오지 못했습니다');
    expect(screen.queryByText('김지현')).not.toBeInTheDocument();
    expect(screen.queryByText('@cc_b3')).not.toBeInTheDocument();
  });

  it('reads the list again when a move up is refused because the list changed', async () => {
    const waiting = { id: 'req-w1', name: '최창배', instagram: '@cc_b3', createdAt: '2026-11-11T16:02:00.000Z' };
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ ...view, waitlist: [waiting] }))
      .mockResolvedValueOnce(json({ error: 'GUEST_LIMIT_REACHED' }, 409))
      .mockResolvedValueOnce(json({ ...view, count: 10, open: false, waitlist: [waiting] }));
    vi.stubGlobal('fetch', fetch);
    page();
    await userEvent.click(await screen.findByRole('button', { name: /명단에 올리기.*최창배/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('접수 한도');
    expect(await screen.findByText('FULL · WAITLIST')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /명단에 올리기.*최창배/ })).toBeDisabled();
  });

  it('cannot move a waiting guest up outside the request period, and says why', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      ...view, open: false,
      waitlist: [{ id: 'req-w1', name: '최창배', instagram: '@cc_b3', createdAt: '2026-11-11T16:02:00.000Z' }],
    })));
    page();
    expect(await screen.findByRole('button', { name: /명단에 올리기.*최창배/ })).toBeDisabled();
    expect(screen.getByText('신청 기간이 아니어서 올릴 수 없습니다.')).toBeInTheDocument();
  });

  it('lists the waiting guests and moves one up while there is room', async () => {
    const waiting = { id: 'req-w1', name: '최창배', instagram: '@cc_b3', createdAt: '2026-11-11T16:02:00.000Z' };
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ ...view, waitlist: [waiting] }))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ...view, count: 3, guests: [{ name: '최창배', createdAt: '2026-11-12T03:00:00.000Z' }, ...view.guests] }));
    vi.stubGlobal('fetch', fetch);
    page();
    expect(await screen.findByText('대기 명단 01')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '@cc_b3' })).toHaveAttribute('href', 'https://instagram.com/cc_b3');
    await userEvent.click(screen.getByRole('button', { name: /명단에 올리기.*최창배/ }));
    expect(fetch.mock.calls[1][0]).toBe('/api/invite/host/waitlist');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ artistId: '03-A', t: 'abc', id: 'req-w1' });
    expect(await screen.findByText('최창배 님을 명단에 올렸습니다.', { selector: '[role="status"]' })).toBeInTheDocument();
  });

  it('keeps the waiting guests in view but cannot move them up into a full list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      ...view, count: 10, open: false,
      waitlist: [{ id: 'req-w1', name: '최창배', instagram: '@cc_b3', createdAt: '2026-11-11T16:02:00.000Z' }],
    })));
    page();
    expect(await screen.findByRole('button', { name: /명단에 올리기.*최창배/ })).toBeDisabled();
    expect(screen.getByText(/정원이 차 있어 올릴 수 없습니다/)).toBeInTheDocument();
  });

  it('shows only a count for an unlimited list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, limit: 10_000 })));
    page();
    expect(await screen.findByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('NO LIMIT')).toBeInTheDocument();
  });

  it('keeps a long but finite limit in view, without cells', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, limit: 50, count: 32 })));
    const { container } = page();
    expect(await screen.findByText('OPEN · 18 LEFT')).toBeInTheDocument();
    expect(screen.getByText('LIMIT 50')).toBeInTheDocument();
    expect(screen.getByText('/ 50', { exact: false })).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"] > i')).toBeNull();
  });

  it('lets the artist list a guest and shows the refreshed list', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(view))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ...view, count: 3, guests: [{ name: '이서연', createdAt: '2026-10-30T03:00:00.000Z' }, ...view.guests] }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    page();
    await user.type(await screen.findByLabelText(/게스트 이름/), '이서연');
    const instagram = screen.getByRole('textbox', { name: /인스타그램 ID/ });
    await user.type(instagram, 'seoyeon');
    expect(instagram).toHaveValue('@seoyeon');
    await user.click(screen.getByRole('checkbox', { name: /동의를 받았습니다/ }));
    await user.click(screen.getByRole('button', { name: '게스트 등록' }));
    expect(fetch.mock.calls[1][0]).toBe('/api/invite/host/guests');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ artistId: '03-A', t: 'abc', name: '이서연', instagram: 'seoyeon', consent: true });
    expect(await screen.findByText('OPEN · 7 LEFT')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '신청한 게스트' })).toHaveTextContent('이서연');
    expect(screen.getByLabelText(/게스트 이름/)).toHaveValue('');
  });

  it('closes the artist form with the list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...view, count: 10, open: false })));
    page();
    expect(await screen.findByRole('button', { name: '등록 마감' })).toBeDisabled();
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
