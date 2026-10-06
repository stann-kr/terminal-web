/**
 * The edition the promo set is printed for: the only file that holds event facts. For a new edition,
 * change these values; every poster and motion piece reads them. Colours are not set here: `palette`
 * names a block in the site's palette file (app/palettes.css), the same one the site wears.
 *
 * `signal` drives the graphic: its pulse period is the rhythm the rings keep in motion.
 * Artists are shown in the order listed, grouped by dock. While the list is empty the main poster
 * says the lineup is to be announced, and the artist and lineup pieces are not exported (the
 * contact sheet previews them with sample names).
 */
export const edition = {
  palette: 'lunar-ceramic',
  code: 'TRM-03',
  number: '03',
  title: 'Vulpecula Junction',
  stage: { en: 'Bearing', ko: '방향' },
  log: { en: '204 days past the heliopause. Unidentified signal received.', ko: '헬리오포즈 돌파 후 204일. 미확인 신호 수신.' },
  date: '2026-11-28',
  time: '23:00',
  venue: 'FAUST SEOUL',
  district: 'YONGSAN-GU // ITAEWON',
  coords: '37.5335° N, 126.9958° E',
  sound: 'TBA',
  site: 'terminal.stann.kr',
  signal: { period: 1.337 },
  artists: [],
};
