# 로컬 문제 해결

## API가 500을 반환할 때

이 checkout의 local D1을 준비했는지 확인합니다. `npx wrangler d1 migrations apply terminal-db --local`은 로컬에만 적용합니다. 필요한 공개 행사 데이터도 local DB에 준비해야 합니다. 운영 DB로 자동 전환하거나 실패를 빈 배열로 덮지 않습니다.

## 3005가 사용 중일 때

`lsof -nP -iTCP:3005 -sTCP:LISTEN`으로 소유 process와 checkout을 확인합니다. 다른 작업의 서버를 임의 종료하지 않습니다.

## token 또는 patch 검증 실패

`app/stann-os.css`, `patches/`, verifier를 임의 수정해 통과시키지 않습니다. lockfile로 `npm ci`를 실행하고 실제 변경 원인을 확인합니다.

## 게스트 신청이 닫혀 있을 때

현재 서버의 가장 가까운 미래 UPCOMING 행사인지, 시작 30일 전부터 시작 직전인지 확인합니다. 과거 행사는 기록으로 제공됩니다. 코드 확인 성공만으로 접수 기간이 열리는 것은 아닙니다.

## 아티스트가 같은 이름으로 여러 번 보일 때

출연 행 ID는 인물 ID가 아닙니다. 출연 연결이 확인된 경우에만 `features/artists/identities.ts`에 안정적인 key와 eventId/artistRowId를 등록합니다.
