/**
 * The palettes defined in app/palettes.css. The site wears `activePalette`; to change the season's
 * colours, add a block there and switch the id here.
 */
export const palettes = ['lunar-ceramic', 'terminal-night'] as const;
export type PaletteId = (typeof palettes)[number];
export const activePalette: PaletteId = 'lunar-ceramic';
