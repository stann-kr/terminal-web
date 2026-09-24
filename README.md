# TERMINAL

서울 기반 테크노 플랫폼. 행사 일정과 공연표, 참여 아티스트와 지난 행사 기록을 탐색하고 게스트 신청·소식 신청·방문자 로그를 이용합니다.

## 실행

Node.js 22 이상과 npm을 사용합니다.

```sh
npm ci
npx wrangler login
npm run dev
```

로컬 주소는 http://localhost:3005 입니다. API는 같은 출처의 `/api/*`를 사용하며, `npm run dev`와 `npm start`는 Wrangler의 원격 바인딩으로 운영 D1 `terminal-db`에 연결합니다. 해당 Cloudflare 계정의 접근 권한이 필요합니다. 로컬 화면에서 폼을 제출해도 운영 DB에 저장되므로 연결 확인은 GET 조회로 진행합니다. `.wrangler/state`의 과거 로컬 사본은 미리보기 데이터로 사용하지 않습니다. 조회 실패를 빈 행사로 대체하거나 정적 행사 배열을 운영 데이터로 사용하지 않습니다.

## 화면

- `/`: 대표 행사, 기록 요약, 명령어 터미널
- `/events`, `/events/:eventId`: 예정·진행·지난 행사를 모은 카드 목록과 상세
- `/artists`, `/artists/:artistKey`: 아티스트 명부와 출연 이력
- `/transmit`: 공개 글 작성과 5건 단위 목록
- `/signal`: 행사 소식 수신 연락처 저장
- `/about`: 소개와 공식 채널
- `/events/:eventId/request`: 선택 행사 게스트 신청

기존 `/home`, `/gate`, `/gate/request`, `/lineup`, `/archive`, `/status`, `/link` 주소는 새 화면으로 연결됩니다.

홈의 터미널에서 `help`, `events`, `artists`, `archive`, `ls`, `open <행사 ID>`, `history`, `clear`를 사용할 수 있습니다. 모든 결과는 화면 이동 없이 글자 단위로 빠르게 출력되며 긴 응답은 묶어서 표시합니다. 줄바꿈은 유지합니다. `Esc`로 출력 중인 내용을 즉시 펼칠 수 있습니다. 같은 탭에서는 최근 200개 명령·출력과 입력 중인 문장을 보관해 화면 이동·새로고침 후에도 복원합니다. 위·아래 방향키로 이전 입력을 불러오며, `clear`는 출력 화면만 비우고 명령 기록은 유지합니다.

반복 점멸과 도형 효과는 하단 `FX` 버튼으로 끌 수 있으며, 운영체제의 모션 감소 설정도 따릅니다.

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
