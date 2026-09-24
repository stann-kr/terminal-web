import { useRef } from 'react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { createReadout } from '../features/display/readout';
import { useDisplayMotion } from '../features/display/useDisplayMotion';
import { DataActivity,LiveValue } from '../features/display/Display';

class Media extends EventTarget {
  matches=false;
  set(matches:boolean) { this.matches=matches;this.dispatchEvent(new Event('change')); }
}
const policies=new Map<string,Media>();
const originalRange=Object.getOwnPropertyDescriptor(Range.prototype,'getClientRects');
const disposals:(()=>void)[]=[];
beforeEach(()=>{
  vi.stubGlobal('matchMedia',(query:string)=>{
    if(!policies.has(query)) policies.set(query,new Media());
    return policies.get(query);
  });
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    return new DOMRect(10,10,400,this.matches('main')?600:40);
  });
  Object.defineProperty(Range.prototype,'getClientRects',{configurable:true,value:()=>[new DOMRect(10,10,400,20)]});
});
afterEach(()=>{
  cleanup();disposals.splice(0).forEach(dispose=>dispose());
  document.body.replaceChildren();policies.clear();
  vi.restoreAllMocks();vi.unstubAllGlobals();gsap.ticker.sleep();
  if(originalRange) Object.defineProperty(Range.prototype,'getClientRects',originalRange);
  else Reflect.deleteProperty(Range.prototype,'getClientRects');
});
function fixture() {
  const root=document.createElement('div');
  root.innerHTML='<main><section data-readout-panel style="opacity:0.8"><h2 data-readout-row>행사 정보</h2><p data-readout-row>2026-11-28</p><a href="/events/TRM-03">상세</a></section><form><label data-readout-row for="draft">초안</label><input id="draft" value="작성 중"/></form><p data-readout-row role="alert">입력을 확인해 주세요.</p><span data-readout-row data-readout-live>59</span></main>';
  document.body.appendChild(root);
  return root;
}
describe('display safety and lifecycle',()=>{
  it('preserves semantic nodes, links, alerts and drafts, and restores original styles on interruption',()=>{
    const root=fixture();const heading=root.querySelector('h2')!;
    const input=root.querySelector('input')!;const text=root.textContent;
    const motion=createReadout(root);disposals.push(motion.dispose);
    motion.reveal();
    expect(root.querySelector('h2')).toBe(heading);
    expect(root.textContent).toBe(text);
    expect(input.value).toBe('작성 중');
    expect(root.querySelector('a')).toHaveAttribute('href','/events/TRM-03');
    for(const node of root.querySelectorAll<HTMLElement>('label,input,a,[role=alert],[data-readout-live]')) expect(node.style.clipPath).toBe('');
    expect(heading.style.clipPath).not.toBe('');
    motion.finish();
    expect(heading.style.clipPath).toBe('');
    expect(root.querySelector<HTMLElement>('section')!.style.opacity).toBe('0.8');
    expect(root.textContent).toBe(text);
  });
  it('reads new content once and cannot conceal new content after disposal',()=>{
    const root=fixture();const motion=createReadout(root);disposals.push(motion.dispose);
    motion.reveal();motion.finish();
    const row=document.createElement('p');row.dataset.readoutRow='';row.textContent='새 기록';root.querySelector('section')!.appendChild(row);
    motion.reveal();
    expect(root.querySelector<HTMLElement>('h2')!.style.clipPath).toBe('');
    expect(row.style.clipPath).not.toBe('');
    motion.finish();motion.reveal();expect(row.style.clipPath).toBe('');
    motion.dispose();const after=row.cloneNode(true) as HTMLElement;root.querySelector('section')!.appendChild(after);
    motion.reveal();expect(after.style.clipPath).toBe('');
  });
  it('keeps content static when disabled, focused on an input, or without layout geometry',()=>{
    const root=fixture();let enabled=false;
    const motion=createReadout(root,()=>enabled);disposals.push(motion.dispose);
    motion.reveal();expect(root.querySelector<HTMLElement>('h2')!.style.clipPath).toBe('');
    enabled=true;motion.reveal();expect(root.querySelector<HTMLElement>('h2')!.style.clipPath).toBe('');
    root.querySelector('input')!.focus();
    const focused=createReadout(root);disposals.push(focused.dispose);focused.reveal();
    expect(root.querySelector<HTMLElement>('h2')!.style.clipPath).toBe('');
    root.querySelector('input')!.blur();
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue(new DOMRect());
    const noLayout=createReadout(root);disposals.push(noLayout.dispose);noLayout.reveal();
    expect(root.querySelector<HTMLElement>('h2')!.style.clipPath).toBe('');
  });
});

