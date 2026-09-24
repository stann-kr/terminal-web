import { afterEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { TerminalEvent } from '../lib/events/types';
import { Events,EventDetail } from '../features/events/Events';
import { Artists,ArtistDetail } from '../features/artists/Artists';
import { Shell } from '../features/shell/Shell';
import { Home } from '../features/home/Home';
import { EventCountdown } from '../features/home/EventCountdown';
import { EventsData } from '../features/events/data';
const navigation=vi.hoisted(()=>({search:new URLSearchParams()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>navigation.search,usePathname:()=>'/',useRouter:()=>({push:vi.fn()})}));
const event:TerminalEvent={id:'OLD',session:'Past event',subtitle:'A past night',date:'2025-03-07',time:'23:00',venue:'FAUST',district:'SEOUL',coords:'',capacity:'',sound:'',status:'ARCHIVED',artists:[{id:'PUBLIC',name:'VISIBLE ARTIST',origin:'KR',dock:'1',time:'TBA',status:'ARCHIVED'},{id:'PRIVATE',name:'PRIVATE NAME',origin:'KR',dock:'1',time:'TBA',status:'CLASSIFIED'}]};
const clients:QueryClient[]=[];
function view(node:React.ReactNode,events:TerminalEvent[]=[event]) { const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});clients.push(client);client.setQueryData(['events'],events);client.setQueryData(['transmit',1],{logs:[],total:0,page:1,totalPages:0});return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>); }
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());navigation.search=new URLSearchParams();vi.unstubAllGlobals();vi.useRealTimers();vi.restoreAllMocks();});
describe('rebuild public views',()=>{
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
  it('removes the archive menu and lets users turn off effects without replacing the page',()=>{
    view(<Shell><input aria-label="초안" defaultValue="keep this"/></Shell>);
    const menu=screen.getByRole('navigation',{name:'주 메뉴'});
    expect(within(menu).getAllByRole('link')).toHaveLength(4);
    expect(within(menu).queryByRole('link',{name:/ARCHIVE/})).not.toBeInTheDocument();
    const draft=screen.getByRole('textbox',{name:'초안'});
    const toggle=screen.getByRole('button',{name:'화면 효과'});
    expect(toggle).toHaveAttribute('aria-pressed','true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed','false');
    expect(draft).toHaveValue('keep this');
    expect(screen.getByRole('textbox',{name:'초안'})).toBe(draft);
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
