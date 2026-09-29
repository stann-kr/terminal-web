import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Console as HomeTerminal } from '../features/console/Console';
import { runCommand } from '../features/console/commands';
import { TERMINAL_SESSION_KEY } from '../features/console/session';
import type { Artist, TerminalEvent } from '../lib/events/types';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation',() => ({useRouter:() => ({push})}));
const artist: Artist = {id:'PUBLIC',name:'VISIBLE ARTIST',origin:'KR',dock:'1',time:'01:00',status:'ARCHIVED'};
const old: TerminalEvent = {id:'OLD',session:'지난 행사',date:'2025-01-01',time:'23:00',status:'ARCHIVED',subtitle:'',venue:'SEOUL',district:'',coords:'',capacity:'',sound:'',artists:[artist,{...artist,id:'PRIVATE',name:'PRIVATE ARTIST',status:'CLASSIFIED'}],description:{ko:'한국어 소개',en:'English description'}};
const next: TerminalEvent = {...old,id:'TRM-03',session:'다음 행사',date:'2099-01-01',status:'UPCOMING',artists:[]};
const now = new Date('2026-09-24T00:00:00Z');
afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();push.mockReset();sessionStorage.clear();});
function submit(command: string) {
  fireEvent.change(screen.getByRole('textbox',{name:'터미널 명령어'}),{target:{value:command}});
  fireEvent.submit(screen.getByRole('form',{name:'사이트 명령어'}));
}
function response() { return within(screen.getByRole('log')).getAllByText((_,element) => element?.tagName === 'PRE').at(-1)!; }

