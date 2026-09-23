const textSelector = '.tm-terminal-text,h1,h2,h3,p,dt,dd,time,label,span';
const excluded = '[hidden],details:not([open]) > :not(summary),.tm-sr-only,[data-readout-source],[data-readout-output],[data-readout-ghost],[data-pending-pulse]';
const panelSelector = '.tm-cell,.tm-page-heading,.tm-roster,.tm-history-year,.tm-history-entry,.tm-channels > a,.tm-form-field,.tm-consent,.tm-code-block,.tm-contact-result,.tm-artist-data,.tm-contact-notice,.tm-transmit-log li,.tm-log-header,.tm-log-pagination,.tm-action,.tm-button,input,textarea,select';

/** Each surface appears at once; opacity preserves its final footprint. */
export function readoutPanels(root: HTMLElement, containers: HTMLElement[]) {
  const region = root.closest('[data-readout-region]');
  return [...new Set(containers.flatMap(container => [container, ...container.querySelectorAll<HTMLElement>(panelSelector)]))]
    .filter(node => node.matches(panelSelector) && !node.closest(excluded) && node.closest('[data-readout-region]') === region)
    .map(node => {
      const bounds = node.getBoundingClientRect();
      return { node, top: bounds.top, left: bounds.left, hostsRegion: Boolean(node.querySelector('[data-readout-region]')) };
    });
}

/** Find text owners without masking frames, native fields or nested regions. */
export function readoutText(root: HTMLElement, containers: HTMLElement[]) {
  const region = root.closest('[data-readout-region]');
  const candidates = new Set(containers.flatMap(container => [container, ...container.querySelectorAll<HTMLElement>(textSelector)]).filter(node => {
    if (!node.matches(textSelector) || !node.textContent?.trim() || node.closest(excluded)) return false;
    if (node.closest('[data-readout-region]') !== region) return false;
    if (!node.matches('.tm-terminal-text') && node.querySelector('.tm-terminal-text')) return false;
    if (node.querySelector('input,textarea,select,button,a')) return false;
    return !node.matches('label:has(input,textarea,select)');
  }));
  return [...candidates].filter(node => {
    for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) {
      if (candidates.has(parent)) return false;
    }
    return true;
  });
}

/** Read all geometry before the timeline writes; React's text stays intact. */
export function measureReadout(node: HTMLElement) {
  const bounds = node.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = typeof range.getClientRects === 'function'
    ? Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0).sort((a, b) => a.top - b.top)
    : [];
  const rows: { top: number; bottom: number }[] = [];
  for (const rect of rects) {
    const last = rows.at(-1);
    if (last && Math.min(last.bottom, rect.bottom) - rect.top > Math.min(last.bottom - last.top, rect.height) / 2) last.bottom = Math.max(last.bottom, rect.bottom);
    else rows.push({ top: rect.top, bottom: rect.bottom });
  }
  // DOM-only environments have no layout; retain a complete text fallback.
  const bottoms = rows.length ? rows.map((row, index) => index === rows.length - 1 ? 0
    : Math.max(0, bounds.bottom - (row.bottom + rows[index + 1].top) / 2)) : [0];
  return { node, top: bounds.top, left: bounds.left, bottoms };
}
