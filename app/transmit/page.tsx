import { Suspense } from 'react';
import { Loading } from '@/features/ui/Ui';
import type { Metadata } from 'next';
import { Transmit } from '@/features/transmit/Transmit';
export default function Page() { return <Suspense fallback={<Loading/>}><Transmit/></Suspense>; }
export const metadata: Metadata = { title: '방문자 로그' };
