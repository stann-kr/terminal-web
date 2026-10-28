import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,render,screen } from '@testing-library/react';
import RouteLink from '../features/ui/RouteLink';
import { ROUTE_HOLD_MS,useRouteHold } from '../features/ui/useRouteHold';
import { clearPending,PENDING_LIMIT_MS } from '../features/shell/useConsoleMotion';

const router={push:vi.fn(),replace:vi.fn(),prefetch:vi.fn()};
vi.mock('next/navigation',()=>({useRouter:()=>router}));
// Stands in for next/link: a client move prevents the click's default and asks onNavigate first.
vi.mock('next/link',()=>({default:({href,onNavigate,children,replace:_replace,scroll:_scroll,...props}:{href:string;onNavigate?:(event:{preventDefault():void})=>void;children:ReactNode;replace?:boolean;scroll?:boolean})=>{
  return <a {...props} href={href} onClick={event=>{event.preventDefault();let go=true;onNavigate?.({preventDefault:()=>{go=false;}});if(go) router.push(href);}}>{children}</a>;
}}));

/** A pager whose keys move by the router, as the visitor log's PREV/NEXT do. */
function Pager({ hidden=false }:{ hidden?:boolean }) {
  const go=useRouteHold();
  return <nav>
    <button type="button" onClick={event=>go('/transmit',{control:event.currentTarget,scroll:false})}>PREV</button>
    <button type="button" hidden={hidden} onClick={event=>go('/transmit?page=3',{control:event.currentTarget,scroll:false})}>NEXT</button>
    <button type="button" onClick={()=>go('/transmit?page=3',{control:screen.getByText('NEXT',{selector:'button'}),scroll:false})}>KEY</button>
    <RouteLink href="/transmit?page=3" scroll={false}>LINK</RouteLink>
  </nav>;
}
const key=(name:string)=>screen.getByText(name,{selector:'button'});

beforeEach(()=>{ vi.useFakeTimers();vi.clearAllMocks(); });
afterEach(()=>{ clearPending();cleanup();vi.useRealTimers();vi.unstubAllGlobals(); });
describe('route hold for buttons and keys',()=>{
  it('covers the pressed button at once and moves after the hold, once however often it is pressed',()=>{
    render(<Pager/>);
    const next=key('NEXT');
    next.focus();
    act(()=>{ next.click(); });
    expect(next).toHaveAttribute('data-pending');
    expect(document.documentElement).toHaveAttribute('data-navigating');
    expect(router.prefetch).toHaveBeenCalledWith('/transmit?page=3',{kind:'full'});
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS-1); });
    act(()=>{ next.click(); });
    expect(router.push).not.toHaveBeenCalled();
    act(()=>{ vi.advanceTimersByTime(1); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/transmit?page=3',{scroll:false});
    // Handed over and still on its way: further presses (or a held-down key) do not move again.
    act(()=>{ next.click();key('KEY').click(); });
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(1);
    // Still a focused, enabled button through it all.
    expect(next.tagName).toBe('BUTTON');
    expect(next).toBeEnabled();
    expect(next).toHaveFocus();
  });
  it('shows a key’s move on the button it stands for, and lets another press take over',()=>{
    render(<Pager/>);
    act(()=>{ key('KEY').click(); });
    expect(key('NEXT')).toHaveAttribute('data-pending');
    expect(key('KEY')).not.toHaveAttribute('data-pending');
    act(()=>{ key('PREV').click(); });
    expect(key('NEXT')).not.toHaveAttribute('data-pending');
    expect(key('PREV')).toHaveAttribute('data-pending');
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/transmit',{scroll:false});
  });
  it('shares the hold with site links, so a link and its key never move twice',()=>{
    render(<Pager/>);
    act(()=>{ screen.getByRole('link').click(); });
    act(()=>{ key('KEY').click(); });
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(1);
  });
  it('does not send a move again when its link is pressed after the key handed it over, and before it arrived',()=>{
    render(<Pager/>);
    act(()=>{ key('KEY').click(); });
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(1);
    act(()=>{ screen.getByRole('link').click(); });
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(1);
    // Once the view arrived (the marks go with the address), the same link moves again.
    act(()=>{ clearPending(); });
    act(()=>{ screen.getByRole('link').click(); });
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(2);
  });
  it('moves without a cover when the key’s control is not on screen, and gives up the mark in time',()=>{
    // jsdom has no checkVisibility; a browser's answers for a hidden element.
    Object.defineProperty(HTMLElement.prototype,'checkVisibility',{configurable:true,value(this:HTMLElement){ return !this.hidden; }});
    render(<Pager hidden/>);
    act(()=>{ key('KEY').click(); });
    expect(key('NEXT')).not.toHaveAttribute('data-pending');
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(1);
    act(()=>{ vi.advanceTimersByTime(PENDING_LIMIT_MS); });
    expect(document.documentElement).not.toHaveAttribute('data-navigating');
    delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility;
  });
  it('holds and covers the same way when motion is reduced (the stylesheet only stills the cover)',()=>{
    vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('reduce'),media:query,addEventListener(){},removeEventListener(){}}));
    render(<Pager/>);
    act(()=>{ key('NEXT').click(); });
    expect(key('NEXT')).toHaveAttribute('data-pending');
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).toHaveBeenCalledTimes(1);
    const css=readFileSync('app/globals.css','utf8');
    expect(css).toContain(':root :is(a, button)[data-pending]::before');
    expect(css).toContain(':root :is(a, button)[data-pending]::after');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \*,\*::before,\*::after \{ animation: none !important;/);
  });
});
