import { gsap } from 'gsap';

const panelSelector = '[data-readout-panel]';
const rowSelector = '[data-readout-row]';
const meterSelector = '[data-readout-meter]';
const instrumentSelector = '[data-readout-instrument]';
const excluded = '[hidden],form,[role="alert"],[role="status"],[role="timer"],[data-readout-live],details:not([open]) > :not(summary)';
const controls = 'input,textarea,select,button,a,[contenteditable="true"]';

function lineBottoms(node: HTMLElement, bottom: number): number[] {
  const range = document.createRange();
  range.selectNodeContents(node);
  if (typeof range.getClientRects !== 'function') return [];
  const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0).sort((a,b) => a.top-b.top);
  const lines: { top: number; bottom: number }[] = [];
  for (const rect of rects) {
    const last = lines.at(-1);
    if (last && rect.top < last.bottom - Math.min(rect.height,last.bottom-last.top)/2) last.bottom = Math.max(last.bottom,rect.bottom);
    else lines.push({ top:rect.top,bottom:rect.bottom });
  }
  return lines.map((line,index) => index === lines.length-1 ? 0 : Math.max(0,bottom-(line.bottom+lines[index+1].top)/2));
}

/** Owns only transient display styles; never changes text, focus, DOM structure or values. */
export function createReadout(root: HTMLElement, enabled: () => boolean = () => true) {
  const seen = new WeakSet<HTMLElement>();
  const active = new Set<gsap.Context>();
  let disposed = false;
  const settle = (context: gsap.Context) => {
    active.delete(context);
    context.revert();
  };
  const finish = () => { [...active].forEach(settle); };

  function reveal() {
    if (disposed) return;
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(`${panelSelector},${rowSelector},${meterSelector},${instrumentSelector}`)).filter(node => !seen.has(node));
    candidates.forEach(node => seen.add(node));
    if (!enabled() || root.contains(document.activeElement) && document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
    const viewport = (root.querySelector('main') ?? root).getBoundingClientRect();
    // Measure first. Layout-free environments retain fully readable static content.
    const measured = candidates.filter(node => !node.closest(excluded) && (node.matches(`${meterSelector},${instrumentSelector}`) || !node.closest('[aria-hidden="true"]'))).map(node => ({ node,bounds:node.getBoundingClientRect() }))
      .filter(({bounds}) => bounds.width > 0 && bounds.height > 0 && bounds.bottom > viewport.top && bounds.top < viewport.bottom);
    const allPanels = measured.filter(({node}) => node.matches(panelSelector) && !node.querySelector('form,input,textarea,select,[role="alert"],[role="status"]'));
    const panels = allPanels.filter(({node}) => !allPanels.some(parent => parent.node !== node && parent.node.contains(node)));
    const rows = measured.filter(({node}) => node.matches(rowSelector) && !node.closest(controls) && !node.querySelector(controls))
      .filter(({node}) => !node.parentElement?.closest(rowSelector))
      .map(({node,bounds}) => ({ node,bottoms:lineBottoms(node,bounds.bottom) })).filter(row => row.bottoms.length);
    const meters = measured.filter(({node}) => node.matches(meterSelector));
    const instruments = measured.filter(({node}) => node.matches(instrumentSelector));
    if (!panels.length && !rows.length && !meters.length && !instruments.length) return;

    // A completed batch releases its target references instead of accumulating in the route context.
    const context = gsap.context(() => {},root);
    active.add(context);
    try { context.add(() => {
      const sequence = gsap.timeline({ paused:true, defaults:{ ease:'none' }, onComplete:() => settle(context) });
      // Overlap the panel ignition and line passes; even dense screens settle within 310ms.
      const delayFor = (node: HTMLElement) => Math.max(0,Math.min(4,panels.findIndex(panel => panel.node === node || panel.node.contains(node)))) * .016;
      panels.forEach(({node}) => sequence.fromTo(node,{opacity:.6,y:6},{opacity:1,y:0,duration:.18,ease:'power3.out'},delayFor(node)));
      const offsets = new Map<HTMLElement,number>();
      rows.forEach(({node,bottoms}) => {
        const owner = panels.find(panel => panel.node.contains(node))?.node ?? root;
        const offset = offsets.get(owner) ?? 0;
        const start = .016 + delayFor(node);
        sequence.set(node,{clipPath:'inset(0 0 100% 0)',immediateRender:true},0);
        bottoms.forEach((bottom,index) => sequence.set(node,{clipPath:`inset(-0.15em -0.15em ${bottom ? `${bottom}px` : '-0.15em'} -0.15em)`},start+Math.min(14,offset+index)*.012));
        sequence.to(node,{opacity:1,duration:.06},start+Math.min(14,offset+bottoms.length)*.012);
        offsets.set(owner,offset+bottoms.length);
      });
      meters.forEach(({node}) => sequence.fromTo(node,{scaleX:0},{scaleX:1,duration:.14,ease:'power3.out'},.032+delayFor(node)));
      instruments.forEach(({node},index) => sequence.fromTo(node,{clipPath:'inset(0 100% 0 0)',opacity:.4},{clipPath:'inset(0 0% 0 0)',opacity:1,duration:.2,ease:'power2.out'},.02+Math.min(index,4)*.016));
      sequence.play();
    }); } catch { settle(context); }
  }
  return { reveal, finish, dispose:() => { disposed=true;finish(); } };
}
