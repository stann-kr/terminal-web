import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { Providers } from '@/features/shell/Providers';
import { activePalette } from '@/features/shell/palette';
import { Shell } from '@/features/shell/Shell';
import siteContent from '@/features/about/content.json';
import { SITE_ORIGIN } from '@/features/events/metadata';
import './palettes.css';
import './globals.css';
export const metadata: Metadata = { metadataBase: new URL(SITE_ORIGIN), title: { default: 'TERMINAL', template: '%s / TERMINAL' }, description: `${siteContent.tagline} ${siteContent.manifesto.ko.split('\n\n')[0]}` };
/** The faces the first screen is set in (app/globals.css), fetched with the document so they are in before it paints. */
const FONTS = [
  ['/fonts/ProcrastinatingPixie-WyVOO.ttf', 'font/ttf'],
  ...['BarlowCondensed-Medium', 'BarlowCondensed-SemiBold', 'BarlowCondensed-Bold', 'Barlow-Regular', 'Barlow-Medium', 'ShareTechMono-Regular']
    .map(name => [`/fonts/instrument/${name}.woff2`, 'font/woff2']),
] as const;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  for (const [href, type] of FONTS) preload(href, { as: 'font', type, crossOrigin: 'anonymous' });
  return <html lang="ko" data-palette={activePalette}><body><Providers><Shell>{children}</Shell></Providers></body></html>;
}
