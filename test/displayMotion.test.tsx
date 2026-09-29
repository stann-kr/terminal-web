import { useRef } from 'react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,render,screen } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { useDisplayPolicy } from '../features/display/useDisplayPolicy';
import { DataActivity } from '../features/display/Display';

class Media extends EventTarget {
  matches=false;
  set(matches:boolean) { this.matches=matches;this.dispatchEvent(new Event('change')); }
}
const policies=new Map<string,Media>();
const disposals:(()=>void)[]=[];
beforeEach(()=>{
  vi.stubGlobal('matchMedia',(query:string)=>{
    if(!policies.has(query)) policies.set(query,new Media());
    return policies.get(query);
  });
});
afterEach(()=>{
  cleanup();disposals.splice(0).forEach(dispose=>dispose());
  policies.clear();vi.restoreAllMocks();vi.unstubAllGlobals();
});
function Screen({effects=true}:{effects?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);useDisplayPolicy(ref);
  return <div ref={ref} data-testid="display" data-effects-off={effects ? undefined : ''}><main><h2>행사 정보</h2><button>열기</button></main></div>;
}
describe('display motion policy',()=>{
  it('starts without a paused marker so server and hydrated markup match',()=>{
    render(<Screen/>);
    expect(screen.getByTestId('display')).not.toHaveAttribute('data-display-paused');
  });
  it.each(['effects','reduced','contrast','hidden','saveData'])('pauses all display motion while %s applies and resumes afterwards',async policy=>{
    const connection=Object.assign(new EventTarget(),{saveData:false});
    vi.stubGlobal('navigator',{connection});
    const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
    const {rerender}=render(<Screen/>);
    const display=screen.getByTestId('display');
    const apply=async(on:boolean)=>act(async()=>{
      if(policy==='effects') rerender(<Screen effects={!on}/>);
      if(policy==='reduced') policies.get('(prefers-reduced-motion: reduce)')!.set(on);
      if(policy==='contrast') policies.get('(forced-colors: active)')!.set(on);
      if(policy==='hidden') { visibility.mockReturnValue(on ? 'hidden' : 'visible');document.dispatchEvent(new Event('visibilitychange')); }
      if(policy==='saveData') { connection.saveData=on;connection.dispatchEvent(new Event('change')); }
    });
    await apply(true);
    expect(display).toHaveAttribute('data-display-paused');
    expect(screen.getByRole('button',{name:'열기'})).toBeEnabled();
    await apply(false);
    expect(display).not.toHaveAttribute('data-display-paused');
  });
  it('shows query activity only while a real query promise is pending',async()=>{
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});disposals.push(()=>client.clear());
    render(<QueryClientProvider client={client}><DataActivity/></QueryClientProvider>);
    expect(screen.getByRole('img',{name:'조회 대기'})).toBeInTheDocument();
    let resolve!:(value:string[])=>void;
    const result=new Promise<string[]>(done=>{resolve=done;});
    let request:Promise<string[]>;
    act(()=>{request=client.fetchQuery({queryKey:['display-test'],queryFn:()=>result});});
    expect(await screen.findByRole('img',{name:'기록을 불러오는 중'})).toBeInTheDocument();
    await act(async()=>{resolve([]);await request;});
    expect(await screen.findByRole('img',{name:'조회 대기'})).toBeInTheDocument();
  });
});
