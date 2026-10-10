/**
 * The kit's contact sheet: every piece at its own canvas size, scaled into a card, with links to the
 * full-size page and to whatever the exporter has written for it (out/).
 */
import { edition } from './data.js';
import { fileName, formats, motions, pieceQuery, posters, shares, templates } from './pieces.js';

document.documentElement.dataset.palette = edition.palette;
document.getElementById('meta').textContent = `${edition.code} · ${edition.title} · palette ${edition.palette} · promo/data.js`;

const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;

function card(item, motion) {
  const { width, height, label } = formats[item.format];
  const frame = document.createElement('div');
  frame.className = 'frame';
  frame.style.aspectRatio = `${width} / ${height}`;
  const iframe = document.createElement('iframe');
  iframe.src = pieceQuery(item, motion && !quiet ? { play: '' } : {});
  iframe.width = String(width);
  iframe.height = String(height);
  iframe.loading = 'lazy';
  iframe.tabIndex = -1;
  iframe.title = `${item.title} 미리보기`;
  frame.append(iframe);
  new ResizeObserver(([entry]) => {
    iframe.style.transform = `scale(${entry.contentRect.width / width})`;
  }).observe(frame);

  const open = Object.assign(document.createElement('a'), { href: pieceQuery(item, motion ? { play: '' } : {}), textContent: 'OPEN', target: '_blank' });
  open.dataset.open = '';
  const links = document.createElement('p');
  links.className = 'links';
  links.append(open);
  const name = fileName(item);
  const folder = item.piece === 'share' ? 'share' : 'posters';
  const files = item.sample ? [] : motion ? [[`out/motion/${name}.mp4`, 'MP4']] : [[`out/${folder}/${name}.png`, 'PNG'], ...(item.pdf ? [[`out/posters/${name}.pdf`, 'PDF']] : [])];
  for (const [href, text] of files) {
    fetch(href, { method: 'HEAD' }).then(response => {
      if (response.ok) links.append(Object.assign(document.createElement('a'), { href, textContent: text, download: '' }));
    });
  }

  const caption = document.createElement('figcaption');
  caption.append(Object.assign(document.createElement('b'), { textContent: item.title }), Object.assign(document.createElement('span'), { textContent: label }), links);
  const figure = document.createElement('figure');
  figure.append(frame, caption);
  return figure;
}

document.querySelector('[data-set=posters]').append(...posters.map(item => card(item, false)));
document.querySelector('[data-set=motions]').append(...motions.map(item => card(item, true)));
document.querySelector('[data-set=shares]').append(...shares.map(item => card(item, false)));
const waiting = document.querySelector('[data-set=templates]');
if (templates.length) waiting.append(...templates.map(item => card(item, true)));
else waiting.closest('section').hidden = true;
