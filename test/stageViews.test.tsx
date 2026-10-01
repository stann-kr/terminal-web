import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TerminalEvent } from '../lib/events/types';
import { Shell } from '../features/shell/Shell';
import { EventCountdown } from '../features/events/EventCountdown';
import { useViewport } from '../features/stage/data';
import { useTransmitRange } from '../features/transmit/useTransmit';
import siteContent from '../features/about/content.json';

const navigation = vi.hoisted(() => ({ search: new URLSearchParams(), pathname: '/' }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => navigation.search, usePathname: () => navigation.pathname, useRouter: () => router }));

const artist = (id: string, name: string, extra: Partial<TerminalEvent['artists'][number]> = {}): TerminalEvent['artists'][number] => ({ id, name, origin: 'KR', dock: '1', time: 'TBA', status: 'ARCHIVED', ...extra });
const past: TerminalEvent = { id: 'OLD', session: 'Past event', subtitle: 'A past night', date: '2025-03-07', time: '23:00', venue: 'FAUST', district: 'SEOUL', coords: '', capacity: '', sound: '', status: 'ARCHIVED', artists: [artist('PUBLIC', 'VISIBLE ARTIST'), artist('PRIVATE', 'PRIVATE NAME', { status: 'CLASSIFIED' })] };
const upcoming: TerminalEvent = { ...past, id: 'TRM-03', session: 'TERMINAL [03]', date: '2099-11-28', time: '23:00 KST', status: 'UPCOMING', artists: [artist('03-A', 'NEXT ARTIST', { status: 'CONFIRMED' })] };

const clients: QueryClient[] = [];
function shell(events: TerminalEvent[] = [past]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData(['events'], events);
  client.setQueryData(['transmit', 1], { logs: [], total: 0, page: 1, totalPages: 0 });
  const tree = () => <QueryClientProvider client={client}><Shell><input aria-label="초안" defaultValue="keep this" /></Shell></QueryClientProvider>;
  const result = render(tree());
  const go = (pathname: string, search = '') => {
    navigation.pathname = pathname;
    navigation.search = new URLSearchParams(search);
    result.rerender(tree());
  };
  return { ...result, client, go };
}
const item = (container: HTMLElement, key: string) => container.querySelector<HTMLElement>(`[data-item="${key}"]`)!;
const detail = (container: HTMLElement, key: string) => container.querySelector<HTMLElement>(`[data-detail="${key}"]`)!;
const plate = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`[data-plate="${id}"]`)!;
const shown = (element: HTMLElement) => element.getAttribute('data-visible') === 'true';

function viewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}
beforeEach(() => viewport(1440, 900));
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  navigation.search = new URLSearchParams();
  navigation.pathname = '/';
  router.push.mockReset();
  router.replace.mockReset();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.stageMode;
});

