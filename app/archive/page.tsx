import { Suspense } from 'react';
import { Loading } from '@/features/ui/Ui';
import type { Metadata } from 'next';
import { Archive } from '@/features/events/Archive';
export default function Page() { return <Suspense fallback={<Loading/>}><Archive/></Suspense>; }
export const metadata: Metadata = { title: '행사 기록' };
