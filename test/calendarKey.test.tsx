import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,render,screen } from '@testing-library/react';
import type { TerminalEvent } from '../lib/events/types';
import { CALENDAR_OPEN_MS, EventFacts } from '../features/events/EventRecord';

const event:TerminalEvent={ id:'TRM-03',session:'TERMINAL [03]',subtitle:'',date:'2099-11-28',time:'23:00 KST',venue:'FAUST',district:'SEOUL',coords:'',capacity:'',sound:'',status:'UPCOMING',artists:[] };
const as=(userAgent:string)=>vi.spyOn(navigator,'userAgent','get').mockReturnValue(userAgent);
const key=()=>screen.getByRole('link',{name:/CALENDAR/});
// jsdom cannot follow webcal: or open a tab; the press itself is what is checked.
const press=(link:HTMLElement)=>act(()=>{ link.addEventListener('click',e=>e.preventDefault(),{once:true});link.click(); });

beforeEach(()=>{ vi.useFakeTimers(); });
afterEach(()=>{ cleanup();vi.useRealTimers();vi.restoreAllMocks(); });
describe('calendar key',()=>{
  it('subscribes the public site, never the address it was opened from',()=>{
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari');
    render(<EventFacts event={event} modular/>);
    expect(key()).toHaveAttribute('href','webcal://terminal.stann.kr/calendar.ics');
  });
  it('shows the loading cover until the calendar takes the page over, or for a while at most',()=>{
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari');
    render(<EventFacts event={event} modular/>);
    press(key());
    expect(key()).toHaveAttribute('data-pending');
    act(()=>{ window.dispatchEvent(new Event('blur')); });
    expect(key()).not.toHaveAttribute('data-pending');
    press(key());
    act(()=>{ vi.advanceTimersByTime(CALENDAR_OPEN_MS); });
    expect(key()).not.toHaveAttribute('data-pending');
  });
  it('asks for Safari inside an app browser, which drops webcal: silently',()=>{
    as('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 350.0');
    render(<EventFacts event={event} modular/>);
    act(()=>{ key().click(); });
    expect(key()).not.toHaveAttribute('data-pending');
    expect(key()).toHaveTextContent('Safari에서 열어 주세요');
    expect(screen.getByRole('status')).toHaveTextContent('Safari에서 열어 주세요');
  });
});
