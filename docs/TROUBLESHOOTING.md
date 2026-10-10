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

## 방문자 로그에 내려야 할 글이 올라왔을 때

`npm run transmit:remove -- list 20 --remote`로 최근 글의 ID를 찾고, `npm run transmit:remove -- remove <ID> --remote`로 내립니다. 지우기 전에 글 전체를 git이 무시하는 `backups/transmit/`에 백업하며, `npm run transmit:remove -- restore <백업 파일> --remote`로 그대로 되돌릴 수 있습니다. `--remote`는 운영 DB이므로 대상 ID를 확인한 뒤 실행합니다. 빼면 로컬 시뮬레이션에서 동작합니다.

## 요청이 많다는 안내(429)가 뜰 때

쓰기 API 네 곳은 접속 IP·작업마다 60초에 20회까지 받습니다(`wrangler.toml`의 `PUBLIC_RATE_LIMITER`). 같은 와이파이·통신사 주소를 여럿이 함께 쓰면 일찍 걸릴 수 있으므로, 현장에서 자주 보이면 `limit`를 올려 다시 배포합니다.

## 이벤트가 시작하자마자 기록으로 넘어갈 때

끝 시각을 알 수 없는 이벤트는 시작과 함께 기록이 됩니다. 이벤트 데이터에 `endTime`(`HH:MM`, KST)을 넣거나 공개 공연표의 모든 슬롯에 `HH:MM - HH:MM` 시간을 넣으면 그 끝까지 진행 중으로 보입니다.
