/**
 * The edition the promo set is printed for: the only file that holds event facts. For a new edition,
 * change these values; every poster and motion piece reads them. Colours are not set here: `palette`
 * names a block in the site's palette file (app/palettes.css), the same one the site wears.
 *
 * Artists are shown in the order listed, grouped by dock.
 */
export const edition = {
  palette: 'lunar-ceramic',
  code: 'TRM-02',
  number: '02',
  title: 'Heliopause Outskirts',
  stage: { en: 'Breach', ko: '경계 돌파' },
  date: '2026-05-08',
  time: '23:00',
  venue: 'FAUST SEOUL',
  district: 'YONGSAN-GU // ITAEWON',
  coords: '37.5335° N, 126.9958° E',
  sound: 'KIRSCH AUDIO SYSTEM',
  site: 'terminal.stann.kr',
  artists: [
    { id: '02-B', name: 'DEXTUNE', origin: 'KR', dock: '1' },
    { id: '02-A', name: 'STANN LUMO', origin: 'KR', dock: '1' },
    { id: '02-C', name: 'LUCII', origin: 'KR', dock: '1' },
    { id: '02-D', name: 'CUPRUM', origin: 'KR', dock: '2' },
    { id: '02-E', name: 'FOI', origin: 'KR', dock: '2' },
  ],
};