function Screen({page='home',value=59,extra=false}:{page?:string;value?:number;extra?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);useDisplayMotion(ref,page);
  return <div ref={ref} data-testid="display"><main><section data-readout-panel=""><h2 data-readout-row="">{page}</h2><button>열기</button><LiveValue value={value}/>{extra&&<p data-readout-row="">새 로그</p>}</section></main></div>;
}
describe('display integration',()=>{
  it('keeps the screen available if decorative measurement fails',()=>{
    Object.defineProperty(Range.prototype,'getClientRects',{configurable:true,value:()=>{throw new Error('layout unavailable');}});
    render(<Screen/>);
    expect(screen.getByRole('heading')).toHaveTextContent('home');
    expect(screen.getByRole('heading').style.clipPath).toBe('');
    expect(screen.getByRole('button',{name:'열기'})).toBeEnabled();
  });
  it('finishes before interaction and never restarts a panel for a live number tick',()=>{
    const {rerender,unmount}=render(<Screen/>);
    const heading=screen.getByRole('heading');
    expect(heading.style.clipPath).not.toBe('');
    fireEvent.keyDown(screen.getByTestId('display'),{key:'Tab'});
    expect(heading.style.clipPath).toBe('');
    rerender(<Screen value={58}/>);
    expect(screen.getByText('58')).toBeInTheDocument();expect(heading.style.clipPath).toBe('');
    rerender(<Screen page="archive"/>);
    expect(screen.getByRole('heading').style.clipPath).not.toBe('');
    act(()=>screen.getByRole('button').focus());
    expect(screen.getByRole('heading').style.clipPath).toBe('');
    const root=screen.getByTestId('display');unmount();
    expect(root.querySelector<HTMLElement>('h2')!.style.clipPath).toBe('');
  });
  it('finishes naturally without leaving a mask or dimmed panel',async()=>{
    render(<Screen/>);
    const heading=screen.getByRole('heading');
    expect(heading.style.clipPath).not.toBe('');
    await waitFor(()=>expect(heading.style.clipPath).toBe(''),{timeout:1500});
    expect(heading.closest('section')!.style.opacity).toBe('');
  });
  it.each(['pointerdown','wheel','scroll','resize','visibilitychange'])('settles the display on %s',event=>{
    render(<Screen/>);
    const root=screen.getByTestId('display');
    expect(screen.getByRole('heading').style.clipPath).not.toBe('');
    if(event==='visibilitychange') vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
    act(()=>{(event==='resize'?window:event==='visibilitychange'?document:root).dispatchEvent(new Event(event));});
    expect(screen.getByRole('heading').style.clipPath).toBe('');
  });
  it('settles on a reduced-motion change and shows later arriving content without masking it',async()=>{
    const {rerender}=render(<Screen/>);
    act(()=>policies.get('(prefers-reduced-motion: reduce)')!.set(true));
    expect(screen.getByRole('heading').style.clipPath).toBe('');
    expect(screen.getByTestId('display')).toHaveAttribute('data-display-paused');
    await act(async()=>rerender(<Screen extra/>));
    expect(screen.getByText('새 로그').style.clipPath).toBe('');
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
