# 기술 구성

Next.js App Router / React / TypeScript / TanStack Query, Cloudflare OpenNext와 Drizzle/D1을 사용합니다. npm lockfile이 실제 의존성 버전을 고정합니다.

## 소유 구조

- `app`: URL, metadata, server route 진입점, 오류 복구
- `features/shell`: 상단 레일(브랜드·주 메뉴 탭·KST 시계), 상태줄, 키 안내 바, 주 메뉴·단축키, 화면 효과와 콘텐츠 언어
- `features/events`: 행사 조회·통합 카드 목록·상세·기록
- `features/artists`: 인물 식별과 공개 출연 이력
- `features/home`, `features/about`: 개요와 편집 콘텐츠
- `features/console`: 전역 콘솔 도크, 사이트 명령어 해석·공개 데이터 텍스트 출력·`cd` 이동·입력 및 탭별 기록
- `features/access`, `features/signal`, `features/transmit`: 각 입력 상태와 요청
- `features/display`: 조회 활동 표시·상태 표식·공통 모션 정책(`data-display-paused`)
- `features/ui`: 중립 control, HTTP 오류, 표시 primitive
- `lib/events`, `lib/gate`, `lib/signal`, `lib/transmit`: 기존 서버 domain과 repository

스타일과 페이지별 전용 장식은 각 capability의 CSS Module이 소유합니다. 이벤트 목록과 터미널 출력은 같은 행사 정렬과 공개 아티스트 경계를 사용합니다. 콘솔은 root layout의 Shell에 한 번만 붙어 route 전환에도 unmount되지 않습니다. 홈에서는 출력이 기본으로 펼쳐지고, 다른 route에서는 사용자가 펼치거나 접은 상태를 홈에 돌아갈 때까지 유지합니다. router는 `cd`만 호출하며 이동 대상은 고정 route 표 또는 공개 행사 목록에 있는 ID의 `eventHref()`로 제한합니다. `open`을 포함한 나머지 명령은 출력만 합니다. 행사 query에 데이터가 없으면 데이터 명령은 0건 대신 조회 불가를 출력합니다. `cd`와 F키를 포함한 실제 route 전환은 `main`으로 focus를 옮기며, 동일 route로의 이동 요청은 현재 focus를 유지합니다. sessionStorage에 명령·출력·초안을 보관합니다. useSyncExternalStore의 빈 서버 스냅샷으로 hydration을 유지하며 저장 실패는 메모리 동작으로 복구합니다. 입력할 때는 초안만 저장하고 전체 출력은 명령 실행 때 저장합니다. PrintedResponse가 일시적인 출력 진행을 소유하며 grapheme 단위 6ms, 줄바꿈 뒤 24ms 간격으로 표시합니다. 긴 응답은 grapheme을 묶어 출력하고 1.2초 이후 첫 타이머에서 완성된 응답으로 전환해 대기열 지연을 제한합니다. 명령 응답은 순차 출력하고 clear/unmount에서 타이머를 취소합니다. FX OFF·모션 감소·고대비·save-data·숨겨진 탭에서는 전체 응답을 즉시 표시합니다. 같은 조건에서 `useDisplayPolicy`가 Shell에 `data-display-paused`를 붙이고 전역 CSS가 애니메이션·전환을 멈춘 상태가 아니라 제거된 상태로 둡니다. 전원 켜짐은 HTML 파싱 중 실행되는 정적 inline script가 탭 세션당 한 번(save-data 제외) 전원 켜짐 오버레이에 표식을 붙여 CSS로 420ms 재생하고, route 전환은 Shell이 지속되는 `main`에 240ms `steps(12)` clip-path 와이프 표식을 잠시 붙입니다. 두 표식 모두 서버 HTML에 inline style을 넣지 않고 재생 후 제거해 hydration과 FX 재개 시 재생을 막습니다. GSAP readout은 제거했습니다. 접근성 로그에는 완성된 응답을 한 번 제공하고 문자별 시각 변경은 읽기 대상에서 제외합니다. 공개 로그 장식은 해당 페이지 query의 isFetching/error/data 상태에 연결하고, 신청·전송 장식은 실제 pending/checking 상태에 연결합니다. `app/globals.css`는 토큰·font·reset·중립 요소만 포함합니다. 한글은 `public/fonts/d2coding`의 D2Coding 1.3.2 KS X 1001 서브셋(OFL)을 한글 `unicode-range`에만 적용합니다. STANN OS 공용 원본 token과 patch verifier는 별도로 유지합니다.

## 공개 API

| Method | Path | 역할 |
|---|---|---|
| GET | /api/events | 행사 배열과 출연 레코드 |
| GET | /api/artists?eventId=... | 행사별 출연 |
| POST | /api/gate/code-info | 선택 행사 초대인 확인 |
| POST | /api/gate/request | 게스트 신청 저장 |
| POST | /api/signal | 소식 수신 연락처 저장 |
| GET, POST | /api/transmit | 공개 로그 조회와 저장 |

브라우저는 same-origin API만 호출합니다. POST content type·payload·identity·중복/한도 경쟁을 서버에서 검증하며 no-store와 Idempotency-Key 경계를 유지합니다. 공개 event DTO에 초대 코드·한도는 포함하지 않습니다. 비공개 상태 인물 표시를 UI에서 제외하며, 기존 DTO의 상태별 이름 마스킹은 별도 서버 계약입니다.

## 로컬과 운영

Next dev/start 및 Docker는 3005 포트입니다. Wrangler의 `--local`로 생성한 DB는 해당 checkout `.wrangler/state`에 격리됩니다. 공유 운영 D1을 사용하는 development binding과 local simulation을 혼동하지 않습니다. 원격 migration·secret·배포는 별도 작업입니다.

`npm run build`는 Next 산출물을 만들고 token verifier를 실행합니다. Worker 패키징은 `npm run build:worker:development` / `npm run build:worker:production`입니다. 로컬 테스트·build가 운영 배포 성공을 의미하지 않습니다.
