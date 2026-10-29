/// <reference types="@cloudflare/workers-types" />

// Cloudflare Workers 런타임 바인딩 타입 확장
// @opennextjs/cloudflare가 전역 CloudflareEnv 인터페이스를 선언하며,
// wrangler.toml의 [[d1_databases]] binding = "DB" 와 대응되는 필드를 추가함

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    PUBLIC_RATE_LIMITER?: {
      limit(input: { key: string }): Promise<{ success: boolean }>;
    };
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_EXPECTED_HOSTNAME?: string;
    SIGNAL_UNSUBSCRIBE_SECRET?: string;
  }
}

export {};
