import { afterEach,describe,expect,it,vi } from 'vitest';
import { cleanup,render,screen,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { TerminalEvent } from '../lib/events/types';
import { Events,EventDetail } from '../features/events/Events';
import { Artists } from '../features/artists/Artists';
import { Archive } from '../features/events/Archive';
import { Home } from '../features/home/Home';
import { EventsData } from '../features/events/data';
const navigation=vi.hoisted(()=>({search:new URLSearchParams()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>navigation.search,usePathname:()=>'/'}));
const event:TerminalEvent={id:'OLD',session:'Past event',subtitle:'A past night',date:'2025-03-07',time:'23:00',venue:'FAUST',district:'SEOUL',coords:'',capacity:'',sound:'',status:'ARCHIVED',artists:[{id:'PUBLIC',name:'VISIBLE ARTIST',origin:'KR',dock:'1',time:'TBA',status:'ARCHIVED'},{id:'PRIVATE',name:'PRIVATE NAME',origin:'KR',dock:'1',time:'TBA',status:'CLASSIFIED'}]};
const clients:QueryClient[]=[];
function view(node:React.ReactNode,events:TerminalEvent[]=[event]) { const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});clients.push(client);client.setQueryData(['events'],events);client.setQueryData(['transmit',1],{logs:[],total:0,page:1,totalPages:0});return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>); }
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());navigation.search=new URLSearchParams();vi.unstubAllGlobals();});
describe('rebuild public views',()=>{
  it('groups the public running order by stage without adding private artist cells',()=>{
    view(<EventDetail eventId="OLD"/>,[{...event,artists:[...event.artists,{...event.artists[0],id:'SECOND',dock:'2',name:'SECOND ARTIST',time:'02:00–03:00'}]}]);
    expect(within(screen.getByRole('region',{name:'무대 1'})).getByRole('link',{name:/VISIBLE ARTIST/})).toBeInTheDocument();
    expect(within(screen.getByRole('region',{name:'무대 2'})).getByRole('link',{name:/SECOND ARTIST/})).toBeInTheDocument();
    expect(within(screen.getByRole('region',{name:'무대 2'})).getByText('02:00–03:00')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();
    expect(screen.getByText('추가 공개 예정 1팀')).toBeInTheDocument();
  });
  it('links repeated confirmed appearances to one canonical artist profile',()=>{
    const publicArtist=event.artists[0];
    view(<Artists/>,[
      {...event,id:'TRM-01',artists:[{...publicArtist,id:'01-A',name:'STANN LUMO'}]},
      {...event,id:'TRM-02',artists:[{...publicArtist,id:'02-A',name:'STANN LUMO'}]},
    ]);
    expect(screen.getAllByRole('heading',{name:'STANN LUMO'})).toHaveLength(1);
    expect(screen.getByRole('link',{name:/STANN LUMO/})).toHaveAttribute('href','/artists/stann-lumo');
    expect(screen.getByText('2회')).toBeInTheDocument();
  });
  it('treats archived-only data as no upcoming event with a path to records',()=>{view(<Events/>);expect(screen.getByText('다음 행사 미정')).toBeInTheDocument();expect(screen.getByRole('link',{name:/지난 행사 기록/})).toHaveAttribute('href','/archive');expect(screen.queryByRole('link',{name:/게스트 신청/})).not.toBeInTheDocument();});
  it('hides private names in real archive lineups and closes expired requests',()=>{view(<EventDetail eventId="OLD"/>);expect(screen.getByRole('heading',{name:'Past event'})).toBeInTheDocument();expect(screen.getByText('추가 공개 예정 1팀')).toBeInTheDocument();expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:/VISIBLE ARTIST/})).toHaveAttribute('href','/artists/appearance%3AOLD%3APUBLIC');expect(screen.queryByRole('link',{name:/게스트 신청/})).not.toBeInTheDocument();});
  it('restores artist search from URL without putting private slots in results',()=>{navigation.search=new URLSearchParams('q=PRIVATE');view(<Artists/>);expect(screen.getByLabelText('이름 검색')).toHaveValue('PRIVATE');expect(screen.getByText('조건에 맞는 아티스트가 없습니다')).toBeInTheDocument();expect(screen.queryByText('PRIVATE NAME')).not.toBeInTheDocument();});
  it('uses URL archive filters and computes zero without calling it missing data',()=>{navigation.search=new URLSearchParams('year=2024&venue=FAUST');view(<Archive/>);expect(screen.getByText('조건에 맞는 기록이 없습니다')).toBeInTheDocument();expect(screen.getAllByText('0').length).toBeGreaterThan(0);expect(screen.getByLabelText('연도')).toHaveValue('2024');});
  it('keeps home useful when the API has no events',()=>{view(<Home/>,[]);expect(screen.getByText('공개된 행사가 아직 없습니다')).toBeInTheDocument();expect(screen.getByRole('link',{name:/소식 신청/})).toHaveAttribute('href','/signal');});
  it('does not present a failed event query as zero records',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:500})));const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);render(<QueryClientProvider client={client}><EventsData>{()=> <p>DATA ZERO</p>}</EventsData></QueryClientProvider>);expect(await screen.findByRole('alert')).toHaveTextContent('행사 기록을 불러오지 못했습니다');expect(screen.queryByText('DATA ZERO')).not.toBeInTheDocument();});
});
