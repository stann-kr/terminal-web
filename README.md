# TERMINAL

서울 기반 테크노 플랫폼. 행사 일정과 공연표, 참여 아티스트와 지난 행사 기록을 탐색하고 게스트 신청·소식 신청·방문자 로그를 이용합니다.

## 실행

Node.js 22 이상과 npm을 사용합니다.

```sh
npm ci
npx wrangler d1 migrations apply terminal-db --local
npm run dev
```

로컬 주소는 http://localhost:3005 입니다. API는 같은 출처의 `/api/*`를 사용하며 로컬 D1 데이터는 `.wrangler/state`에 저장됩니다. 초기 행사 자료는 로컬 DB에 준비해야 합니다. 조회 실패를 빈 행사로 대체하거나 정적 행사 배열을 운영 데이터로 사용하지 않습니다.

## 화면

- `/`: 대표 행사, 기록 요약, 최근 방문자 글
- `/events`, `/events/:eventId`: 행사 탐색과 상세
- `/artists`, `/artists/:artistKey`: 아티스트 명부와 출연 이력
- `/archive`: 연도·장소·행사명으로 탐색하는 지난 기록
- `/transmit`: 공개 글 작성과 5건 단위 목록
- `/signal`: 행사 소식 수신 연락처 저장
- `/about`: 소개와 공식 채널
- `/events/:eventId/request`: 선택 행사 게스트 신청

기존 `/home`, `/gate`, `/gate/request`, `/lineup`, `/status`, `/link` 주소는 새 화면으로 연결됩니다.

## 검증

```sh
npm test
npm run lint
npm run typecheck
npm run postinstall && npm run build
npm run db:check-history
npm run test:d1
```

빌드 실행 후 `npm start`로 서버를 열고 `SMOKE_API=1 npm run smoke:http`로 페이지·호환 주소·공개 조회를 확인할 수 있습니다. HTTP/DOM 검증은 실제 브라우저나 실기기 검증을 대신하지 않습니다.

[기능 계약](docs/REQUIREMENTS.md) · [기술 구성](docs/TECH_SPEC.md) · [디자인 시스템](docs/DESIGN.md)
