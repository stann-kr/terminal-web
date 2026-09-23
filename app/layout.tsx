import type { Metadata } from 'next';
import { Providers } from '@/features/shell/Providers';
import { Shell } from '@/features/shell/Shell';
import './globals.css';
export const metadata: Metadata = { title: { default: 'TERMINAL — Seoul Techno Platform', template: '%s / TERMINAL' }, description: '서울의 음악과 사람. TERMINAL 행사, 참여 아티스트와 기록.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><Providers><Shell>{children}</Shell></Providers></body></html>;
}