describe('stage shell', () => {
  it('has no header, footer or menu: the wordmark rides on the next plate and the plates are the menu', () => {
    const { container, go } = shell();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '화면 효과' })).not.toBeInTheDocument();
    const next = plate(container, 'next');
    expect(within(next).getAllByText('TERMINAL').some(word => !word.closest('a'))).toBe(true);
    // The language switch is not a site-wide control: it sits only in the heads of bilingual texts.
    expect(within(next).queryByRole('group', { name: '소개글 언어' })).not.toBeInTheDocument();
    go('/events');
    expect(plate(container, 'events')).toHaveAttribute('data-mode', 'hero');
    expect(within(plate(container, 'events')).getByRole('heading', { level: 1, name: /이벤트/ })).toBeInTheDocument();
    // The other plates are still there, re-fitted, as real links.
    expect(within(plate(container, 'log')).getByRole('link')).toHaveAttribute('href', '/transmit');
    expect(within(plate(container, 'artists')).getByRole('link', { name: /아티스트/ })).toHaveAttribute('href', '/artists');
    expect(within(plate(container, 'next')).getAllByText('TERMINAL').length).toBeGreaterThan(0);
  });

  it('gives every view but the home a back card to the view before it, and a home key once away from it', () => {
    const { container, go } = shell([past, upcoming]);
    const back = () => container.querySelector<HTMLElement>('[data-back]')!;
    expect(back()).toHaveAttribute('data-visible', 'false');
    go('/events');
    expect(within(back()).getByRole('link', { name: '이전 화면으로: 홈' })).toHaveAttribute('href', '/');
    expect(within(back()).queryByRole('link', { name: '홈으로' })).not.toBeInTheDocument();
    go('/events/OLD');
    go('/artists/appearance:OLD:PUBLIC');
    expect(within(back()).getByRole('link', { name: '이전 화면으로: Past event' })).toHaveAttribute('href', '/events/OLD');
    expect(within(back()).getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
    go('/events/OLD');
    expect(within(back()).getByRole('link', { name: '이전 화면으로: 이벤트' })).toHaveAttribute('href', '/events');
    // Home is the root: from there the trail starts over.
    go('/');
    go('/signal');
    expect(within(back()).getByRole('link', { name: '이전 화면으로: 홈' })).toHaveAttribute('href', '/');
  });

  it('makes every plate but the open one a single link, with its cells as cards of their own', () => {
    const { container, go } = shell([past, upcoming]);
    const face = (id: string) => plate(container, id).querySelector(':scope > [data-layer=current] > *');
    expect(face('events')).toHaveAttribute('href', '/events');
    expect(face('artists')).toHaveAttribute('href', '/artists');
    expect(face('log')).toHaveAttribute('href', '/transmit');
    expect(within(plate(container, 'next')).getByRole('link', { name: /다음 행사 TERMINAL \[03\] 상세 보기/ })).toHaveAttribute('href', '/events/TRM-03');
    expect(within(item(container, 'event:TRM-03')).getByRole('link')).toHaveAttribute('href', '/events/TRM-03');
    go('/events');
    expect(face('events')?.tagName).not.toBe('A');
    expect(face('next')?.tagName).not.toBe('A');
    expect(within(plate(container, 'next')).getByRole('link', { name: /상세 보기/ })).toHaveAttribute('href', '/events/TRM-03');
  });

  it('keeps layout children and typed drafts mounted across views', () => {
    const { go } = shell();
    const draft = screen.getByRole('textbox', { name: '초안' });
    fireEvent.change(draft, { target: { value: 'typed' } });
    go('/artists');
    expect(screen.getByRole('textbox', { name: '초안' })).toBe(draft);
    expect(draft).toHaveValue('typed');
  });

  it('asks a short desktop window to grow, and lets the visitor go on anyway', () => {
    viewport(1440, 520);
    const { container } = shell();
    expect(screen.getByRole('heading', { level: 1, name: '창을 조금 더 키워 주세요' })).toBeInTheDocument();
    expect(container.querySelector('#stage')).toHaveAttribute('data-short');
    fireEvent.click(screen.getByRole('button', { name: '이대로 보기' }));
    expect(screen.queryByRole('heading', { name: '창을 조금 더 키워 주세요' })).not.toBeInTheDocument();
    expect(container.querySelector('#stage')).not.toHaveAttribute('data-short');
    cleanup();
    // A narrow (phone) window is never asked: it gets sheets.
    viewport(390, 520);
    shell();
    expect(screen.queryByRole('heading', { name: '창을 조금 더 키워 주세요' })).not.toBeInTheDocument();
  });

  it('never switches to a scrolling page: a narrow window gets sheets to snap between', () => {
    const { container } = shell();
    expect(container.querySelector('#stage')).toHaveAttribute('data-stage', 'stage');
    expect(document.documentElement.dataset.stageMode).toBe('stage');
    expect(document.documentElement.dataset.sheets).toBe('1');
    cleanup();
    viewport(390, 844);
    const small = shell();
    expect(small.container.querySelector('#stage')).toHaveAttribute('data-stage', 'stage');
    expect(Number(document.documentElement.dataset.sheets)).toBeGreaterThan(1);
  });
});

