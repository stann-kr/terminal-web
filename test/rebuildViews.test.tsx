import { afterEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { TerminalEvent } from '../lib/events/types';
import { Events,EventDetail } from '../features/events/Events';
import { Artists,ArtistDetail } from '../features/artists/Artists';
import { Shell } from '../features/shell/Shell';
import { Transmit } from '../features/transmit/Transmit';
import { Home } from '../features/home/Home';
import { EventCountdown } from '../features/home/EventCountdown';
import { EventsData } from '../features/events/data';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
const navigation=vi.hoisted(()=>({search:new URLSearchParams(),pathname:'/'}));
const router=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>navigation.search,usePathname:()=>navigation.pathname,useRouter:()=>router}));
const event:TerminalEvent={id:'OLD',session:'Past event',subtitle:'A past night',date:'2025-03-07',time:'23:00',venue:'FAUST',district:'SEOUL',coords:'',capacity:'',sound:'',status:'ARCHIVED',artists:[{id:'PUBLIC',name:'VISIBLE ARTIST',origin:'KR',dock:'1',time:'TBA',status:'ARCHIVED'},{id:'PRIVATE',name:'PRIVATE NAME',origin:'KR',dock:'1',time:'TBA',status:'CLASSIFIED'}]};
const clients:QueryClient[]=[];
function view(node:React.ReactNode,events:TerminalEvent[]=[event]) { const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});clients.push(client);client.setQueryData(['events'],events);client.setQueryData(['transmit',1],{logs:[],total:0,page:1,totalPages:0});return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>); }
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());navigation.search=new URLSearchParams();navigation.pathname='/';router.push.mockReset();sessionStorage.clear();vi.unstubAllGlobals();vi.useRealTimers();vi.restoreAllMocks();});
describe('rebuild public views',()=>{
  it('continues keyboard navigation in main after a route change without stealing focus on ordinary renders',()=>{
    const {rerender}=view(<Shell><input aria-label="초안"/></Shell>);
    const field=screen.getByRole('textbox',{name:'초안'});
    field.focus();
    rerender(<QueryClientProvider client={clients[0]}><Shell><input aria-label="초안"/></Shell></QueryClientProvider>);
    expect(field).toHaveFocus();
    navigation.pathname='/artists';
    rerender(<QueryClientProvider client={clients[0]}><Shell><p>STANN LUMO</p></Shell></QueryClientProvider>);
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('link',{name:/ARTISTS/})).toHaveAttribute('aria-current','page');
  });
  it('groups the public running order by stage without adding private artist cells',()=>{
    view(<EventDetail eventId="OLD"/>,[{...event,artists:[...event.artists,{...event.artists[0],id:'SECOND',dock:'2',name:'SECOND ARTIST',time:'02:00–03:00'}]}]);
    expect(within(screen.getByRole('region',{name:'무대 1'})).getByRole('link',{name:/VISIBLE ARTIST/})).toBeInTheDocument();
    expect(within(screen.getByRole('region',{name:'무대 2'})).getByRole('link',{name:/SECOND ARTIST/})).toBeInTheDocument();
    expect(within(screen.getByRole('region',{name:'무대 2'})).getByText('02:00–03:00')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();
  });
  it('links repeated confirmed appearances to one canonical artist profile',()=>{
    const publicArtist=event.artists[0];
    view(<Artists/>,[
      {...event,id:'TRM-01',artists:[{...publicArtist,id:'01-A',name:'STANN LUMO'}]},
      {...event,id:'TRM-02',artists:[{...publicArtist,id:'02-A',name:'STANN LUMO'}]},
    ]);
    expect(screen.getAllByRole('heading',{name:'STANN LUMO'})).toHaveLength(1);
    expect(screen.getByRole('link',{name:/STANN LUMO/})).toHaveAttribute('href','/artists/stann-lumo');
    expect(screen.queryByText('참여 행사')).not.toBeInTheDocument();
    expect(screen.queryByText('최근 출연')).not.toBeInTheDocument();
    expect(screen.queryByText('2회')).not.toBeInTheDocument();
  });
  it('keeps the artist biography and source events without attendance or recency summaries',()=>{
    view(<ArtistDetail artistKey="appearance:OLD:PUBLIC"/>,[{...event,artists:[{...event.artists[0],description:'Artist biography'}]}]);
    expect(screen.getByRole('heading',{name:'VISIBLE ARTIST',level:1})).toBeInTheDocument();
    expect(screen.getByRole('heading',{name:/출연 기록/})).toBeInTheDocument();
    expect(screen.getAllByRole('link',{name:/Past event/})[0]).toHaveAttribute('href','/events/OLD');
    expect(screen.queryByText('참여 행사')).not.toBeInTheDocument();
    expect(screen.queryByText('최근 출연')).not.toBeInTheDocument();
    expect(screen.queryByText('APPEARANCES')).not.toBeInTheDocument();
    expect(screen.getAllByText('Artist biography').length).toBeGreaterThan(0);
  });
  it('highlights only the canonical STANN LUMO without changing appearance status or link names',()=>{
    const publicArtist={...event.artists[0],name:'STANN LUMO'};
    view(<Artists/>,[
      {...event,id:'TRM-01',artists:[{...publicArtist,id:'01-A'}]},
      {...event,artists:[publicArtist]},
    ]);
    const cards=screen.getAllByRole('link',{name:/^ARTIST \/ KR\s*출연 기록 STANN LUMO$/});
    expect(cards).toHaveLength(2);
    const canonical=cards.find(card=>card.getAttribute('href')==='/artists/stann-lumo')!;
    expect(canonical).toHaveAttribute('data-featured','true');
    expect(canonical).toHaveAttribute('data-upcoming','false');
    expect(cards.find(card=>card!==canonical)).not.toHaveAttribute('data-featured');
  });
  it('keeps past events accessible in the unified list when no event is upcoming',()=>{
    view(<Events/>);
    expect(screen.getByRole('link',{name:/Past event/})).toHaveAttribute('href','/events/OLD');
    expect(screen.getByText('지난 행사').nextElementSibling).toHaveTextContent('1');
    expect(screen.queryByRole('link',{name:/게스트 신청/})).not.toBeInTheDocument();
  });
  it('hides private names in real archive lineups and closes expired requests',()=>{view(<EventDetail eventId="OLD"/>);expect(screen.getByRole('heading',{name:'Past event',level:1})).toBeInTheDocument();expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:/VISIBLE ARTIST/})).toHaveAttribute('href','/artists/appearance%3AOLD%3APUBLIC');expect(screen.queryByRole('link',{name:/게스트 신청/})).not.toBeInTheDocument();});
  it('shows all public artists without search or filters, including from old filtered URLs',()=>{
    navigation.search=new URLSearchParams('q=PRIVATE&origin=US&sort=count');
    view(<Artists/>);
    expect(screen.getByRole('heading',{name:'VISIBLE ARTIST'})).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('shows upcoming and past records together without reviving removed filters',()=>{
    navigation.search=new URLSearchParams('q=absent&year=2024&venue=OTHER');
    view(<Events/>,[event,{...event,id:'FUTURE',session:'Future event',date:'2099-01-01',status:'UPCOMING'}]);
    expect(screen.getByRole('heading',{name:'Past event'})).toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Future event'})).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();
    expect(screen.getByText('이벤트 현황')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('지난 행사').nextElementSibling).toHaveTextContent('1');
  });
  it.each([
    {path:'/artists',Component:Artists,pageSize:12,lastName:'ARTIST 12'},
    {path:'/events',Component:Events,pageSize:4,lastName:'EVENT 04'},
  ])('preserves $path pagination and drops removed filters from page links',({path,Component,pageSize,lastName})=>{
    navigation.search=new URLSearchParams('page=2&q=absent&origin=US&sort=count&year=1900&venue=OTHER');
    const events=Array.from({length:pageSize+1},(_,index)=>{
      const number=String(index).padStart(2,'0');
      return {...event,id:`EVENT ${number}`,session:`EVENT ${number}`,artists:[{...event.artists[0],name:`ARTIST ${number}`}]};
    });
    view(<Component/>,events);
    expect(screen.getByRole('heading',{name:lastName})).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'← 이전'})).toHaveAttribute('href',`${path}?page=1`);
    expect(screen.getAllByRole('heading',{level:2,name:/^(ARTIST|EVENT) /})).toHaveLength(1);
  });
  it('orders live, upcoming by start time, then past events and updates an expired card at its boundary',()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T22:59:59+09:00'));
    view(<Events/>,[
      event,
      {...event,id:'LATER',session:'Later event',date:'2026-11-28',time:'23:30',status:'UPCOMING'},
      {...event,id:'NEXT',session:'Next event',date:'2026-11-28',time:'23:00',status:'UPCOMING'},
      {...event,id:'LIVE',session:'Live event',date:'2026-11-28',time:'22:00',status:'LIVE'},
    ]);
    expect(screen.getAllByRole('heading',{level:2}).slice(0,4).map(node=>node.textContent)).toEqual(['Live event','Next event','Later event','Past event']);
    const card=screen.getByRole('heading',{name:'Next event'}).closest('a')!;
    expect(within(card).getByText('예정')).toBeInTheDocument();
    expect(card).toHaveAttribute('data-event-state','UPCOMING');
    act(()=>vi.advanceTimersByTime(1000));
    expect(within(card).getByText('행사 기록')).toBeInTheDocument();
    expect(card).toHaveAttribute('data-event-state','ARCHIVED');
    expect(screen.getAllByRole('heading',{level:2}).slice(0,4).map(node=>node.textContent)).toEqual(['Live event','Later event','Next event','Past event']);
    expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();
  });
  it('keeps four main menu links without the archive menu or a screen-effect toggle',()=>{
    view(<Shell><input aria-label="초안" defaultValue="keep this"/></Shell>);
    const menu=screen.getByRole('navigation',{name:'주 메뉴'});
    expect(within(menu).getAllByRole('link')).toHaveLength(4);
    expect(within(menu).queryByRole('link',{name:/ARCHIVE/})).not.toBeInTheDocument();
    // Motion follows the OS reduced-motion, contrast and save-data settings instead of an FX switch.
    expect(screen.queryByRole('button',{name:'화면 효과'})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox',{name:'초안'})).toHaveValue('keep this');
  });
  it('keeps the Home clock after an event starts, then counts down to the newly registered next event',()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T22:59:59+09:00'));
    const upcoming={...event,id:'TRM-03',session:'TERMINAL [03]',date:'2026-11-28',time:'23:00 KST',status:'UPCOMING' as const};
    view(<Home/>,[event,upcoming]);
    expect(screen.queryByText('PUBLIC ARTISTS / 공개 명부')).not.toBeInTheDocument();
    expect(screen.getByRole('timer',{name:'이벤트 시작까지 남은 시간'})).toHaveTextContent('T- COUNTDOWN');
    act(()=>vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer',{name:'이벤트 시작 후 경과 시간'})).toHaveTextContent('T+ ELAPSED');
    act(()=>vi.advanceTimersByTime(2000));
    expect(within(screen.getByRole('timer')).getByText('초').nextElementSibling).toHaveTextContent('02');
    const next={...upcoming,id:'TRM-04',session:'TERMINAL [04]',date:'2026-12-28'};
    act(()=>{clients[0].setQueryData(['events'],[event,{...upcoming,status:'LIVE'},next]);vi.advanceTimersByTime(1);});
    expect(within(screen.getByRole('region',{name:'대표 행사'})).getByRole('heading',{name:'TERMINAL [04]'})).toBeInTheDocument();
    expect(screen.getByRole('timer',{name:'이벤트 시작까지 남은 시간'})).toHaveTextContent('T- COUNTDOWN');
  });
  it('resynchronizes the KST timer after a hidden tab and omits invalid start times',()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T13:59:59.500Z'));
    const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
    const {rerender}=render(<EventCountdown event={{date:'2026-11-28',time:'23:00 KST'}}/>);
    expect(within(screen.getByRole('timer')).getByText('초').nextElementSibling).toHaveTextContent('01');
    visibility.mockReturnValue('hidden');
    act(()=>document.dispatchEvent(new Event('visibilitychange')));
    act(()=>vi.advanceTimersByTime(6500));
    expect(screen.getByRole('timer')).toHaveTextContent('T- COUNTDOWN');
    visibility.mockReturnValue('visible');
    act(()=>document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByRole('timer',{name:'이벤트 시작 후 경과 시간'})).toHaveTextContent('T+ ELAPSED');
    expect(within(screen.getByRole('timer')).getByText('초').nextElementSibling).toHaveTextContent('06');
    rerender(<EventCountdown event={{date:'2026-11-28',time:'TBA'}}/>);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
  it('keeps home useful when the API has no events',()=>{view(<Home/>,[]);expect(screen.getByText('공개된 행사가 아직 없습니다')).toBeInTheDocument();expect(screen.getByRole('link',{name:/소식 신청/})).toHaveAttribute('href','/signal');});
  it('does not present a failed event query as zero records',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:500})));const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<QueryClientProvider client={client}><EventsData>{()=> <p>DATA ZERO</p>}</EventsData></QueryClientProvider>);expect(await screen.findByRole('alert')).toHaveTextContent('행사 기록을 불러오지 못했습니다');expect(screen.queryByText('DATA ZERO')).not.toBeInTheDocument();});
});

