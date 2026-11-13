# 기술 구성

Next.js App Router / React / TypeScript / TanStack Query, Cloudflare OpenNext와 Drizzle/D1을 사용합니다. npm lockfile이 실제 의존성 버전을 고정합니다.

## 소유 구조

- `app`: URL, metadata, server route 진입점(robots·sitemap·캘린더 피드 포함), 오류 복구. 페이지는 화면을 그리지 않고 주소에 응답하며(상태 코드·metadata·구조화 데이터), 화면은 root layout의 무대가 그립니다.
- `features/shell`: Shell(무대를 담는 `main`, 본문 건너뛰기, 무대 밖 페이지의 focus), 시계·소개글 언어 전환·팔레트 선택·콘솔 포인터
- `features/stage`: 무대. 주소 → 상태(`state.ts`), 화면별 배치 트리(`config.ts`)와 타일링·넘침 처리(`layout.ts`), 판(`plates/`), 운반체 이동과 모션, 글 측정(`text.ts`, pretext)
- `features/events`: 이벤트 조회·모델·공연표·세션 키(CALENDAR·MAP·SHARE)·캘린더 피드·공유 metadata·구조화 데이터
- `features/artists`: 인물 식별과 공개 출연 이력
- `features/about`: 소개 콘텐츠와 인스타그램 핸들(`content.json`)
- `features/access`, `features/signal`, `features/transmit`: 각 입력 상태와 요청
- `features/display`: 조회 활동 램프·상태 표식·실제 수치 분할 막대(`Meter`)·공통 모션 정책(`data-display-paused`)
- `features/ui`: 패널·사실 표·키·예비 칸(`Bay`) 같은 중립 primitive, HTTP 오류
- `lib/events`, `lib/gate`, `lib/signal`, `lib/transmit`: 서버 domain과 repository. 이벤트 수명(시작·끝·공연표 슬롯 시각)은 `lib/events/lifecycle.ts`가 소유합니다.
- `lib/api`: 요청 본문 검증, 시도 제한(`abuseControl.ts`), PII 없는 로그, no-store 응답

스타일과 판별 전용 표현은 각 capability의 CSS Module이 소유하고, `app/globals.css`는 token·font·reset·`data-surface` 색 plate만 포함합니다. 색 값은 `app/palettes.css`의 팔레트 블록에만 있습니다. 화면이 바뀌면 무대가 새 판·상세 판의 제목(h1)으로 focus를 옮기고, 무대 밖 페이지는 Shell이 `main`으로 옮깁니다. 모션 감소·고대비·save-data·숨겨진 탭 조건에서 `useDisplayPolicy`가 Shell에 `data-display-paused`를 붙이고 전역 CSS가 애니메이션·전환을 제거합니다. 조회·전송 표식은 실제 query·요청 상태에 연결합니다. 글꼴은 `public/fonts/instrument`의 Barlow·Barlow Condensed·Share Tech Mono(OFL, Latin 서브셋)와 TERMINAL 단어 전용 레터링 글꼴 TERMINAL Lettering(woff2, 커닝 내장)이며 한글은 시스템 산세리프로 표시합니다. STANN OS 공용 원본 token과 patch verifier는 별도로 유지합니다.

## 공개 API

| Method | Path | 역할 |
|---|---|---|
| GET | /api/events | 행사 배열과 출연 레코드 |
| GET | /api/artists?eventId=... | 행사별 출연 |
| POST | /api/gate/code-info | 선택 행사 초대인 확인. 응답의 `open`이 false면 정원이 찬 코드이고, 신청 기간 밖이면 403 `REQUEST_PERIOD_INACTIVE` |
| POST | /api/gate/request | 게스트 신청 저장. 본문에 `waitlist: true`가 있을 때만 정원이 찬 코드의 신청을 대기 명단에 올리고(`waitlisted: true`), 없으면 409 `GUEST_LIMIT_REACHED`. 같은 인스타그램 ID가 그 이벤트의 대기 명단에 이미 있으면(다른 초대인의 명단 포함) 새로 올리지 않고 `waitlisted: true, alreadyWaiting: true`로 답함. `waitlist`와 소식 수신 동의는 함께 보낼 수 없음 |
| POST | /api/invite/host | 아티스트 초대 페이지 조회(링크의 `t`가 자격). 게스트는 이름·신청 시각만, 대기자는 인스타그램 ID 포함 |
| POST | /api/invite/host/guests, /api/invite/host/waitlist | 아티스트가 게스트를 직접 등록 · 대기자를 명단으로 올림 |
| GET | /api/invite/host/file | 초대 페이지에 실린 홍보 파일 한 건(비공개 R2) |
| POST | /api/signal | 소식 수신 연락처 저장 |
| GET, POST | /api/signal/unsubscribe | 수신 거부. POST가 구독 행을 지우고 같은 주소로 게스트 신청에 남긴 이메일·소식 동의도 지움(메일 앱의 one-click 포함). GET은 SIGNAL 화면의 확인 키로 보낼 뿐 지우지 않음 |
| GET, POST | /api/transmit | 공개 로그 조회와 저장 |
| GET | /calendar.ics | 공개 세션 일정 구독 피드 |
| GET | /robots.txt, /sitemap.xml | 검색엔진 규칙(운영 주소만 허용)과 화면·세션·아티스트 주소 목록 |

