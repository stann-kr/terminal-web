# 기술 구성

Next.js App Router / React / TypeScript / TanStack Query, Cloudflare OpenNext와 Drizzle/D1을 사용합니다. npm lockfile이 실제 의존성 버전을 고정합니다.

## 소유 구조

- `app`: URL, metadata, server route 진입점, 오류 복구
- `features/shell`: 프레임, 주 메뉴와 콘텐츠 언어
- `features/events`: 행사 조회·통합 카드 목록·상세·기록
- `features/artists`: 인물 식별과 공개 출연 이력
- `features/home`, `features/about`: 개요와 편집 콘텐츠
- `features/access`, `features/signal`, `features/transmit`: 각 입력 상태와 요청
- `features/display`: 순차 표시·상태 점멸·장식 도형·공통 모션 정책
- `features/ui`: 중립 control, HTTP 오류, 표시 primitive
- `lib/events`, `lib/gate`, `lib/signal`, `lib/transmit`: 기존 서버 domain과 repository

스타일은 각 capability의 CSS Module이 소유합니다. `app/globals.css`는 토큰·font·reset·중립 요소만 포함합니다. STANN OS 공용 원본 token과 patch verifier는 별도로 유지합니다.

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
