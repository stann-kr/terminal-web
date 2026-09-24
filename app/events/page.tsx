import { Suspense } from 'react';
import { Loading } from '@/features/ui/Ui';
import type { Metadata } from 'next';
import { Events } from '@/features/events/Events';
import { redirect } from 'next/navigation';
import { eventHref } from '@/features/events/model';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  if (typeof params.selected === 'string' && params.selected) redirect(eventHref(params.selected));
  return <Suspense fallback={<Loading/>}><Events/></Suspense>;
}
export const metadata: Metadata = { title: '이벤트' };
