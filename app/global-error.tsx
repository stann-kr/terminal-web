/* eslint-disable @next/next/no-html-link-for-pages -- A document reload recovers a failed root provider/router. */
'use client';
import { activePalette } from '@/features/shell/palette';
import './palettes.css';
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <html lang="ko" data-palette={activePalette}><body style={{background:'var(--field)',color:'var(--panel-ink)',fontFamily:'sans-serif',padding:'40px'}}><main><h1>TERMINAL을 열지 못했습니다</h1><p>잠시 후 다시 시도해 주세요.</p><button onClick={reset} style={{padding:'12px'}}>다시 불러오기</button><p><a style={{color:'inherit'}} href="/">홈으로 돌아가기</a></p></main></body></html>; }
