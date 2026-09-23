import { Suspense } from 'react';
import { Loading } from '@/features/ui/Ui';
import type { Metadata } from 'next';
import { Events } from '@/features/events/Events';
export default function Page() { return <Suspense fallback={<Loading/>}><Events/></Suspense>; }
export const metadata: Metadata = { title: '이벤트' };
