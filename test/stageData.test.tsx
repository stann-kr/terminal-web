import { act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '../features/shell/Providers';
import { EventsData } from '../features/events/data';
import type { TerminalEvent } from '../lib/events/types';

const event: TerminalEvent = {
  id: 'SSR', session: 'SERVER SESSION', subtitle: 'PUBLIC', date: '2026-10-01', time: '23:00',
  venue: 'VENUE', district: 'SEOUL', coords: '0,0', capacity: '100', sound: 'SYSTEM',
  status: 'UPCOMING', artists: [],
};
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('public events in the initial stage document', () => {
  it('renders public data before JavaScript and hydrates the same lifecycle snapshot', async () => {
    vi.useFakeTimers();
    const updatedAt = Date.parse('2026-10-01T13:59:59Z');
    vi.setSystemTime(updatedAt);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const view = (
      <Providers initialEvents={{ events: [event], updatedAt }}>
        <EventsData>{(events) => <h1>{events[0].session} / {events[0].status}</h1>}</EventsData>
      </Providers>
    );
    const html = renderToString(view);
    expect(html).toContain('SERVER SESSION');
    expect(html).toContain('UPCOMING');
    expect(fetch).not.toHaveBeenCalled();
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const heading = container.querySelector('h1');
    // The wall clock crosses the event boundary before hydration.
    vi.setSystemTime(updatedAt + 2000);
    const onRecoverableError = vi.fn();
    await act(async () => { root = hydrateRoot(container, view, { onRecoverableError }); });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector('h1')).toBe(heading);
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(heading).toHaveTextContent('ARCHIVED');
  });

  it('keeps the loading fallback when no server snapshot is available', () => {
    const html = renderToString(<Providers><EventsData>{() => <p>FABRICATED DATA</p>}</EventsData></Providers>);
    expect(html).not.toContain('FABRICATED DATA');
    expect(html).toContain('불러오는 중');
  });
});