describe('home text terminal',() => {
  it.each([['events','TRM-03'],[' ARTISTS ','VISIBLE ARTIST / KR'],['open old','한국어 소개'],['archive','지난 행사']])('prints %s in place and retains earlier output', (command,expected) => {
    render(<HomeTerminal events={[old,next]}/>);
    submit('help');
    const help=response();
    submit(command);
    expect(response()).toHaveTextContent(expected);
    expect(help).toBeInTheDocument();
    expect(screen.getByRole('log')).not.toHaveTextContent('PRIVATE ARTIST');
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
  it('keeps canonical artists distinct from unreviewed same-name appearances without showing counts',() => {
    const events=[{...old,id:'TRM-01',artists:[{...artist,id:'01-A',name:'STANN LUMO'}]},{...old,id:'TRM-02',artists:[{...artist,id:'02-A',name:'STANN LUMO'}]},{...old,id:'OTHER',artists:[{...artist,name:'STANN LUMO'}]}];
    const output=runCommand('artists',events,now).text;
    expect(output.split('\n')).toEqual(['STANN LUMO / KR','STANN LUMO / KR']);
    expect(output).not.toMatch(/참여|최근|회/);
  });
  it('shows real detail and only past events, including the exact event start boundary',() => {
    const boundary={...next,id:'ENDED:01',date:'2026-09-24',time:'09:00'};
    const output=runCommand('archive',[old,next,boundary],now).text;
    expect(output).toContain('ENDED:01'); expect(output).toContain('OLD'); expect(output).not.toContain('TRM-03');
    expect(runCommand('open old',[old],now,{language:'en'}).text).toContain('English description');
    expect(runCommand('open old',[old],now).text).toContain('STAGE 1 · 01:00');
    expect(runCommand('archive',[next],now).text).toBe('아직 지난 행사 기록이 없습니다.');
    expect(runCommand('ls',[],now).text).toBe('공개된 행사가 아직 없습니다.');
  });
  it('restores scrollback, command history, and the unfinished draft after remount',() => {
    const view=render(<HomeTerminal events={[old,next]}/>);
    submit('events'); submit('artists');
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'open TRM'}});
    view.unmount();
    render(<HomeTerminal events={[old,next]}/>);
    expect(screen.getByRole('log')).toHaveTextContent('TRM-03');
    expect(screen.getByRole('log')).toHaveTextContent('VISIBLE ARTIST');
    const input=screen.getByRole('textbox'); expect(input).toHaveValue('open TRM');
    fireEvent.keyDown(input,{key:'ArrowUp'}); expect(input).toHaveValue('artists');
    fireEvent.keyDown(input,{key:'ArrowUp'}); expect(input).toHaveValue('events');
    fireEvent.keyDown(input,{key:'ArrowDown'}); expect(input).toHaveValue('artists');
    fireEvent.keyDown(input,{key:'ArrowDown'}); expect(input).toHaveValue('open TRM');
  });
  it('clears only the display and lets history recall earlier commands after remount',() => {
    const view=render(<HomeTerminal events={[old,next]}/>);
    submit('events'); submit('artists'); submit('clear');
    expect(screen.getByRole('log')).toBeEmptyDOMElement();
    view.unmount(); render(<HomeTerminal events={[old,next]}/>);
    expect(screen.getByRole('log')).toBeEmptyDOMElement();
    submit('history');
    expect(response()).toHaveTextContent('001 events');
    expect(response()).toHaveTextContent('002 artists');
    expect(response()).toHaveTextContent('003 clear');
    expect(response()).toHaveTextContent('004 history');
  });
  it('retains commands beyond the old thirty-command cutoff',() => {
    render(<HomeTerminal events={[old,next]}/>);
    for (let index=0;index<35;index++) submit('ls');
    submit('history');
    expect(response()).toHaveTextContent('001 ls');
    expect(response()).toHaveTextContent('035 ls');
    expect(response()).toHaveTextContent('036 history');
  });
  it.each(['open javascript:alert(1)','events https://example.com','events; artists','unknown','open'])('prints an error for %s without navigating',command => {
    render(<HomeTerminal events={[old,next]}/>);
    submit(command);
    expect(push).not.toHaveBeenCalled();
    expect(response()).toHaveAttribute('data-error','true');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
  it('does not execute or replace composition text while IME is active',() => {
    render(<HomeTerminal events={[old,next]}/>);
    submit('help');
    const input=screen.getByRole('textbox');
    fireEvent.compositionStart(input);
    fireEvent.change(input,{target:{value:'events'}});
    fireEvent.submit(screen.getByRole('form'));
    fireEvent.keyDown(input,{key:'ArrowUp',isComposing:true});
    expect(screen.getByRole('log')).not.toHaveTextContent('TRM-03'); expect(input).toHaveValue('events');
    fireEvent.compositionEnd(input);
    fireEvent.submit(screen.getByRole('form'));
    expect(response()).toHaveTextContent('TRM-03'); expect(push).not.toHaveBeenCalled();
  });
  it('recovers from corrupt saved data and continues in memory when storage writes fail',() => {
    sessionStorage.setItem(TERMINAL_SESSION_KEY,'{broken');
    render(<HomeTerminal events={[old,next]}/>);
    expect(within(screen.getByRole('log')).getByText('events')).toBeInTheDocument();
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new Error('storage unavailable');});
    submit('events'); submit('artists');
    expect(screen.getByRole('log')).toHaveTextContent('TRM-03');
    expect(screen.getByRole('log')).toHaveTextContent('VISIBLE ARTIST');
    expect(screen.getByText('기록 저장을 사용할 수 없어 현재 화면에서만 유지됩니다.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeEnabled();
  });
});

function visibleResponses() { return Array.from(screen.getByRole('log').querySelectorAll('pre > [aria-hidden=true]')); }
describe('terminal character printing',() => {
  it('prints whole graphemes and line breaks in command order, while saving full responses immediately',() => {
    vi.useFakeTimers();
    const unicode={...old,id:'가🙂'};
    render(<HomeTerminal events={[unicode,next]}/>);
    submit('open 가🙂'); submit('artists');
    expect(visibleResponses().map(node => node.textContent)).toEqual(['','']);
    const saved=JSON.parse(sessionStorage.getItem(TERMINAL_SESSION_KEY)!);
    expect(saved.entries[0].text).toContain('한국어 소개');
    act(() => {vi.advanceTimersByTime(6);});
    expect(visibleResponses()[0].textContent).toBe('가');
    expect(visibleResponses()[1].textContent).toBe('');
    act(() => {vi.advanceTimersByTime(6);});
    expect(visibleResponses()[0].textContent).toBe('가🙂');
    act(() => {vi.runAllTimers();});
    expect(visibleResponses()[0].textContent).toBe(runCommand('open 가🙂',[unicode,next],now).text);
    expect(visibleResponses()[0].textContent).toContain('\n');
    act(() => {vi.advanceTimersByTime(6);});
    expect(visibleResponses()[1].textContent).toBe('V');
    expect(screen.getByRole('textbox')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Escape'});
    expect(visibleResponses()[1].textContent).toBe('VISIBLE ARTIST / KR');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('finishes a long multiline reply within 1.25 seconds without truncating saved or visible content',() => {
    vi.useFakeTimers();
    const longEvent={...old,description:{ko:Array.from({length:120},(_,i) => `${i}번째 기록 — 한글🙂`).join('\n'),en:''}};
    render(<HomeTerminal events={[longEvent]}/>);
    submit(`open ${longEvent.id}`);
    const expected=runCommand(`open ${longEvent.id}`,[longEvent],now).text;
    expect(expected.length).toBeGreaterThan(1500);
    expect(visibleResponses()[0].textContent).toBe('');
    act(() => {vi.advanceTimersByTime(1250);});
    expect(visibleResponses()[0].textContent).toBe(expected);
    expect(visibleResponses()[0]).toHaveAttribute('data-printing','false');
    expect(JSON.parse(sessionStorage.getItem(TERMINAL_SESSION_KEY)!).entries[0].text).toBe(expected);
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels printing on clear/unmount and restores complete scrollback without replay',() => {
    vi.useFakeTimers();
    const view=render(<HomeTerminal events={[old,next]}/>);
    submit('events');
    act(() => {vi.advanceTimersByTime(6);});
    submit('clear');
    act(() => {vi.runAllTimers();});
    expect(screen.getByRole('log')).toBeEmptyDOMElement();
    submit('artists');
    view.unmount();
    act(() => {vi.runAllTimers();});
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    render(<HomeTerminal events={[old,next]}/>);
    expect(visibleResponses()[0].textContent).toBe('VISIBLE ARTIST / KR');
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['effects','reduced','contrast','hidden','saveData'])('settles pending output when %s disables motion and never replays it',async policy => {
    vi.useFakeTimers();
    class Media extends EventTarget { matches=false; }
    const reduced=new Media(),contrast=new Media();
    vi.stubGlobal('matchMedia',(query:string) => query.includes('reduced-motion') ? reduced : contrast);
    const connection=Object.assign(new EventTarget(),{saveData:false});
    vi.stubGlobal('navigator',{connection});
    render(<div data-testid="frame"><HomeTerminal events={[old,next]}/></div>);
    submit('events'); submit('artists');
    act(() => {vi.advanceTimersByTime(6);});
    expect(visibleResponses()[0].textContent).toBe('T');
    await act(async () => {
      if(policy === 'effects') screen.getByTestId('frame').setAttribute('data-effects-off','');
      if(policy === 'reduced' || policy === 'contrast') { const media=policy === 'reduced' ? reduced : contrast; media.matches=true;media.dispatchEvent(new Event('change')); }
      if(policy === 'hidden') { vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); }
      if(policy === 'saveData') { connection.saveData=true;connection.dispatchEvent(new Event('change')); }
    });
    expect(visibleResponses()[0].textContent).toBe(runCommand('events',[old,next]).text);
    expect(visibleResponses()[1].textContent).toBe('VISIBLE ARTIST / KR');
    expect(vi.getTimerCount()).toBe(0);
    screen.getByTestId('frame').removeAttribute('data-effects-off');
    submit('artists');
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Escape'});
    expect(visibleResponses()[0].textContent).toBe(runCommand('events',[old,next]).text);
  });
});
