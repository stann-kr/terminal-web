import { useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { MotionProvider as AspenMotionProvider } from '../features/terminal/motion/MotionProvider';
import { useReadoutMotion as useAspenReadout } from '../features/terminal/motion/useReadoutMotion';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TerminalButton from '../components/TerminalButton';
import SubmitButton from '../components/SubmitButton';
import ConsentCheckbox from '../components/ui/ConsentCheckbox';
import { useFieldErrors } from '../components/ui/useFieldErrors';
import { useUrlQueryState } from '../lib/useUrlQueryState';
import { useTransmit } from '../app/transmit/useTransmit';
import TransmitPage from '../app/transmit/page';
import { transmitKeys } from '../lib/transmit/client';
import { useEventClock } from '../lib/events/useEventClock';
import { getEffectiveEventStatus, getRequestWindowState } from '../lib/events/lifecycle';
import type { Artist, TerminalEvent } from '../lib/events/types';
import { eventKeys } from '../lib/events/client';
import LineupPage from '../app/lineup/page';
import { TerminalFrame } from '../features/terminal/shell/TerminalFrame';
import { withMinimumLoading } from '../features/terminal/shared/minimumLoading';

vi.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));
import { LangProvider, useLang } from '../lib/langContext';
import GatePage from '../app/gate/page';
import StatusPage from '../app/status/page';
import SleepScreen from '../app/_entry/SleepScreen';
import BootSequence from '../app/_entry/BootSequence';
import DecodeText from '../components/DecodeText';
import AnimatedHeight from '../components/ui/AnimatedHeight';
import { EventCountdown } from '../features/terminal/events/EventCountdown';
import TerminalNavigation from '../components/shell/TerminalNavigation';
import PageLayout from '../components/shell/PageLayout';
import { useTerminalScreen } from '../components/shell/useTerminalScreen';
import EventSummary from '../components/events/EventSummary';
import HomePage from '../app/home/page';
import SignalPage from '../app/signal/page';
import { gsap, ScrollTrigger, revealTerminalReadout } from '../lib/motion/gsap';

afterEach(cleanup);

function QueryHarness() {
  const [event, setEvent] = useUrlQueryState('event');
  return <button onClick={() => setEvent('TRM-02')}>{event || 'NONE'}</button>;
}

function FieldErrorHarness() {
  const { showFieldErrors } = useFieldErrors<'email' | 'message'>('test');

  return (
    <div>
      <input id="test-email" aria-label="Email" />
      <input id="test-message" aria-label="Message" />
      <button type="button" onClick={() => showFieldErrors({ email: 'Required', message: 'Required' })}>
        Validate
      </button>
    </div>
  );
}

