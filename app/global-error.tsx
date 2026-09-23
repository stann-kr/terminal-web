'use client';

// This replaces the root layout. Static inline styles also work when its providers or CSS fail.
// Keep metadata in static head HTML to preserve the existing React prerender fallback.
export const dynamic = 'force-dynamic';
const headHtml = `
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TERMINAL — SYSTEM ERROR</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 0; background: #030303; color: #d0d0d0; font: 16px/1.7 system-ui, sans-serif; }
  main { width: 100%; min-height: 100dvh; background: #030303; }
  .label { padding: 12px 24px; font: 700 12px/1.5 ui-monospace, monospace; background: #ff5d00; color: #030303; }
  .content { padding: clamp(24px, 5vw, 48px); }
  h1 { font-size: clamp(28px, 4vw, 56px); line-height: 1.35; overflow-wrap: anywhere; }
  p { margin-block: 20px 28px; color: #a0a0a0; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  button, a { display: inline-flex; align-items: center; min-height: 48px; padding: 12px 20px; border: 1px solid #8c8c8c; background: transparent; color: inherit; font: inherit; text-decoration: none; cursor: pointer; }
  button { background: #ff5d00; color: #030303; border-color: #ff5d00; }
  :focus-visible { outline: 2px solid #d0d0d0; outline-offset: 3px; }
</style>`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="ko">
    <head dangerouslySetInnerHTML={{ __html: headHtml }} />
    <body><main id="main-content">
      <div className="label">TERMINAL / SYSTEM_ERROR</div>
      <div className="content"><h1>화면을 불러오지 못했습니다.</h1><p>잠시 후 다시 시도하거나 홈으로 이동해 주세요.</p><div className="actions"><button type="button" onClick={reset}>다시 시도</button><a href="/home">홈으로</a></div></div>
    </main></body>
  </html>;
}
