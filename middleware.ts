import type { NextRequest } from 'next/server';
import { hasMalformedPercentEncoding } from '@/lib/http/percentEncoding';

/**
 * 깨진 percent-encoding 경로(`/events/%E0%A4%A`)는 라우트에서 decode 오류로 500이 나므로 여기서 404로 끊는다.
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
}

export const config = {
  // 빌드 산출물·이미지 최적화·public 정적 파일은 건너뛴다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|og/).*)'],
};
