import { edition } from './data.js';

/** Canvas sizes. A2 is set in millimetres for print; its pixel size is the same sheet at 96 dpi. */
export const formats = {
  feed: { label: '3:4 · 1080×1440', width: 1080, height: 1440 },
  story: { label: '9:16 · 1080×1920', width: 1080, height: 1920 },
  a2: { label: 'A2 · 420×594mm', width: 1588, height: 2245, paper: { width: 420, height: 594 } },
};

const artistPieces = edition.artists.map(artist => ({ piece: 'artist', artist: artist.id, title: `아티스트 공개 · ${artist.name}` }));

/** The printed set: still frames. `pdf` adds a vector print file beside the PNG. */
export const posters = [
  { piece: 'teaser', format: 'feed', title: '티저' },
  ...artistPieces.map(piece => ({ ...piece, format: 'feed' })),
  { piece: 'lineup', format: 'feed', title: '라인업 공개' },
  { piece: 'main', format: 'feed', title: '메인' },
  { piece: 'main', format: 'a2', title: '메인', pdf: true },
];

/** The motion set: the same compositions played from an empty field to the full poster and back. */
export const motions = [
  { piece: 'teaser', format: 'feed', title: '티저' },
  { piece: 'teaser', format: 'story', title: '티저' },
  ...artistPieces.map(piece => ({ ...piece, format: 'feed' })),
  { piece: 'lineup', format: 'feed', title: '라인업 공개' },
  { piece: 'lineup', format: 'story', title: '라인업 공개' },
  { piece: 'main', format: 'feed', title: '메인' },
  { piece: 'main', format: 'story', title: '메인' },
];

/** The file name a piece exports to, without extension. */
export const fileName = ({ piece, artist, format }) => [piece, artist, format].filter(Boolean).join('_');

/** The poster page's query for a piece. */
export function pieceQuery({ piece, artist, format }, extra = {}) {
  const query = new URLSearchParams({ piece, format, ...(artist ? { artist } : {}), ...extra });
  return `poster.html?${query}`;
}
