import type { Metadata } from 'next';
import { Providers } from '@/features/shell/Providers';
import { Shell } from '@/features/shell/Shell';
import './globals.css';
export const metadata: Metadata = { title: { default: 'TERMINAL', template: '%s / TERMINAL' }, description: '서울 테크노 이벤트 TERMINAL의 행사, 참여 아티스트와 기록.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><Providers><Shell>{children}</Shell></Providers></body></html>;
}
