import { edition } from './data.js';

/** Canvas sizes. A2 is set in millimetres for print; its pixel size is the same sheet at 96 dpi. */
export const formats = {
  feed: { label: '3:4 · 1080×1440', width: 1080, height: 1440 },
  story: { label: '9:16 · 1080×1920', width: 1080, height: 1920 },
  a2: { label: 'A2 · 420×594mm', width: 1588, height: 2245, paper: { width: 420, height: 594 } },
};

/** Stand-in names for previewing the artist and lineup pieces before the lineup is out. */
export const sampleArtists = [
  { id: 'S1', name: 'Artist Name', origin: 'KR', dock: '1' },
  { id: 'S2', name: 'Longer Artist', origin: 'KR', dock: '1' },
  { id: 'S3', name: 'Name', origin: 'KR', dock: '1' },
  { id: 'S4', name: 'Second Dock', origin: 'KR', dock: '2' },
];

const confirmed = edition.artists.length > 0;
const artistPieces = edition.artists.map(artist => ({ piece: 'artist', artist: artist.id, title: `아티스트 공개 · ${artist.name}` }));

/** The printed set: still frames. `pdf` adds a vector print file beside the PNG. */
export const posters = [
  { piece: 'teaser', format: 'feed', title: '티저' },
  ...artistPieces.map(piece => ({ ...piece, format: 'feed' })),
  ...(confirmed ? [{ piece: 'lineup', format: 'feed', title: '라인업 공개' }] : []),
  { piece: 'main', format: 'feed', title: '메인' },
  { piece: 'main', format: 'a2', title: '메인', pdf: true },
];

/** The motion set: the same compositions played from a bare ground to the full poster and back. */
export const motions = [
  { piece: 'teaser', format: 'feed', title: '티저' },
  { piece: 'teaser', format: 'story', title: '티저' },
  ...artistPieces.map(piece => ({ ...piece, format: 'feed' })),
  ...(confirmed
    ? [
        { piece: 'lineup', format: 'feed', title: '라인업 공개' },
        { piece: 'lineup', format: 'story', title: '라인업 공개' },
      ]
    : []),
  { piece: 'main', format: 'feed', title: '메인' },
  { piece: 'main', format: 'story', title: '메인' },
];

/** Previews of the pieces that wait for the lineup, set with sample names (never exported). */
export const templates = confirmed
  ? []
  : [
      { piece: 'artist', artist: 'S2', format: 'feed', title: '아티스트 공개 · 템플릿', sample: true },
      { piece: 'lineup', format: 'feed', title: '라인업 공개 · 템플릿', sample: true },
    ];

/** The posters as Claude Design artboards (out/artboards/<name>.dc.html): the canvas's final set. */
export const artboards = [
  { name: 'Teaser', piece: 'teaser', format: 'feed', title: 'Teaser — TERMINAL [03]' },
  { name: 'MainFeed', piece: 'main', format: 'feed', title: 'Main 3:4 — TERMINAL [03]' },
  { name: 'MainA2', piece: 'main', format: 'a2', title: 'Main A2 — TERMINAL [03]' },
  { name: 'ArtistTemplate', piece: 'artist', artist: confirmed ? edition.artists[0].id : 'S2', format: 'feed', title: 'Artist template — TERMINAL [03]', sample: !confirmed },
  { name: 'LineupTemplate', piece: 'lineup', format: 'feed', title: 'Lineup template — TERMINAL [03]', sample: !confirmed },
];

/** The file name a piece exports to, without extension. */
export const fileName = ({ piece, artist, format }) => [piece, artist, format].filter(Boolean).join('_');

/** The poster page's query for a piece. */
export function pieceQuery({ piece, artist, format, sample }, extra = {}) {
  const query = new URLSearchParams({ piece, format, ...(artist ? { artist } : {}), ...(sample ? { sample: '' } : {}), ...extra });
  return `poster.html?${query}`;
}