describe('stage views', () => {
  it('keeps the row as a sub-plate of the directory and opens the session as a plate of its own', async () => {
    const { container, go } = shell([past, upcoming]);
    go('/events');
    const row = item(container, 'event:OLD');
    expect(row).toHaveAttribute('data-mode', 'row');
    // Sub-plates live inside their plate: they ride along with it.
    expect(plate(container, 'events').contains(row)).toBe(true);
    expect(within(row).getByRole('link', { name: /Past event/ })).toHaveAttribute('href', '/events/OLD');
    go('/events/OLD');
    expect(item(container, 'event:OLD')).toBe(row);
    expect(row).toHaveAttribute('data-mode', 'index');
    expect(within(row).getByRole('link')).toHaveAttribute('aria-current', 'page');
    const file = detail(container, 'event:OLD');
    expect(file).toHaveAttribute('data-mode', 'open');
    const title = await within(file).findByRole('heading', { level: 1, name: 'Past event' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(plate(container, 'events')).toHaveAttribute('data-mode', 'index');
    go('/events');
    expect(item(container, 'event:OLD')).toBe(row);
    expect(row).toHaveAttribute('data-mode', 'row');
    expect(detail(container, 'event:OLD')).toHaveAttribute('data-mode', 'closed');
    expect(detail(container, 'event:OLD')).toHaveAttribute('data-visible', 'false');
  });

  it('goes back on Escape like the back card, but not while typing', () => {
    const { go } = shell();
    go('/events');
    go('/events/OLD');
    fireEvent.keyDown(screen.getByRole('textbox', { name: '초안' }), { key: 'Escape' });
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(router.push).toHaveBeenCalledWith('/events', { scroll: false });
  });

  it('groups the public running order by stage without private names, and closes past requests', () => {
    const { container, go } = shell([{ ...past, artists: [...past.artists, artist('SECOND', 'SECOND ARTIST', { dock: '2', time: '02:00–03:00' })] }]);
    go('/events/OLD');
    const file = detail(container, 'event:OLD');
    expect(within(within(file).getByRole('region', { name: '무대 1' })).getByRole('link', { name: /VISIBLE ARTIST/ })).toHaveAttribute('href', '/artists/appearance%3AOLD%3APUBLIC');
    expect(within(file).getByRole('region', { name: '무대 2' })).toHaveTextContent('02:00–03:00');
    expect(container).not.toHaveTextContent('PRIVATE NAME');
    expect(within(file).queryByRole('link', { name: /게스트 신청/ })).not.toBeInTheDocument();
  });

  it('offers the language only where a text comes in two, and reads the browser’s language first', () => {
    const bilingualEvent = { ...past, subtitle: 'A Voyage to the Unknown Sector.', stage: { ko: '방향', en: 'Bearing' }, description: { ko: '한국어 소개\n둘째 줄\n\n다음 문단', en: 'English briefing\nSecond line\n\nNext paragraph' } };
    const { container, go } = shell([bilingualEvent]);
    go('/events/OLD');
    const file = detail(container, 'event:OLD');
    expect(file).toHaveTextContent('한국어 소개');
    const briefing = within(file).getByRole('group', { name: '행사 소개' });
    expect(Array.from(briefing.querySelectorAll('p'), p => p.textContent)).toEqual(['한국어 소개\n둘째 줄', '다음 문단']);
    expect(file).not.toHaveTextContent('방향');
    expect(file).not.toHaveTextContent(bilingualEvent.subtitle);
    const toggle = within(file).getByRole('group', { name: '소개글 언어' });
    fireEvent.click(within(toggle).getByRole('button', { name: 'EN' }));
    expect(file).toHaveTextContent('English briefing');
    expect(Array.from(briefing.querySelectorAll('p'), p => p.textContent)).toEqual(['English briefing\nSecond line', 'Next paragraph']);
    expect(file).not.toHaveTextContent('Bearing');
    expect(file).not.toHaveTextContent(bilingualEvent.subtitle);
    expect(window.localStorage.getItem('terminal:language')).toBe('en');
    fireEvent.click(within(toggle).getByRole('button', { name: 'KO' }));
    window.localStorage.removeItem('terminal:language');
  });

  it('reads the complete manifesto in either language with authored lines and paragraphs intact', () => {
    const { container, go } = shell();
    go('/about');
    const about = plate(container, 'about');
    const copy = within(about).getByRole('group', { name: 'TERMINAL 소개' });
    const toggle = within(about).getByRole('group', { name: '소개글 언어' });
    for (const language of ['ko', 'en'] as const) {
      fireEvent.click(within(toggle).getByRole('button', { name: language.toUpperCase() }));
      expect(Array.from(copy.querySelectorAll('p'), p => p.textContent)).toEqual([
        siteContent.tagline,
        ...siteContent.manifesto[language].split('\n\n'),
        'Terminal Architect : STANN LUMO',
      ]);
    }
    fireEvent.click(within(toggle).getByRole('button', { name: 'KO' }));
    window.localStorage.removeItem('terminal:language');
  });

  it('shows no language switch for a text in one language', () => {
    const { container, go } = shell([{ ...past, description: { ko: '한국어만', en: '' } }]);
    go('/events/OLD');
    expect(within(detail(container, 'event:OLD')).queryByRole('group', { name: '소개글 언어' })).not.toBeInTheDocument();
  });

  it('drops the text-art frame lines of an invitation but keeps its title', () => {
    const framed = { ...past, invitationLines: { ko: ['인사말', '┌──────────┐', ' TERMINAL [01] : BOOT', '└──────────┘', '[ NOTICE ]'], en: [] } } as TerminalEvent;
    const { container, go } = shell([framed]);
    go('/events/OLD');
    const file = detail(container, 'event:OLD');
    expect(file).toHaveTextContent('TERMINAL [01] : BOOT');
    expect(file).toHaveTextContent('[ NOTICE ]');
    expect(file.textContent).not.toMatch(/[┌└─]/);
  });

  it('opens the guest form inside the session file on /request', () => {
    const { container, go } = shell([past, upcoming]);
    go('/events/TRM-03/request');
    const file = detail(container, 'event:TRM-03');
    expect(within(file).getByRole('heading', { name: '게스트 신청서' })).toBeInTheDocument();
    expect(within(file).getByRole('link', { name: '신청 닫기' })).toHaveAttribute('href', '/events/TRM-03');
    expect(within(file).queryByRole('group', { name: '행사 소개' })).not.toBeInTheDocument();
  });

  it('shows an unknown session as an error inside the open directory', () => {
    const { container, go } = shell();
    go('/events/NOPE');
    expect(plate(container, 'events')).toHaveAttribute('data-mode', 'hero');
    expect(screen.getByRole('alert')).toHaveTextContent('NOPE');
  });

  it('orders live, upcoming, then past sessions in the directory and hides private names', () => {
    const live = { ...past, id: 'LIVE', session: 'Live event', date: '2000-01-01', status: 'LIVE' as const };
    const { container, go } = shell([past, upcoming, live]);
    go('/events');
    const rows = [...container.querySelectorAll<HTMLElement>('[data-item^="event:"][data-mode=row]')];
    expect(rows.map(row => row.dataset.item)).toEqual(['event:LIVE', 'event:TRM-03', 'event:OLD']);
    expect(container).not.toHaveTextContent('PRIVATE NAME');
  });

  it('pages the directory by the rows that fit and links pages without removed filters', () => {
    const events = Array.from({ length: 40 }, (_, index) => ({ ...past, id: `EVENT ${String(index).padStart(2, '0')}`, session: `EVENT ${index}` }));
    const { container, go } = shell(events);
    go('/events');
    const perPage = [...container.querySelectorAll<HTMLElement>('[data-item^="event:"]')].filter(shown).length;
    expect(perPage).toBeGreaterThan(2);
    go('/events', 'page=2&q=absent&year=1900');
    const rows = [...container.querySelectorAll<HTMLElement>('[data-item^="event:"]')].filter(shown);
    expect(rows[0]).toHaveAttribute('data-item', `event:EVENT ${String(perPage).padStart(2, '0')}`);
    const pager = screen.getByRole('navigation', { name: '목록 쪽 이동' });
    expect(within(pager).getByRole('link', { name: 'PREV' })).toHaveAttribute('href', '/events');
    expect(screen.queryByRole('textbox', { name: /검색/ })).not.toBeInTheDocument();
  });

  it('links repeated confirmed appearances to one canonical artist and highlights only STANN LUMO', () => {
    const lumo = { ...past.artists[0], name: 'STANN LUMO' };
    const { container, go } = shell([
      { ...past, id: 'TRM-01', artists: [{ ...lumo, id: '01-A' }] },
      { ...past, id: 'TRM-02', artists: [{ ...lumo, id: '02-A' }] },
      { ...past, id: 'OTHER', artists: [{ ...lumo, id: 'X' }] },
    ]);
    go('/artists');
    const canonical = item(container, 'artist:stann-lumo');
    expect(within(canonical).getByRole('link')).toHaveAttribute('data-featured', 'true');
    expect(within(canonical).getByRole('heading', { name: 'STANN LUMO' })).toBeInTheDocument();
    const other = item(container, 'artist:appearance:OTHER:X');
    expect(within(other).getByRole('link')).not.toHaveAttribute('data-featured');
    expect(container).not.toHaveTextContent('참여 행사');
    expect(container).not.toHaveTextContent('최근 출연');
  });

  it('keeps the artist biography and source events without attendance or recency summaries', () => {
    const { container, go } = shell([{ ...past, artists: [{ ...past.artists[0], description: 'Artist biography' }] }]);
    go('/artists/appearance:OLD:PUBLIC');
    const file = detail(container, 'artist:appearance:OLD:PUBLIC');
    expect(within(file).getByRole('heading', { level: 1, name: 'VISIBLE ARTIST' })).toBeInTheDocument();
    expect(within(file).getAllByRole('link', { name: /Past event/ })[0]).toHaveAttribute('href', '/events/OLD');
    expect(within(file).getByText('Artist biography')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('APPEARANCES');
  });
});

describe('home plates', () => {
  it('counts down to the next session and keeps useful links when there are none', async () => {
    const { container, client } = shell([past, upcoming]);
    const next = within(plate(container, 'next')).getByRole('region', { name: '대표 행사' });
    expect(within(next).getByRole('heading', { name: 'TERMINAL [03]' })).toBeInTheDocument();
    expect(within(next).getByRole('timer', { name: '이벤트 시작까지 남은 시간' })).toBeInTheDocument();
    act(() => client.setQueryData(['events'], []));
    expect(await within(plate(container, 'next')).findByText('공개된 행사가 아직 없습니다')).toBeInTheDocument();
    expect(within(plate(container, 'next')).getByRole('link', { name: /소식 신청/ })).toHaveAttribute('href', '/signal');
  });

  it('shows node activity without times, visitor handles or messages', async () => {
    const { container, client } = shell();
    act(() => client.setQueryData(['transmit', 1], { logs: [
      { id: 'log-2', ts: '2026.05.09 / 00:20', handle: 'NODE-K7Q2M', message: 'node text', createdAt: '2026-05-08T15:20:00.000Z' },
      { id: 'log-1', ts: '2026.05.09 / 00:10', handle: 'SECRET_HANDLE', message: 'free text', createdAt: '2026-05-08T15:10:00.000Z' },
    ], total: 2, page: 1, totalPages: 1 }));
    await waitFor(() => expect(plate(container, 'log')).toHaveTextContent('NODE-K7Q2M'));
    const tags = [...plate(container, 'log').querySelectorAll('li b')].map(tag => tag.textContent);
    expect(tags[1]).toMatch(/^NODE-[A-HJ-NP-Z2-9]{5}$/);
    expect(container).not.toHaveTextContent('05.09');
    expect(container).not.toHaveTextContent('SECRET_HANDLE');
    expect(container).not.toHaveTextContent('free text');
  });

  it('draws the session cells as the sessions’ own elements, which become the directory rows', () => {
    const { container, go } = shell([past, upcoming]);
    const cell = item(container, 'event:TRM-03');
    expect(cell).toHaveAttribute('data-mode', 'cell');
    expect(within(plate(container, 'events')).queryAllByRole('listitem')).toHaveLength(0);
    go('/events');
    expect(item(container, 'event:TRM-03')).toBe(cell);
    expect(cell).toHaveAttribute('data-mode', 'row');
  });
});

describe('visitor log plate', () => {
  it('tracks initial load, refresh, failure and retry without discarding the last public logs', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    clients.push(client);
    client.setQueryData(['events'], [past]);
    navigation.pathname = '/transmit';
    const { container } = render(<QueryClientProvider client={client}><Shell>{null}</Shell></QueryClientProvider>);
    const indicator = () => plate(container, 'log').querySelector('[aria-hidden=true][data-state]')!;
    const result = { logs: [{ id: '1', handle: 'PUBLIC', message: '보존할 로그', ts: '2026.09.24', createdAt: '2026-09-24T00:00:00Z' }], page: 1, total: 1, totalPages: 1 };
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state', 'loading'));
    await act(async () => { resolve(new Response(JSON.stringify(result))); });
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state', 'ready'));
    act(() => { void client.invalidateQueries({ queryKey: ['transmit'] }); });
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state', 'loading'));
    expect(screen.getByText('보존할 로그')).toBeInTheDocument();
    await act(async () => { resolve(new Response(JSON.stringify({ error: 'UNAVAILABLE' }), { status: 503 })); });
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state', 'error'));
    expect(screen.getByText('보존할 로그')).toBeInTheDocument();
    fireEvent.click(within(plate(container, 'log')).getByRole('button', { name: '다시 불러오기' }));
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state', 'loading'));
    await act(async () => { resolve(new Response(JSON.stringify(result))); });
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state', 'ready'));
    vi.unstubAllGlobals();
  });
});

describe('directory and roster contracts', () => {
  const stage = (container: HTMLElement) => container.querySelector<HTMLElement>('#stage')!;

  it('keeps past events reachable in the unified list when nothing is upcoming', () => {
    const { container, go } = shell();
    go('/events');
    expect(within(item(container, 'event:OLD')).getByRole('link', { name: /Past event/ })).toHaveAttribute('href', '/events/OLD');
    expect(within(plate(container, 'events')).getByText('지난 행사').nextElementSibling).toHaveTextContent('1');
    expect(within(stage(container)).queryByRole('link', { name: /게스트 신청/ })).not.toBeInTheDocument();
  });

  it('shows every public artist and every record without reviving removed search or filters', () => {
    const { container, go } = shell([past, upcoming]);
    go('/artists', 'q=PRIVATE&origin=US&sort=count');
    expect(within(stage(container)).getByRole('heading', { name: 'VISIBLE ARTIST' })).toBeInTheDocument();
    expect(container).not.toHaveTextContent('PRIVATE NAME');
    go('/events', 'q=absent&year=2024&venue=OTHER');
    expect(within(stage(container)).getByRole('heading', { name: 'Past event' })).toBeInTheDocument();
    expect(within(stage(container)).getAllByRole('heading', { name: 'TERMINAL [03]' }).length).toBeGreaterThan(0);
    expect(within(stage(container)).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(stage(container)).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('pages the roster grid by the cells that fit', () => {
    const events = [{ ...past, artists: Array.from({ length: 60 }, (_, index) => artist(`A${index}`, `ARTIST ${String(index).padStart(2, '0')}`)) }];
    const { container, go } = shell(events);
    go('/artists');
    const perPage = [...container.querySelectorAll<HTMLElement>('[data-item^="artist:"]')].filter(shown).length;
    go('/artists', 'page=2');
    const cells = [...container.querySelectorAll<HTMLElement>('[data-item^="artist:"]')].filter(shown);
    expect(within(cells[0]).getByRole('heading', { name: `ARTIST ${String(perPage).padStart(2, '0')}` })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: '목록 쪽 이동' })).getByRole('link', { name: 'PREV' })).toHaveAttribute('href', '/artists');
  });

  it('orders upcoming sessions by start time and moves one to the past at its start boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T22:59:59+09:00'));
    const later = { ...past, id: 'LATER', session: 'Later event', date: '2026-11-28', time: '23:30', status: 'UPCOMING' as const };
    const next = { ...past, id: 'NEXT', session: 'Next event', date: '2026-11-28', time: '23:00', status: 'UPCOMING' as const };
    const { container, go } = shell([past, later, next]);
    go('/events');
    const order = () => [...container.querySelectorAll<HTMLElement>('[data-item^="event:"][data-mode=row]')].map(row => row.dataset.item);
    expect(order()).toEqual(['event:NEXT', 'event:LATER', 'event:OLD']);
    const row = within(item(container, 'event:NEXT')).getByRole('link');
    expect(row).toHaveAttribute('data-event-state', 'UPCOMING');
    act(() => vi.advanceTimersByTime(1000));
    expect(row).toHaveAttribute('data-event-state', 'ARCHIVED');
    expect(order()).toEqual(['event:LATER', 'event:NEXT', 'event:OLD']);
  });

  it('keeps the home clock after a session starts, then counts down to the next one registered', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T22:59:59+09:00'));
    const soon = { ...upcoming, date: '2026-11-28', time: '23:00 KST' };
    const { container, client } = shell([past, soon]);
    const next = () => within(plate(container, 'next'));
    expect(next().getByRole('timer', { name: '이벤트 시작까지 남은 시간' })).toHaveTextContent('T- COUNTDOWN');
    act(() => vi.advanceTimersByTime(1000));
    expect(next().getByRole('timer', { name: '이벤트 시작 후 경과 시간' })).toHaveTextContent('T+ ELAPSED');
    act(() => vi.advanceTimersByTime(2000));
    expect(within(next().getByRole('timer')).getByText('초').nextElementSibling).toHaveTextContent('02');
    const registered = { ...soon, id: 'TRM-04', session: 'TERMINAL [04]', date: '2026-12-28' };
    act(() => {
      client.setQueryData(['events'], [past, { ...soon, status: 'LIVE' }, registered]);
      vi.advanceTimersByTime(1);
    });
    expect(next().getByRole('heading', { name: 'TERMINAL [04]' })).toBeInTheDocument();
    expect(next().getByRole('timer', { name: '이벤트 시작까지 남은 시간' })).toHaveTextContent('T- COUNTDOWN');
  });

  it('never presents a failed event query as zero records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    const { container } = render(<QueryClientProvider client={client}><Shell>{null}</Shell></QueryClientProvider>);
    await waitFor(() => expect(within(plate(container, 'next')).getByRole('alert')).toHaveTextContent('행사 기록을 불러오지 못했습니다'));
    expect(container).not.toHaveTextContent('공개된 행사가 아직 없습니다');
    vi.unstubAllGlobals();
  });

  it('keeps a failed file in its place with a retry, and prints no zero counts meanwhile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    navigation.pathname = '/artists/nobody';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    const { container } = render(<QueryClientProvider client={client}><Shell>{null}</Shell></QueryClientProvider>);
    const file = () => container.querySelector<HTMLElement>('[data-detail=pending]');
    await waitFor(() => expect(file()).not.toBeNull());
    await waitFor(() => expect(within(file()!).getByRole('alert')).toHaveTextContent('아티스트 기록을 불러오지 못했습니다'));
    expect(within(file()!).getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
    // The small plates state the failure in one line and never claim zero records.
    expect(within(plate(container, 'next')).getByRole('status')).toHaveTextContent('행사 기록을 불러오지 못했습니다');
    expect(container).not.toHaveTextContent(/000 (FILES|REC)/);
    vi.unstubAllGlobals();
  });
});