describe('interactive control behavior', () => {
  it('selects the request directory precisely and returns focus when the expanded menu closes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TerminalNavigation pathname="/gate/request" />);
    const navigation = within(screen.getByRole('navigation', { name: '주요 메뉴' }));
    expect(navigation.getByRole('link', { name: '게스트 신청' })).toHaveAttribute('aria-current', 'page');
    expect(navigation.getByRole('link', { name: '이벤트' })).not.toHaveAttribute('aria-current');
    const toggle = screen.getByRole('button', { name: /메뉴/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    navigation.getByRole('link', { name: '소식 신청' }).focus();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    rerender(<TerminalNavigation pathname="/link" />);
    for (const link of screen.getAllByRole('link', { name: '공식 채널' })) expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('activates the shared button with keyboard input', async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [count, setCount] = useState(0);
      return <TerminalButton onClick={() => setCount((value) => value + 1)}>COUNT {count}</TerminalButton>;
    };
    render(<Harness />);

    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'COUNT 1' })).toHaveClass('min-h-11');
  });

  it('forwards native ARIA state to the shared button element', () => {
    render(
      <TerminalButton aria-pressed aria-controls="event-view">
        UPCOMING
      </TerminalButton>,
    );

    const button = screen.getByRole('button', { name: 'UPCOMING' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('aria-controls', 'event-view');
  });

  it('uses the checkbox label as a full click target', async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [checked, setChecked] = useState(false);
      return (
        <ConsentCheckbox
          id="consent"
          name="consent"
          checked={checked}
          onChange={setChecked}
          label="Privacy consent"
        />
      );
    };
    render(<Harness />);

    await user.click(screen.getByText('Privacy consent'));
    expect(screen.getByRole('checkbox', { name: 'Privacy consent' })).toBeChecked();
  });

  it('announces pending submission and restores the action when it settles', () => {
    const { rerender } = render(<SubmitButton isSubmitting defaultText="Send request" loadingText="Sending" />);
    expect(screen.getByRole('button', { name: 'Sending' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sending' })).toHaveAttribute('aria-busy', 'true');
    rerender(<SubmitButton isSubmitting={false} defaultText="Send request" loadingText="Sending" />);
    expect(screen.getByRole('button', { name: 'Send request' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send request' })).toHaveAttribute('aria-busy', 'false');
  });

  it('updates selector query state without navigating away', async () => {
    window.history.replaceState(null, '', '/lineup?lang=ko');
    const user = userEvent.setup();
    render(<QueryHarness />);

    await user.click(screen.getByRole('button', { name: 'NONE' }));
    expect(screen.getByRole('button', { name: 'TRM-02' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/lineup');
    expect(window.location.search).toBe('?lang=ko&event=TRM-02');
  });

  it('moves focus to the first invalid field after validation', async () => {
    const user = userEvent.setup();
    render(<FieldErrorHarness />);

    await user.click(screen.getByRole('button', { name: 'Validate' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email' })).toHaveFocus());
  });
});

describe('CRT display preferences', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it.each([false, true])('keeps keyboard control and the display choice across navigation (storage blocked: %s)', async (storageBlocked) => {
    localStorage.removeItem('terminal_crt_enabled');
    if (storageBlocked) {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    }
    const user = userEvent.setup();
    const { container, unmount } = render(<PageLayout><input aria-label="Draft" defaultValue="Keep my message" /></PageLayout>);
    const effects = container.querySelector('[data-crt-effects]')!;
    const display = effects.parentElement;
    expect(display).toContainElement(screen.getByRole('banner'));
    expect(display).toContainElement(screen.getByRole('main'));
    expect(display).toContainElement(screen.getByRole('contentinfo'));
    expect(effects).toHaveAttribute('aria-hidden', 'true');
    const toggle = screen.getByRole('button', { name: 'CRT 화면 효과' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveFocus();
    expect(container.querySelector('[data-crt-effects]')).toHaveAttribute('hidden');
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep my message');
    unmount();

    render(<PageLayout><h1>Next screen</h1></PageLayout>);
    const nextToggle = screen.getByRole('button', { name: 'CRT 화면 효과' });
    expect(nextToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: 'Next screen' })).toBeVisible();
    await user.click(nextToggle);
    expect(nextToggle).toHaveAttribute('aria-pressed', 'true');
  });

});

describe('production Aspen frame', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('runs the first readout after hydration and settles it when the user starts interacting', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    function Content() {
      const root = useRef<HTMLElement>(null);
      useAspenReadout(root, { key: 'first-entry', content: ':scope' });
      return <main ref={root}><p>Hydrated terminal text</p></main>;
    }
    const element = <AspenMotionProvider crt><Content /></AspenMotionProvider>;
    const host = document.createElement('div');
    host.innerHTML = renderToString(element);
    document.body.appendChild(host);
    expect(within(host).getByText('Hydrated terminal text')).toBeVisible();
    let root!: ReturnType<typeof hydrateRoot>;
    try {
      await act(async () => { root = hydrateRoot(host, element); });
      expect(within(host).getByText('Hydrated terminal text')).not.toBeVisible();
      fireEvent.keyDown(within(host).getByRole('main'), { key: 'Tab' });
      expect(within(host).getByText('Hydrated terminal text')).toBeVisible();
    } finally {
      act(() => root?.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });

  it('includes the countdown in the first readout without replaying it on a clock tick', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    function Content() {
      const root = useRef<HTMLElement>(null);
      useAspenReadout(root, { key: 'countdown-entry', content: ':scope', layout: true });
      return <main ref={root}><EventCountdown t={ko => ko} event={{
        id: 'clock', session: 'Clock event', subtitle: '', date: '2099-09-08', time: '23:00 KST', status: 'UPCOMING',
        venue: 'Venue', district: '', coords: '', capacity: '', sound: '', artists: [],
      }} /></main>;
    }
    const { unmount } = render(<AspenMotionProvider crt><Content /></AspenMotionProvider>);
    try {
      const countdown = screen.getByRole('timer', { hidden: true });
      expect(countdown).not.toBeVisible();
      fireEvent.keyDown(screen.getByRole('main'), { key: 'Tab' });
      expect(countdown).toBeVisible();
      const before = countdown.textContent;
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(countdown).toBeVisible();
      expect(countdown.textContent).not.toBe(before);
      for (const value of countdown.querySelectorAll('dd')) expect(value).toBeVisible();
    } finally {
      unmount();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('keeps real route links, a single main and the draft through menu, CRT and language controls', async () => {
    window.history.replaceState(null, '', '/signal');
    localStorage.setItem('terminal_lang', 'ko');
    localStorage.removeItem('terminal_crt_enabled');
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    queryClient.setQueryData(eventKeys.list(), []);
    const user = userEvent.setup();
    const { container } = render(<QueryClientProvider client={queryClient}><LangProvider><TerminalFrame><SignalPage /></TerminalFrame></LangProvider></QueryClientProvider>);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '본문으로 건너뛰기' })).toHaveAttribute('href', '#main-content');
    const nav = within(screen.getByRole('navigation', { name: '주요 메뉴' }));
    expect(nav.getByRole('link', { name: /소식 신청/ })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: /게스트 신청/ })).toHaveAttribute('href', '/gate/request');
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'draft@example.com');
    const menu = screen.getByRole('button', { name: /메뉴/ });
    await user.click(menu);
    nav.getByRole('link', { name: /방명록/ }).focus();
    await user.keyboard('{Escape}');
    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    const crt = screen.getByRole('button', { name: 'CRT 화면 효과' });
    await user.click(crt);
    expect(crt).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('terminal_crt_enabled')).toBe('false');
    await user.click(screen.getByRole('button', { name: '영어로 보기' }));
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('draft@example.com');
    expect(container).not.toHaveTextContent('DEMO02');
    expect(container).not.toHaveTextContent('MOCKUP');
  });
});

describe('brand text motion', () => {
  function advanceMotion(milliseconds: number) {
    act(() => { gsap.globalTimeline.time(gsap.globalTimeline.time() + milliseconds / 1000, false); });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([false, true])('plays once and stays final after a tab return (interrupted: %s)', (interrupted) => {
    const onComplete = vi.fn();
    const props = { speed: 0.9, scramble: 3, step: 2, onComplete };
    const { rerender } = render(<DecodeText as="h1" text="TERMINAL" {...props} />);
    const heading = screen.getByRole('heading', { name: 'TERMINAL' });
    expect(onComplete).not.toHaveBeenCalled();

    advanceMotion(200);
    expect(heading.textContent).not.toBe('TERMINAL');
    expect(heading).toHaveAccessibleName('TERMINAL');
    if (!interrupted) {
      advanceMotion(1_000);
      expect(heading.textContent).toBe('TERMINAL');
      expect(onComplete).toHaveBeenCalledTimes(1);
    }

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(heading.textContent).toBe('TERMINAL');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advanceMotion(200);
    expect(heading.textContent).toBe('TERMINAL');
    expect(onComplete).toHaveBeenCalledTimes(1);

    rerender(<DecodeText as="h1" text="READY" {...props} />);
    rerender(<DecodeText as="h1" text="TERMINAL" {...props} />);
    advanceMotion(1_000);
    expect(heading.textContent).toBe('TERMINAL');
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('keeps reduced-motion text final through its delay and a content change', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    const onComplete = vi.fn();
    const { rerender } = render(<DecodeText as="h1" text="TERMINAL" delay={200} onComplete={onComplete} />);
    expect(screen.getByRole('heading', { name: 'TERMINAL' }).textContent).toBe('TERMINAL');
    expect(onComplete).toHaveBeenCalledTimes(1);
    advanceMotion(1_000);
    expect(onComplete).toHaveBeenCalledTimes(1);

    rerender(<DecodeText as="h1" text="READY" delay={200} onComplete={onComplete} />);
    expect(screen.getByRole('heading', { name: 'READY' }).textContent).toBe('READY');
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('keeps markup literal during scrambling and stops callbacks on unmount', () => {
    const text = '<img src=x onerror=alert(1)> & TERMINAL';
    const onComplete = vi.fn();
    const { unmount, rerender } = render(<DecodeText as="h1" text={text} onComplete={onComplete} />);
    const heading = screen.getByRole('heading', { name: text });
    advanceMotion(1_000);
    expect(heading.children).toHaveLength(0);
    expect(heading).toHaveAccessibleName(text);
    advanceMotion(1_500);
    expect(heading.textContent).toBe(text);
    expect(heading.children).toHaveLength(0);
    expect(onComplete).toHaveBeenCalledOnce();
    rerender(<DecodeText as="h1" text="READY" onComplete={onComplete} />);
    unmount();
    advanceMotion(3_000);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('releases a scene\'s scroll triggers when it unmounts', () => {
    const before = ScrollTrigger.getAll();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { unmount } = render(<EventSummary event={{
      id: 'scene', session: 'Scene event', subtitle: '', date: '2026-09-10', time: '12:00 KST', status: 'UPCOMING',
      venue: 'Venue', district: '', coords: '', capacity: '', sound: '', artists: [],
    }} />);
    expect(ScrollTrigger.getAll().length).toBeGreaterThan(before.length);
    unmount();
    expect(ScrollTrigger.getAll()).toEqual(before);
  });

  it('keeps the full readout available, cancels settling on input, and does not replay a route after policy changes', () => {
    function ScreenHarness({ pathname, enabled = true }: { pathname: string; enabled?: boolean }) {
      const ref = useTerminalScreen(pathname, enabled);
      return <div ref={ref}><main data-scroll-region><button>Read screen</button></main></div>;
    }
    const { rerender, unmount } = render(<ScreenHarness pathname="/home" />);
    const readout = screen.getByRole('main');
    expect(screen.getByRole('button', { name: 'Read screen' })).toBeVisible();
    expect(readout.style.clipPath).toBe('');
    expect(readout.style.transform).toBe('');
    expect(gsap.getTweensOf(readout)).toHaveLength(1);
    fireEvent.keyDown(readout, { key: 'Tab' });
    expect(readout.style.opacity).toBe('');
    expect(gsap.getTweensOf(readout)).toHaveLength(0);

    rerender(<ScreenHarness pathname="/gate" />);
    expect(gsap.getTweensOf(readout)).toHaveLength(1);
    rerender(<ScreenHarness pathname="/gate" enabled={false} />);
    expect(readout.style.opacity).toBe('');
    rerender(<ScreenHarness pathname="/gate" />);
    expect(gsap.getTweensOf(readout)).toHaveLength(0);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    rerender(<ScreenHarness pathname="/lineup" />);
    expect(gsap.getTweensOf(readout)).toHaveLength(0);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(gsap.getTweensOf(readout)).toHaveLength(0);
    rerender(<ScreenHarness pathname="/signal" />);
    expect(gsap.getTweensOf(readout)).toHaveLength(1);
    unmount();
    expect(gsap.getTweensOf(readout)).toHaveLength(0);
  });

  it.each(['before', 'during'])('keeps focused readout content fully lit when focus arrives %s its settle', timing => {
    const { container } = render(<section><div data-readout><button>Read event</button></div></section>);
    const root = container.firstElementChild as HTMLElement;
    const readout = root.querySelector<HTMLElement>('[data-readout]')!;
    const action = screen.getByRole('button', { name: 'Read event' });
    if (timing === 'before') action.focus();
    const dispose = revealTerminalReadout(root, '[data-readout]');
    if (timing === 'during') action.focus();
    expect(action).toHaveFocus();
    expect(readout.style.clipPath).toBe('');
    expect(readout.style.opacity).toBe('');
    dispose?.();
  });

  it('reverses an accordion from its current height and settles on resized content', () => {
    let notifyResize!: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const measure = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
    const { container, rerender, unmount } = render(<AnimatedHeight show={false}><p>Details</p></AnimatedHeight>);
    const outer = container.firstElementChild as HTMLElement;
    rerender(<AnimatedHeight show><p>Details</p></AnimatedHeight>);
    advanceMotion(100);
    const openingHeight = parseFloat(outer.style.height);
    expect(openingHeight).toBeGreaterThan(0);
    expect(openingHeight).toBeLessThan(120);
    rerender(<AnimatedHeight show={false}><p>Details</p></AnimatedHeight>);
    advanceMotion(100);
    expect(parseFloat(outer.style.height)).toBeLessThan(openingHeight);
    expect(outer).toHaveAttribute('inert');
    rerender(<AnimatedHeight show><p>Details</p></AnimatedHeight>);
    measure.mockReturnValue(180);
    act(() => notifyResize());
    advanceMotion(1_000);
    expect(outer.style.height).toBe('180px');
    expect(outer).not.toHaveAttribute('inert');
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

function TransmitHarness() {
  const transmit = useTransmit();
  return (
    <form onSubmit={transmit.handleSubmit}>
      <input aria-label="Alias" value={transmit.handle} onChange={transmit.handleHandleChange} />
      <textarea aria-label="Message" value={transmit.message} onChange={transmit.handleMessageChange} />
      <button type="submit" disabled={transmit.isSubmitting}>Post message</button>
      {transmit.formError && <p role="alert">{transmit.formError}</p>}
      {transmit.sent && <p role="status">Submitted message posted</p>}
    </form>
  );
}

describe('Transmit draft submission', () => {
  afterEach(() => vi.restoreAllMocks());

  const postedEntry = { id: 'post-1', handle: 'NODE', message: 'Hello', ts: '', createdAt: '2026-09-08T00:00:00Z' };
  const emptyPage = { logs: [], total: 0, page: 1, totalPages: 1 };

  function renderTransmit() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><TransmitHarness /></QueryClientProvider>);
  }

  it('shows pagination only when needed and preserves the draft when a later page fails', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    queryClient.setQueryData(transmitKeys.list(1), emptyPage);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status: 500 }));
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><TransmitPage /></QueryClientProvider>);
    expect(screen.queryByRole('navigation', { name: '방명록 페이지' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /메시지/ }), { target: { value: 'Keep this draft' } });
    act(() => {
      queryClient.setQueryData(transmitKeys.list(1), { logs: [postedEntry], total: 21, page: 1, totalPages: 2 });
    });
    const next = await screen.findByRole('button', { name: '다음 글 페이지' });
    expect(screen.getByRole('button', { name: '이전 글 페이지' })).toBeDisabled();
    await user.click(next);
    expect(await screen.findByRole('alert', {}, { timeout: 2_000 })).toHaveTextContent('불러오지 못했습니다');
    expect(fetchMock).toHaveBeenCalledWith('/api/transmit?page=2');
    expect(screen.getByRole('button', { name: '다음 글 페이지' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이전 글 페이지' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '이전 글 페이지' }));
    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /메시지/ })).toHaveValue('Keep this draft');
    expect(screen.getByRole('button', { name: '이전 글 페이지' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 글 페이지' })).toBeEnabled();
  });

  it('preserves a draft edited during a delayed submission and gives it a new idempotency key', async () => {
    const submittedKeys: string[] = [];
    let completeSubmission!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method !== 'POST') return Response.json(emptyPage);
      submittedKeys.push(new Headers(init.headers).get('Idempotency-Key')!);
      if (submittedKeys.length === 1) return new Promise<Response>((resolve) => { completeSubmission = resolve; });
      return Response.json(postedEntry);
    });
    const user = userEvent.setup();
    renderTransmit();
    const message = screen.getByRole('textbox', { name: 'Message' });
    await user.type(message, 'Hello');
    await user.click(screen.getByRole('button', { name: 'Post message' }));
    await waitFor(() => expect(submittedKeys).toHaveLength(1));

    // Even an edit that leaves the normalized payload unchanged is a new draft.
    await user.type(message, ' ');
    await act(async () => completeSubmission(Response.json(postedEntry)));
    await screen.findByRole('status');
    expect(message).toHaveValue('Hello ');

    await user.click(screen.getByRole('button', { name: 'Post message' }));
    await waitFor(() => expect(message).toHaveValue(''));
    expect(submittedKeys).toHaveLength(2);
    expect(submittedKeys[1]).not.toBe(submittedKeys[0]);
  });

  it('retries an unchanged failed submission with the same idempotency key', async () => {
    const submittedKeys: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method !== 'POST') return Response.json(emptyPage);
      submittedKeys.push(new Headers(init.headers).get('Idempotency-Key')!);
      return submittedKeys.length === 1
        ? Response.json({ error: 'FAILED' }, { status: 500 })
        : Response.json(postedEntry);
    });
    const user = userEvent.setup();
    renderTransmit();
    const message = screen.getByRole('textbox', { name: 'Message' });
    await user.type(message, 'Hello');
    await user.click(screen.getByRole('button', { name: 'Post message' }));
    await screen.findByRole('alert');
    expect(message).toHaveValue('Hello');

    await user.click(screen.getByRole('button', { name: 'Post message' }));
    await waitFor(() => expect(message).toHaveValue(''));
    expect(submittedKeys).toHaveLength(2);
    expect(submittedKeys[1]).toBe(submittedKeys[0]);
  });
});

describe('event clock policy updates', () => {
  const event: TerminalEvent = {
    id: 'clock-event', session: 'Clock event', subtitle: 'Test',
    date: '2026-09-10', time: '12:00 KST', status: 'UPCOMING',
    venue: 'Venue', district: 'District', coords: '0,0', capacity: '100', sound: 'System', artists: [],
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the Home event countdown in KST, ticks into elapsed time and omits invalid targets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T11:59:59+09:00'));
    const { rerender } = render(<EventCountdown event={event} t={(ko) => ko} />);
    expect(screen.getByRole('timer', { name: '이벤트 시작까지 남은 시간' })).toHaveTextContent('T− COUNTDOWN');
    expect(screen.getByText('01')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole('timer')).toHaveTextContent('T+ ELAPSED');
    expect(screen.getByText('01')).toBeInTheDocument();
    rerender(<EventCountdown event={{ ...event, date: 'invalid' }} t={(ko) => ko} />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    rerender(<EventCountdown event={null} t={(ko) => ko} />);
    expect(screen.queryByText(/COUNTDOWN|ELAPSED/)).not.toBeInTheDocument();
  });

  it('opens requests and archives a started event at their boundaries without ticking between them', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T11:59:59+09:00'));
    const { result } = renderHook(() => useEventClock([event], 30));
    act(() => vi.advanceTimersByTime(0));
    expect(getRequestWindowState(event, 30, result.current).isActive).toBe(false);

    act(() => vi.advanceTimersByTime(1_000));
    expect(getRequestWindowState(event, 30, result.current).isActive).toBe(true);
    const openedAt = result.current;
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current).toBe(openedAt);

    act(() => vi.advanceTimersByTime(30 * 86_400_000 - 5_000));
    expect(getEffectiveEventStatus(event, result.current)).toBe('ARCHIVED');
    expect(getRequestWindowState(event, 30, result.current).isActive).toBe(false);
  });

  it('recalculates an elapsed event when a background document becomes visible', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T11:59:59+09:00'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { result } = renderHook(() => useEventClock([event], 30));
    act(() => vi.advanceTimersByTime(0));

    vi.setSystemTime(new Date('2026-09-10T12:01:00+09:00'));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(getEffectiveEventStatus(event, result.current)).toBe('UPCOMING');

    visibility.mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(getEffectiveEventStatus(event, result.current)).toBe('ARCHIVED');
    expect(getRequestWindowState(event, 30, result.current).isActive).toBe(false);
  });
});

describe('lineup controls', () => {
  const artist: Artist = {
    id: 'artist-1', name: 'ARTIST ONE', origin: 'KR', dock: '1', time: '23:00–00:00', status: 'CONFIRMED',
    description: { ko: '아티스트의 긴 한국어 소개입니다.', en: 'A longer artist biography in English.' },
  };

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    })));
    localStorage.setItem('terminal_lang', 'ko');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the first published profile and keeps query, language and keyboard focus coherent', async () => {
    const event: TerminalEvent = {
      id: 'live', session: 'Live event', subtitle: 'Test', date: '2026-09-08', time: '23:00 KST', status: 'LIVE',
      venue: 'Venue', district: 'District', coords: '0,0', capacity: '100', sound: 'System', artists: [artist],
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    queryClient.setQueryData(eventKeys.list(), [event]);
    window.history.replaceState(null, '', '/lineup?event=live');
    const user = userEvent.setup();
    function LanguageControl() {
      const { setLang } = useLang();
      return <button onClick={() => setLang('en')}>EN</button>;
    }
    render(<LangProvider><QueryClientProvider client={queryClient}><LineupPage /><LanguageControl /></QueryClientProvider></LangProvider>);
    const trigger = screen.getByRole('link', { name: /ARTIST ONE/ });
    expect(trigger).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'ARTIST ONE' })).toBeVisible();
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'ARTIST ONE' })).toHaveFocus();
    expect(window.location.search).toBe('?event=live&artist=artist-1');
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText('A longer artist biography in English.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'ARTIST ONE' })).toBeVisible();
    act(() => {
      window.history.replaceState(null, '', '/lineup?event=live&artist=missing');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.queryByRole('heading', { name: 'ARTIST ONE' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Artist not found.' })).toBeInTheDocument();
  });

  it('honors the event URL and immediately replaces the lineup and Gate link on selection', async () => {
    const baseEvent: TerminalEvent = {
      id: 'live', session: 'Live event', subtitle: 'Test', date: '2026-09-08', time: '23:00 KST', status: 'LIVE',
      venue: 'Venue', district: 'District', coords: '0,0', capacity: '100', sound: 'System',
      artists: [{ ...artist, name: 'LIVE ARTIST', description: undefined }],
    };
    const archived: TerminalEvent = {
      ...baseEvent, id: 'archive', session: 'Archived event', date: '2025-09-08', status: 'ARCHIVED',
      artists: [{ ...artist, name: 'ARCHIVE ARTIST', description: undefined }],
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
    queryClient.setQueryData(eventKeys.list(), [baseEvent, archived]);
    window.history.replaceState(null, '', '/lineup?lang=ko&event=archive&artist=artist-1');
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><LineupPage /></QueryClientProvider>);

    expect(screen.getByText('Archived event')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이벤트 정보' })).toHaveAttribute('href', '/gate?event=archive');
    const push = vi.spyOn(window.history, 'pushState');
    await user.selectOptions(screen.getByRole('combobox', { name: '이벤트 선택' }), 'live');
    expect(push).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Live event')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'LIVE ARTIST' })).toBeInTheDocument();
    expect(screen.queryByText('ARCHIVE ARTIST')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이벤트 정보' })).toHaveAttribute('href', '/gate?event=live');
    expect(window.location.search).toBe('?lang=ko&event=live');

    act(() => {
      window.history.replaceState(null, '', '/lineup?lang=ko&event=missing');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('heading', { name: '이벤트를 찾을 수 없습니다.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'LIVE ARTIST' })).not.toBeInTheDocument();
  });
});

describe('event page states and optional entry', () => {
  const event: TerminalEvent = {
    id: 'next', session: 'Next event', subtitle: 'Test', date: '2099-09-08', time: '23:00 KST', status: 'UPCOMING',
    venue: 'Venue', district: 'District', coords: '0,0', capacity: '100', sound: 'System', artists: [],
  };
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('keeps the real event information available when its poster fails', () => {
    render(<EventSummary event={{ ...event, posterUrl: '/missing-poster.png' }} />);
    fireEvent.error(screen.getByRole('img', { name: 'Next event 포스터' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('공개된 포스터가 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next event' })).toBeInTheDocument();
  });

  it.each(['UPCOMING', 'ARCHIVED'] as const)('connects the Home event to its correct %s destination', (status) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    queryClient.setQueryData(eventKeys.list(), [{ ...event, status }]);
    window.history.replaceState(null, '', '/home');
    render(<QueryClientProvider client={queryClient}><TerminalFrame><HomePage /></TerminalFrame></QueryClientProvider>);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'Next event' })).toBeInTheDocument();
    expect(within(main).getByRole('timer')).toHaveAccessibleName('이벤트 시작까지 남은 시간');
    expect(main.querySelector('a[href^="/gate?"]')).toHaveAttribute('href', '/gate?event=next');
  });

  it('distinguishes loading, failure and a confirmed empty event registry', async () => {
    vi.useFakeTimers();
    let complete!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    render(<QueryClientProvider client={queryClient}><StatusPage /></QueryClientProvider>);
    const pendingHeading = screen.getByRole('heading', { level: 1, name: 'STATUS' });
    expect(pendingHeading.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(screen.queryByText('지난 이벤트 기준')).not.toBeInTheDocument();
    await act(async () => complete(Response.json({}, { status: 500 })));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
    expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.queryByText('지난 이벤트 기준')).not.toBeInTheDocument();
    act(() => { queryClient.setQueryData(eventKeys.list(), []); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('기록된 이벤트가 없습니다');
    vi.useRealTimers();
  });

  it.each([250, 1_500])('reveals a %d ms request after the longer of its duration and one second', async (duration) => {
    vi.useFakeTimers();
    let finish!: (value: string) => void;
    let revealed = false;
    const result = withMinimumLoading(() => new Promise<string>(resolve => { finish = resolve; }));
    void result.then(() => { revealed = true; });
    await vi.advanceTimersByTimeAsync(duration);
    finish('event data');
    await vi.advanceTimersByTimeAsync(0);
    if (duration < 1_000) {
      expect(revealed).toBe(false);
      await vi.advanceTimersByTimeAsync(1_000 - duration - 1);
      expect(revealed).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(revealed).toBe(true);
    await expect(result).resolves.toBe('event data');
    vi.useRealTimers();
  });

  it('releases the minimum wait immediately when its page request is aborted', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const result = withMinimumLoading(() => Promise.resolve('event data'), controller.signal);
    await vi.advanceTimersByTimeAsync(250);
    controller.abort();
    await expect(result).resolves.toBe('event data');
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('keeps the visible event and focused action when a background refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({}, { status: 500 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    queryClient.setQueryData(eventKeys.list(), [event]);
    window.history.replaceState(null, '', '/home');
    render(<QueryClientProvider client={queryClient}><TerminalFrame><HomePage /></TerminalFrame></QueryClientProvider>);
    const main = within(screen.getByRole('main'));
    const heading = main.getByRole('heading', { name: 'Next event' });
    const action = main.getByRole('link', { name: '이벤트 보기' });
    action.focus();
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: eventKeys.list() });
      // Flush React Query's scheduled observer notification after the request.
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(queryClient.getQueryState(eventKeys.list())?.status).toBe('error');
    expect(main.getByRole('heading', { name: 'Next event' })).toBe(heading);
    expect(action).toHaveFocus();
    expect(action).toHaveAttribute('href', '/gate?event=next');
    expect(main.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps Signal input focus when the unrelated event directory finishes loading', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json([]));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
    window.history.replaceState(null, '', '/signal');
    render(<QueryClientProvider client={queryClient}><TerminalFrame><SignalPage /></TerminalFrame></QueryClientProvider>);
    const email = screen.getByRole('textbox', { name: '이메일' });
    email.focus();
    fireEvent.change(email, { target: { value: 'draft@example.test' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
    expect(queryClient.getQueryData(eventKeys.list())).toEqual([]);
    expect(email).toHaveFocus();
    expect(email).toHaveValue('draft@example.test');
  });

  it('keeps archived deep links and selects events with one history update while requests are closed', () => {
    const archived = { ...event, id: 'old', session: 'Past event', status: 'ARCHIVED' as const };
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    queryClient.setQueryData(eventKeys.list(), [event, archived]);
    window.history.replaceState(null, '', '/gate?view=archive&event=old&lang=ko');
    render(<QueryClientProvider client={queryClient}><GatePage /></QueryClientProvider>);
    expect(screen.getByRole('heading', { name: 'Past event' })).toBeInTheDocument();
    const push = vi.spyOn(window.history, 'pushState');
    fireEvent.change(screen.getByRole('combobox', { name: '이벤트 선택' }), { target: { value: 'next' } });
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?event=next&lang=ko');
    expect(screen.getByRole('heading', { name: 'Next event' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /게스트 신청/ })).not.toBeInTheDocument();
    expect(screen.getByText('현재 온라인 신청 기간이 아닙니다.')).toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, '', '/gate?view=archive&event=old&lang=ko');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('heading', { name: 'Past event' })).toBeInTheDocument();
  });

  it.each([true, false])('resumes exactly once after explicit activation (reduced motion: %s)', async (reduce) => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduce, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })));
    const onWake = vi.fn();
    const user = userEvent.setup();
    render(<SleepScreen onWake={onWake} />);
    await user.tab();
    expect(screen.getByRole('button', { name: '이벤트로 돌아가기' })).toHaveFocus();
    expect(onWake).not.toHaveBeenCalled();
    await user.keyboard('{Enter}{Enter}');
    fireEvent.click(screen.getByRole('button', { name: '이벤트로 돌아가기' }));
    await waitFor(() => expect(onWake).toHaveBeenCalledTimes(1));
  });

  it('skips Boot only through its control, keeps language choice explicit and enters once', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })));
    localStorage.setItem('terminal_lang', 'ko');
    const onComplete = vi.fn();
    const { unmount } = render(<LangProvider><BootSequence onComplete={onComplete} /></LangProvider>);
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(screen.queryByRole('button', { name: /한국어/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '애니메이션 건너뛰기' }));
    expect(screen.getByRole('button', { name: /한국어/ })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip animation' }));
    const enter = screen.getByRole('button', { name: /ENTER TERMINAL/ });
    fireEvent.click(enter);
    fireEvent.click(enter);
    expect(onComplete).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('Signal form results', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('preserves contact details on a duplicate response and announces only a confirmed save', async () => {
    localStorage.setItem('terminal_lang', 'ko');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ error: 'EMAIL_ALREADY_SUBSCRIBED' }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const user = userEvent.setup();
    render(<LangProvider><SignalPage /></LangProvider>);
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'guest@example.com');
    await user.type(screen.getByRole('textbox', { name: '인스타그램 ID' }), 'guest');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '소식 신청' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 구독 중인 이메일입니다.');
    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('guest@example.com');
    expect(screen.queryByRole('heading', { name: '소식 신청 완료' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '소식 신청' }));
    expect(await screen.findByRole('heading', { name: '소식 신청 완료' })).toHaveFocus();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/signal', '/api/signal']);
  });
});