브라우저는 same-origin API만 호출합니다. POST content type·payload·identity·중복/한도 경쟁을 서버에서 검증하며 no-store와 Idempotency-Key 경계를 유지합니다. 쓰기 API 네 곳(초대 코드 확인·게스트 신청·소식 신청·방문자 로그)은 Workers Rate Limiting 바인딩 `PUBLIC_RATE_LIMITER`로 접속 IP·작업마다 60초에 20회까지 받고(초대 코드 확인과 게스트 신청은 한 예산), 넘으면 429 `RATE_LIMITED`입니다. 아티스트 초대 페이지의 조회·등록과 홍보 파일 받기는 각각 별도 예산(`host`, `host-file`)을 써서, 미리보기 이미지 요청이 명단 조회를 막지 않습니다. 바인딩은 `wrangler.toml`의 환경마다 따로 선언하며, 이 제한은 위치별·근사 카운터라 정확한 집계가 아닙니다. 공개 event DTO에 초대 코드·한도는 포함하지 않습니다. 비공개 상태 인물 표시를 UI에서 제외하며, 기존 DTO의 상태별 이름 마스킹은 별도 서버 계약입니다.

## 로컬과 운영

Next dev/start 및 Docker는 3005 포트입니다. `wrangler.toml` 맨 위 설정(`terminal-web-local`)은 로컬 개발만 쓰고, 배포하는 Worker는 `[env.production]`의 `terminal-web`과 `[env.development]`의 `terminal-web-dev`입니다. 배포 명령은 항상 `--env`를 줍니다. 요청마다 자동으로 남는 로그(`invocation_logs`)는 꺼 두었습니다. 초대 페이지·홍보 파일·수신 거부 링크가 서명 토큰을 주소 쿼리로 받아, 요청 주소가 로그에 남지 않게 하기 위해서입니다. Wrangler의 `--local`로 생성한 DB는 해당 checkout `.wrangler/state`에 격리됩니다. 공유 운영 D1을 사용하는 development binding과 local simulation을 혼동하지 않습니다. 원격 migration·secret·배포는 별도 작업입니다.

`npm run build`는 Next 산출물을 만들고 token verifier를 실행합니다. `npm run transmit:remove`는 방문자 로그 글을 백업 후 내리고 되돌립니다(`--remote`는 운영 DB이며 `--confirm <글 ID>` 없이는 계획만 출력, [문제 해결](TROUBLESHOOTING.md) 참고). `npm run signal:mail`은 발송한 구독자를 메일 내용(제목·본문)별 로그에 signal id로만 남기고, 같은 메일을 다시 실행하면 로그에 있는 구독자를 건너뜁니다. 회신 주소는 저장소에 두지 않고 환경 변수나 `.env`의 `SIGNAL_REPLY_TO`에서 읽으며, 없거나 메일 주소 하나가 아니면 아무것도 하지 않고 멈춥니다. Worker 패키징은 `npm run build:worker:development` / `npm run build:worker:production`입니다. 로컬 테스트·build가 운영 배포 성공을 의미하지 않습니다.

CI(`.github/workflows/validate.yml`)는 push와 PR마다 migration 이력·테스트·lint·typecheck·build·smoke·production 설정 dry-run을 실행합니다. PR에서는 `npm run db:check-history -- --base <기준 브랜치>`로 기준 브랜치에 이미 있는 migration SQL과 snapshot이 바뀌지 않았는지도 대조합니다(lock만으로는 migration과 lock을 함께 고친 변경을 잡지 못합니다). `npm audit --omit=dev`는 `.github/workflows/audit.yml`이 매주 월요일과 수동 실행으로 돌립니다.
