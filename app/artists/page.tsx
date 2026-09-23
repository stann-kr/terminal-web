import { Suspense } from 'react';
import { Loading } from '@/features/ui/Ui';
import type { Metadata } from 'next';
import { Artists } from '@/features/artists/Artists';
export default function Page() { return <Suspense fallback={<Loading/>}><Artists/></Suspense>; }
export const metadata: Metadata = { title: '아티스트' };