describe('public log activity',() => {
  it('tracks initial load, refresh, failure and retry without discarding the last public logs',async () => {
    let resolve!:(value:Response)=>void;
    vi.stubGlobal('fetch',vi.fn(() => new Promise<Response>(done => {resolve=done;})));
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);
    const {container}=render(<QueryClientProvider client={client}><Transmit/></QueryClientProvider>);
    const indicator=() => container.querySelector('[aria-hidden=true][data-state]')!;
    const result={logs:[{id:'1',handle:'PUBLIC',message:'보존할 로그',ts:'2026.09.24',createdAt:'2026-09-24T00:00:00Z'}],page:1,total:1,totalPages:1};
    expect(indicator()).toHaveAttribute('data-state','loading');
    await act(async () => {resolve(new Response(JSON.stringify(result)));});
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state','ready'));
    act(() => {void client.invalidateQueries({queryKey:['transmit']});});
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state','loading'));
    expect(screen.getByText('보존할 로그')).toBeInTheDocument();
    await act(async () => {resolve(new Response(JSON.stringify({error:'UNAVAILABLE'}),{status:503}));});
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state','error'));
    expect(screen.getByText('보존할 로그')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'다시 불러오기'}));
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state','loading'));
    await act(async () => {resolve(new Response(JSON.stringify(result)));});
    await waitFor(() => expect(indicator()).toHaveAttribute('data-state','ready'));
  });
});

