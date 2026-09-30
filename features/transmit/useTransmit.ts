'use client';
import { useQueries, useQuery } from '@tanstack/react-query';
import { TRANSMIT_PAGE_SIZE, type TransmitLogPage } from '@/lib/transmit/contract';
import { requestJson } from '@/features/ui/http';

const serverPage = (page: number) => ({
  queryKey: ['transmit', page],
  queryFn: ({ signal }: { signal: AbortSignal }) => requestJson<TransmitLogPage>(`/api/transmit?page=${page}`, { signal }),
});

/** One server page of the public visitor log (five entries per page). */
export function useTransmit(page: number) {
  return useQuery(serverPage(page));
}

/**
 * A window of the public log, `count` entries from `offset` (newest first), put together from the
 * server's pages. Each server page is cached on its own, so a window of another size (the log sized
 * to its plate) reuses what is already read.
 */
export function useTransmitRange(offset: number, count: number) {
  const first = Math.floor(offset / TRANSMIT_PAGE_SIZE) + 1;
  const last = Math.floor((offset + Math.max(1, count) - 1) / TRANSMIT_PAGE_SIZE) + 1;
  const results = useQueries({ queries: Array.from({ length: last - first + 1 }, (_, index) => serverPage(first + index)) });
  const read = results.every(result => result.data);
  const skip = offset - (first - 1) * TRANSMIT_PAGE_SIZE;
  return {
    data: read
      ? { logs: results.flatMap(result => result.data!.logs).slice(skip, skip + count), total: results[0].data!.total }
      : undefined,
    isFetching: results.some(result => result.isFetching),
    isError: results.some(result => result.isError),
    refetch: () => Promise.all(results.map(result => result.refetch())),
  };
}
