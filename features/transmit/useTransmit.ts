'use client';
import { useQuery } from '@tanstack/react-query';
import type { TransmitLogPage } from '@/lib/transmit/contract';
import { requestJson } from '@/features/ui/http';

/** One server page of the public visitor log (five entries per page). */
export function useTransmit(page: number) {
  return useQuery({
    queryKey: ['transmit', page],
    queryFn: ({ signal }) => requestJson<TransmitLogPage>(`/api/transmit?page=${page}`, { signal }),
  });
}