describe('CRT shell controls and console dock',()=>{
  function shell(node:React.ReactNode=<input aria-label="초안"/>) {
    const result=view(<Shell>{node}</Shell>);
    const again=(child:React.ReactNode=node)=>result.rerender(<QueryClientProvider client={clients[0]}><Shell>{child}</Shell></QueryClientProvider>);
    return {...result,again};
  }
  const command=()=>screen.getByRole('textbox',{name:'터미널 명령어'});
  it('moves between the four main keys with plain F1–F4 only and leaves browser keys alone',()=>{
    navigation.pathname='/events';
    shell();
    expect(screen.getByRole('link',{name:/EVENTS/})).toHaveAttribute('aria-keyshortcuts','F2');
    expect(fireEvent.keyDown(document,{key:'F3'})).toBe(false);
    expect(router.push).toHaveBeenLastCalledWith('/artists');
    const draft=screen.getByRole('textbox',{name:'초안'});draft.focus();
    fireEvent.keyDown(draft,{key:'F2'});
    expect(draft).toHaveFocus();
    fireEvent.keyDown(document,{key:'F1',ctrlKey:true});
    fireEvent.keyDown(document,{key:'F4',isComposing:true});
    expect(fireEvent.keyDown(document,{key:'F5'})).toBe(true);
    expect(router.push).toHaveBeenCalledOnce();
  });
  it('sends / to the command line only when the user is not typing',()=>{
    shell();
    const draft=screen.getByRole('textbox',{name:'초안'});
    draft.focus();
    expect(fireEvent.keyDown(draft,{key:'/'})).toBe(true);
    expect(draft).toHaveFocus();
    screen.getByRole('link',{name:/ARTISTS/}).focus();
    expect(fireEvent.keyDown(document.activeElement!,{key:'/'})).toBe(false);
    expect(command()).toHaveFocus();
  });
  it('opens the log at home, folds elsewhere and keeps the session, draft and focus across route changes',()=>{
    const {again}=shell();
    expect(screen.getByRole('log')).toBeVisible();
    expect(within(screen.getByRole('log')).getByText('COMMAND DIRECTORY')).toBeInTheDocument();
    fireEvent.change(command(),{target:{value:'ls'}});
    fireEvent.submit(screen.getByRole('form',{name:'사이트 명령어'}));
    fireEvent.change(command(),{target:{value:'cd art'}});
    navigation.pathname='/events';again();
    const toggle=screen.getByRole('button',{name:'출력'});
    expect(toggle).toHaveAttribute('aria-expanded','false');
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(command()).toHaveValue('cd art');
    fireEvent.click(toggle);
    expect(screen.getByRole('log')).toHaveTextContent('OLD Past event');
    command().focus();
    // The first Esc only completes the running print; the second folds the log.
    fireEvent.keyDown(command(),{key:'Escape'});
    expect(toggle).toHaveAttribute('aria-expanded','true');
    fireEvent.keyDown(command(),{key:'Escape',isComposing:true});
    expect(toggle).toHaveAttribute('aria-expanded','true');
    fireEvent.keyDown(command(),{key:'Escape'});
    expect(toggle).toHaveAttribute('aria-expanded','false');
    expect(command()).toHaveFocus();
    fireEvent.change(command(),{target:{value:'cd artists'}});
    fireEvent.submit(screen.getByRole('form',{name:'사이트 명령어'}));
    expect(router.push).toHaveBeenCalledWith('/artists');
    navigation.pathname='/artists';again();
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('button',{name:'출력'})).toHaveAttribute('aria-expanded','true');
    expect(screen.getByRole('log')).toHaveTextContent('→ ~/artists');
    expect(screen.getByRole('log')).toHaveTextContent('OLD Past event');
    fireEvent.click(screen.getByRole('button',{name:'출력'}));
    navigation.pathname='/';again();
    expect(screen.getByRole('button',{name:'출력'})).toHaveAttribute('aria-expanded','true');
  });
  it('keeps layout children mounted across a route change',()=>{
    const {again}=shell(<input aria-label="초안" defaultValue="keep this"/>);
    const draft=screen.getByRole('textbox',{name:'초안'});
    fireEvent.change(draft,{target:{value:'typed'}});
    navigation.pathname='/events';again();
    expect(screen.getByRole('textbox',{name:'초안'})).toBe(draft);
    expect(draft).toHaveValue('typed');
    expect(screen.getByRole('main')).toHaveAttribute('data-wipe');
  });
  // JSDOM evidence only: server markup is rendered with `window` hidden so the real server branch runs,
  // then the emitted pre-paint script text is executed against the parsed markup before hydration.
  async function serverMarkup(session:{saveData?:boolean}={}) {
    const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});clients.push(client);
    client.setQueryData(['events'],[event]);client.setQueryData(['transmit',1],{logs:[],total:0,page:1,totalPages:0});
    const tree=<QueryClientProvider client={client}><Shell><Home/></Shell></QueryClientProvider>;
    vi.stubGlobal('window',undefined);
    const html=renderToString(tree);
    vi.unstubAllGlobals();
    const container=document.createElement('div');
    container.innerHTML=html;
    const script=container.querySelector<HTMLScriptElement>('script[type="text/javascript"]')!;
    new Function('document','navigator','sessionStorage',script.textContent!)({currentScript:script},{connection:{saveData:!!session.saveData}},sessionStorage);
    return {tree,container,boot:script.previousElementSibling!};
  }
  it.each([
    ['first visit',false,{},true],
    ['returning session',true,{},false],
    ['save-data',false,{saveData:true},false],
  ] as const)('marks the power-on only on a %s and never ships effect markers in server HTML',async(_,seen,session,plays)=>{
    if(seen) sessionStorage.setItem('terminal.boot.v1','1');
    const {container,boot}=await serverMarkup(session);
    expect(boot.hasAttribute('data-play')).toBe(plays);
    expect(sessionStorage.getItem('terminal.boot.v1')).toBe('1');
    expect(container.querySelector('[data-display-paused],[data-wipe]')).toBeNull();
    expect(container.innerHTML).not.toContain('clip-path');
  });
  it('hydrates server HTML after the pre-paint script ran, then clears the boot marker',async()=>{
    sessionStorage.setItem('terminal.home.session.v1',JSON.stringify({version:1,entries:[{command:'ls',text:'OLD  Past event'}],history:['ls']}));
    const {tree,container,boot}=await serverMarkup();
    expect(boot).toHaveAttribute('data-play');
    document.body.appendChild(container);
    const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
    const warnings=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const recoverable=vi.fn();
    let root!:ReturnType<typeof hydrateRoot>;
    await act(async()=>{root=hydrateRoot(container,tree,{onRecoverableError:recoverable});});
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    expect(within(container).getByRole('log')).toHaveTextContent('OLD Past event');
    await waitFor(()=>expect(boot).not.toHaveAttribute('data-play'),{timeout:1500});
    act(()=>root.unmount());container.remove();
  });
});
