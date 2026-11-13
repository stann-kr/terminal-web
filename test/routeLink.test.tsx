import type { ReactNode } from 'react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,render,screen } from '@testing-library/react';
import RouteLink, { ROUTE_HOLD_MS } from '../features/ui/RouteLink';

const router={push:vi.fn(),replace:vi.fn(),prefetch:vi.fn()};
vi.mock('next/navigation',()=>({useRouter:()=>router}));
// Stands in for next/link: a client move prevents the click's default and asks onNavigate first.
vi.mock('next/link',()=>({default:({href,onNavigate,children,replace:_replace,scroll:_scroll,...props}:{href:string;onNavigate?:(event:{preventDefault():void})=>void;children:ReactNode;replace?:boolean;scroll?:boolean})=>{
  return <a {...props} href={href} onClick={event=>{event.preventDefault();let go=true;onNavigate?.({preventDefault:()=>{go=false;}});if(go) router.push(href);}}>{children}</a>;
}}));

beforeEach(()=>{ vi.useFakeTimers();vi.clearAllMocks(); });
afterEach(()=>{ cleanup();vi.useRealTimers(); });
describe('route link',()=>{
  it('fetches the view at once and moves only after the hold, once however often it is pressed',()=>{
    render(<RouteLink href="/events/TRM-03" scroll={false}>TRM-03</RouteLink>);
    const link=screen.getByRole('link');
    act(()=>{ link.click();link.click(); });
    expect(router.prefetch).toHaveBeenCalledWith('/events/TRM-03',{kind:'full'});
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS-1); });
    expect(router.push).not.toHaveBeenCalled();
    act(()=>{ vi.advanceTimersByTime(1); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/events/TRM-03',{scroll:false});
  });
  it('lets a press on another link take over',()=>{
    render(<><RouteLink href="/events">EVENTS</RouteLink><RouteLink href="/artists" replace>ARTISTS</RouteLink></>);
    act(()=>{ screen.getByRole('link',{name:'EVENTS'}).click(); });
    act(()=>{ screen.getByRole('link',{name:'ARTISTS'}).click(); });
    act(()=>{ vi.advanceTimersByTime(ROUTE_HOLD_MS); });
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/artists',{scroll:true});
  });
});
