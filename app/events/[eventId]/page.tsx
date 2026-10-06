import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eventMetadata } from '@/features/events/metadata';
import { findEvent } from '../findEvent';

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    decodeURIComponent(eventId);
  } catch {
    notFound();
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const event = await findEvent((await params).eventId);
  return event ? eventMetadata(event) : { title: '이벤트 상세' };
}
