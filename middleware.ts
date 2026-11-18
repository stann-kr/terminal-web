import { NextResponse, type NextRequest } from 'next/server';
import { hasMalformedPercentEncoding } from '@/lib/http/percentEncoding';
import {
  ENTRY_COOKIE,
  ENTRY_MAX_AGE_SECONDS,
  entryFromVisit,
  parseEntry,
  serializeEntry,
  shouldStoreEntry,
} from '@/lib/trace/entry';

/** A page the visitor opened (not a fetch, prefetch or API call), the only visit that names an entry. */
function isPageVisit(request: NextRequest): boolean {
  if (request.method !== 'GET' || request.nextUrl.pathname.startsWith('/api/')) return false;
  const mode = request.headers.get('sec-fetch-mode');
  if (mode) return mode === 'navigate';
  return (request.headers.get('accept') ?? '').includes('text/html');
}

/**
 * 깨진 percent-encoding 경로(`/events/%E0%A4%A`)는 라우트에서 decode 오류로 500이 나므로 여기서 404로 끊는다.
 * 페이지 방문이 아티스트 링크·호스트 페이지·외부 사이트에서 왔으면 운영자 전용 접속 기록을 위해
 * 유입 쿠키(`tw_entry`, 30일)를 남긴다(lib/trace/entry).
 * `proxy.ts`는 Node.js 전용이라 OpenNext Cloudflare가 빌드를 막으므로 edge로 도는 `middleware.ts`를 쓴다.
 * runtime은 지정하지 않는다: middleware는 기본이 edge이고, 명시하면 Edge Runtime 폐기 경고만 늘어난다.
 */
export function middleware(request: NextRequest) {
  if (hasMalformedPercentEncoding(request.nextUrl.pathname)) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  if (!isPageVisit(request)) return;
  const next = entryFromVisit(request.nextUrl, request.headers.get('referer'), new Date());
  if (!shouldStoreEntry(next, parseEntry(request.cookies.get(ENTRY_COOKIE)?.value))) return;
  const response = NextResponse.next();
  response.cookies.set({
    name: ENTRY_COOKIE,
    value: serializeEntry(next),
    path: '/',
    maxAge: ENTRY_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  // 빌드 산출물·이미지 최적화·public 정적 파일은 건너뛴다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|og/).*)'],
};