describe('event countdown', () => {
  it('resynchronizes the KST timer after a hidden tab and omits invalid start times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T13:59:59.500Z'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const { rerender } = render(<EventCountdown event={{ date: '2026-11-28', time: '23:00 KST' }} />);
    expect(within(screen.getByRole('timer')).getByText('초').nextElementSibling).toHaveTextContent('01');
    visibility.mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(6500));
    expect(screen.getByRole('timer')).toHaveTextContent('T- COUNTDOWN');
    visibility.mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByRole('timer', { name: '이벤트 시작 후 경과 시간' })).toHaveTextContent('T+ ELAPSED');
    expect(within(screen.getByRole('timer')).getByText('초').nextElementSibling).toHaveTextContent('06');
    rerender(<EventCountdown event={{ date: '2026-11-28', time: 'TBA' }} />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});

describe('boot screen', () => {
  it('shows while the console gets ready and steps aside once it is', async () => {
    const { container } = shell();
    const boot = () => container.ownerDocument.querySelector<HTMLElement>('[role=status][class*=bootLine]')?.parentElement;
    expect(boot()).toBeTruthy();
    await waitFor(() => expect(boot()).toHaveAttribute('data-done'));
    expect(boot()).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('stage scroll', () => {
  it('keeps the scroll when a list page turns, and starts a new scene at its top', () => {
    const { go } = shell();
    go('/artists');
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    go('/artists', 'page=2');
    go('/transmit');
    go('/transmit', 'page=2');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    scrollTo.mockRestore();
  });
});

describe('public log window', () => {
  it('puts a page of any size together from the server pages of five, in order', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    clients.push(client);
    const log = (n: number) => ({ id: `L${n}`, handle: `h${n}`, message: 'm', ts: '09.30 12:00', createdAt: '2026-09-30T03:00:00.000Z' });
    for (const page of [1, 2, 3]) {
      client.setQueryData(['transmit', page], { logs: [1, 2, 3, 4, 5].map(i => log((page - 1) * 5 + i)), total: 14, page, totalPages: 3 });
    }
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    // Entries 8 to 13 (the second page of six) span server pages 2 and 3.
    const { result } = renderHook(() => useTransmitRange(7, 6), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.logs.map(entry => entry.id)).toEqual(['L8', 'L9', 'L10', 'L11', 'L12', 'L13']);
    expect(result.current.data!.total).toBe(14);
  });
});

describe('stage viewport', () => {
  it('ignores a touch browser sliding its toolbar while the page scrolls, but follows a turn of the phone', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('coarse'), media: query, addEventListener() {}, removeEventListener() {} }));
    viewport(390, 700);
    const { result } = renderHook(() => useViewport());
    expect(result.current).toMatchObject({ w: 390, h: 700 });
    const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 200)));
    viewport(390, 780);
    act(() => void window.dispatchEvent(new Event('resize')));
    await settle();
    expect(result.current).toMatchObject({ w: 390, h: 700, resizing: false });
    viewport(844, 390);
    act(() => void window.dispatchEvent(new Event('resize')));
    await settle();
    expect(result.current).toMatchObject({ w: 844, h: 390, resizing: false });
    vi.unstubAllGlobals();
  });
});
