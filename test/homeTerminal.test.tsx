import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HomeTerminal } from '../features/home/terminal/HomeTerminal';
import { runCommand } from '../features/home/terminal/commands';
import { EventCard } from '../features/events/EventCard';
import { EVENT_PAGE_SIZE, orderEventDirectory } from '../features/events/model';
import type { TerminalEvent } from '../lib/events/types';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation',() => ({useRouter:() => ({push})}));
const old: TerminalEvent = {id:'OLD',session:'지난 행사',date:'2025-01-01',time:'23:00',status:'ARCHIVED',subtitle:'',venue:'SEOUL',district:'',coords:'',capacity:'',sound:'',artists:[]};
const next: TerminalEvent = {...old,id:'TRM-03',session:'다음 행사',date:'2099-01-01',status:'UPCOMING'};
const now = new Date('2026-09-24T00:00:00Z');
afterEach(() => {cleanup();vi.restoreAllMocks();push.mockReset();});
function submit(command: string) {
  fireEvent.change(screen.getByRole('textbox',{name:'터미널 명령어'}),{target:{value:command}});
  fireEvent.submit(screen.getByRole('form',{name:'사이트 명령어'}));
}
describe('home site terminal',() => {
  it.each([['events','/events'],[' ARTISTS ','/artists'],['open trm-03','/events/TRM-03']])('navigates with %s', (command,href) => {
    render(<HomeTerminal events={[old,next]}/>);
    submit(command);
    expect(push).toHaveBeenCalledExactlyOnceWith(href);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
  it('shows help, lists actual public event IDs, and clears the output',() => {
    render(<HomeTerminal events={[old,next]}/>);
    const log=screen.getByRole('log',{name:'명령어 실행 기록'});
    expect(within(log).getByText('events')).toBeInTheDocument();
    expect(within(log).getByText('artists')).toBeInTheDocument();
    expect(within(log).getByText('archive')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'명령어 실행'})).toBeEnabled();
    submit('help');
    expect(log).toHaveTextContent('open <ID>');
    submit('ls');
    expect(log).toHaveTextContent('TRM-03');
    expect(log).toHaveTextContent('지난 행사');
    submit('clear');
    expect(log).toHaveTextContent('화면을 지웠습니다.');
    expect(log).not.toHaveTextContent('TRM-03');
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });
  it.each(['open javascript:alert(1)','events https://example.com','events; artists','unknown','open'])('rejects unsupported input %s without navigation',command => {
    render(<HomeTerminal events={[old,next]}/>);
    submit(command);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('log')).not.toBeEmptyDOMElement();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
  it('restores command history and the unfinished draft, without executing during IME composition',() => {
    render(<HomeTerminal events={[old,next]}/>);
    submit('help'); submit('ls');
    const input=screen.getByRole('textbox');
    fireEvent.change(input,{target:{value:'open TRM'}});
    fireEvent.keyDown(input,{key:'ArrowUp'}); expect(input).toHaveValue('ls');
    fireEvent.keyDown(input,{key:'ArrowUp'}); expect(input).toHaveValue('help');
    fireEvent.keyDown(input,{key:'ArrowDown'}); expect(input).toHaveValue('ls');
    fireEvent.keyDown(input,{key:'ArrowDown'}); expect(input).toHaveValue('open TRM');
    fireEvent.compositionStart(input);
    fireEvent.change(input,{target:{value:'events'}});
    fireEvent.submit(screen.getByRole('form'));
    fireEvent.keyDown(input,{key:'ArrowUp',isComposing:true});
    expect(push).not.toHaveBeenCalled(); expect(input).toHaveValue('events');
    fireEvent.compositionEnd(input);
    fireEvent.submit(screen.getByRole('form'));
    expect(push).toHaveBeenCalledWith('/events');
  });
  it('locates the first archived card on its actual directory page and focuses it on arrival',() => {
    const events=[old,...Array.from({length:5},(_,index) => ({...next,id:`NEXT-${index}`}))];
    const result=runCommand('archive',events,now);
    expect(result.href).toBe('/events?page=2&focus=OLD');
    const params=new URL(result.href!,'http://localhost').searchParams;
    const ordered=orderEventDirectory(events,now);
    const page=Number(params.get('page'));
    const visible=ordered.slice((page-1)*EVENT_PAGE_SIZE,page*EVENT_PAGE_SIZE);
    const scroll=vi.fn();
    const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView');
    Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll});
    try {
      render(<>{visible.map(event => <EventCard key={event.id} event={event} focused={params.get('focus') === event.id}/>)}</>);
      const card=screen.getByRole('link',{name:/지난 행사/});
      expect(card).toHaveFocus();
      expect(within(card).getByText('행사 기록')).toBeInTheDocument();
      expect(scroll).toHaveBeenCalledExactlyOnceWith({block:'nearest'});
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype,'scrollIntoView',descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype,'scrollIntoView');
    }
  });
  it('handles empty archives and the exact event start boundary without invented records',() => {
    expect(runCommand('archive',[next],now).href).toBeUndefined();
    expect(runCommand('ls',[],now).text).toBe('공개된 행사가 아직 없습니다.');
    const boundary={...next,id:'ENDED:01',date:'2026-09-24',time:'09:00'};
    expect(runCommand('archive',[boundary],now).href).toBe('/events?page=1&focus=ENDED%3A01');
    expect(runCommand('open ENDED:01',[boundary],now).href).toBe('/events/ENDED%3A01');
  });
});
