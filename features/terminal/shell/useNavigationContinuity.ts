'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const entryKey = '__terminalEntry';
type FocusTarget = { id?: string; href?: string; name?: string };
type Snapshot = { top: number; focus?: FocusTarget };

/** The shell owns the one scroll surface; Next retains ownership of routing. */
export function useNavigationContinuity(main: RefObject<HTMLElement | null>, pathname: string, ready: boolean) {
  const current = useRef({ pathname, ready });
  const reconcile = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    current.current = { pathname, ready };
    reconcile.current();
  });

  useEffect(() => {
    const element = main.current;
    if (!element) return;
    const history = window.history;
    const push = history.pushState;
    const replace = history.replaceState;
    const scrollRestoration = history.scrollRestoration;
    const snapshots = new Map<string, Snapshot>();
    const newId = () => crypto.randomUUID();
    let active = typeof history.state?.[entryKey] === 'string' ? history.state[entryKey] as string : newId();
    let pending: { id: string; pathname: string; snapshot?: Snapshot; fresh: boolean } | null = null;
    let frame = 0;
    let disposed = false;
    let restoring = false;
    const stateWithId = (state: unknown, id: string) => ({ ...(typeof state === 'object' && state !== null ? state : {}), [entryKey]: id });
    replace.call(history, stateWithId(history.state, active), '');
    history.scrollRestoration = 'manual';

    const focusTarget = (focused: Element | null): FocusTarget | undefined => focused instanceof HTMLElement && element.contains(focused)
      ? focused.id ? { id: focused.id }
        : focused instanceof HTMLAnchorElement ? { href: focused.getAttribute('href') ?? '', name: focused.textContent ?? '' } : undefined
      : undefined;
    const save = () => {
      if (pending || restoring) return;
      const focus = focusTarget(document.activeElement) ?? snapshots.get(active)?.focus;
      snapshots.set(active, { top: element.scrollTop, focus });
    };
    const activate = (event: MouseEvent) => {
      if (pending || !(event.target instanceof Element)) return;
      const focus = focusTarget(event.target.closest('a[href]'));
      if (focus) snapshots.set(active, { top: element.scrollTop, focus });
    };
    const contentReady = () => current.current.ready && !element.querySelector('.tm-page-pending') && Boolean(element.querySelector('h1'));
    const restore = () => {
      if (frame) return;
      if (!pending || !contentReady() || current.current.pathname !== pending.pathname) return;
      // Let the new route and its reserved layout commit before touching scroll.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (disposed || !pending || !contentReady() || current.current.pathname !== pending.pathname) return;
          const destination = pending;
          pending = null;
          active = destination.id;
          const target = destination.snapshot?.focus;
          const focus = target?.id ? Array.from(element.querySelectorAll<HTMLElement>('[id]')).find(node => node.id === target.id)
            : target?.href ? Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href]')).find(node => node.getAttribute('href') === target.href && node.textContent === target.name)
              : undefined;
          restoring = true;
          element.setAttribute('data-restoring-navigation', 'true');
          if (destination.fresh || destination.snapshot) {
            (focus ?? element.querySelector<HTMLElement>('h1') ?? element).focus({ preventScroll: true });
          }
          element.scrollTop = Math.min(destination.snapshot?.top ?? 0, Math.max(0, element.scrollHeight - element.clientHeight));
          element.removeAttribute('data-restoring-navigation');
          restoring = false;
          save();
        });
      });
    };
    const navigate = (id: string, fresh: boolean) => {
      cancelAnimationFrame(frame);
      frame = 0;
      pending = { id, pathname: window.location.pathname, snapshot: fresh ? undefined : snapshots.get(id), fresh };
      restore();
    };
    const wrappedPush: History['pushState'] = (state, unused, url) => {
      save();
      const id = newId();
      const previousUrl = window.location.href;
      const previousPath = window.location.pathname;
      const snapshot = snapshots.get(active);
      push.call(history, stateWithId(state, id), unused, url);
      const selection = previousPath === window.location.pathname && previousUrl !== window.location.href;
      if (selection && snapshot) snapshots.set(id, snapshot);
      navigate(id, !selection);
    };
    const wrappedReplace: History['replaceState'] = (state, unused, url) => {
      const previousUrl = window.location.href;
      const previousPath = window.location.pathname;
      save();
      const id = pending?.id ?? active;
      replace.call(history, stateWithId(state, id), unused, url);
      if (pending) { pending.pathname = window.location.pathname; restore(); }
      else if (previousUrl !== window.location.href) navigate(id, previousPath !== window.location.pathname);
    };
    const pop = () => {
      save();
      const id = typeof history.state?.[entryKey] === 'string' ? history.state[entryKey] as string : newId();
      if (history.state?.[entryKey] !== id) replace.call(history, stateWithId(history.state, id), '');
      navigate(id, false);
    };
    const interrupt = () => {
      if (!pending) return;
      // New input owns the destination from here; delayed restoration may not steal it.
      active = pending.id;
      pending = null;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    history.pushState = wrappedPush;
    history.replaceState = wrappedReplace;
    reconcile.current = restore;
    const observer = new MutationObserver(restore);
    observer.observe(element, { childList: true, subtree: true });
    element.addEventListener('scroll', save, { passive: true });
    element.addEventListener('focusin', save);
    element.addEventListener('click', activate, true);
    const interactionRoot = element.closest('.tm-shell') ?? element;
    for (const name of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input']) interactionRoot.addEventListener(name, interrupt, { passive: true, capture: true });
    window.addEventListener('popstate', pop);
    save();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reconcile.current = () => {};
      if (history.pushState === wrappedPush) history.pushState = push;
      if (history.replaceState === wrappedReplace) history.replaceState = replace;
      history.scrollRestoration = scrollRestoration;
      element.removeEventListener('scroll', save);
      element.removeEventListener('focusin', save);
      element.removeEventListener('click', activate, true);
      for (const name of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input']) interactionRoot.removeEventListener(name, interrupt, true);
      window.removeEventListener('popstate', pop);
    };
  }, [main]);
}
