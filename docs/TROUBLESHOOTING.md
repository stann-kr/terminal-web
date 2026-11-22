# 로컬 문제 해결

## API가 500을 반환할 때

`npm run dev`와 `npm start`는 local D1이 아니라 Wrangler 원격 바인딩으로 운영 D1 `terminal-db`를 읽습니다(`wrangler.toml`의 `remote = true`, `next.config.ts`의 `remoteBindings`). 먼저 `npx wrangler whoami`로 로그인 상태와 계정을 확인하고, 로그인이 없거나 만료됐으면 `npx wrangler login`을 다시 실행합니다. 그 계정에 해당 D1·R2 접근 권한이 있는지, `CLOUDFLARE_API_TOKEN` 같은 환경 변수가 권한이 다른 token으로 로그인을 대신하고 있지 않은지도 확인합니다. 서버 터미널의 오류 메시지로 원인을 확인하며, `.wrangler/state`의 로컬 사본이나 local migration 적용으로 대신하지 않고 실패를 빈 배열로 덮지 않습니다. CI(`CI`·`WORKERS_CI`)에서는 원격 바인딩 대신 local D1 시뮬레이션을 씁니다.

## 3005가 사용 중일 때

`lsof -nP -iTCP:3005 -sTCP:LISTEN`으로 소유 process와 checkout을 확인합니다. 다른 작업의 서버를 임의 종료하지 않습니다.

## token 또는 patch 검증 실패

`app/stann-os.css`, `patches/`, verifier를 임의 수정해 통과시키지 않습니다. lockfile로 `npm ci`를 실행하고 실제 변경 원인을 확인합니다.

## 게스트 신청이 닫혀 있을 때

현재 서버의 가장 가까운 미래 UPCOMING 행사인지, 시작 30일 전(행사 데이터에 `accessWindowDays`가 있으면 그 일수)부터 시작 직전인지 확인합니다. 과거 행사는 기록으로 제공됩니다. 코드 확인 성공만으로 접수 기간이 열리는 것은 아닙니다.

## 아티스트가 같은 이름으로 여러 번 보일 때

출연 행 ID는 인물 ID가 아닙니다. 출연 연결이 확인된 경우에만 `features/artists/identities.ts`에 안정적인 key와 eventId/artistRowId를 등록합니다.

## 방문자 로그에 내려야 할 글이 올라왔을 때

`npm run transmit:remove -- list 20 --remote`로 최근 글의 ID를 찾습니다. 글을 지우지 않고 공개 목록에서만 빼려면 `npm run transmit:remove -- hide <ID> --remote --confirm <ID>`로 숨깁니다. 숨긴 글은 DB에 남고 `list`에 `[hidden]`으로 표시되며, `unhide`로 다시 보이게 합니다(`--confirm` 없이는 계획만 출력). `npm run transmit:remove -- remove <ID> --remote`는 그 글과 할 일만 보여 주고 아무것도 지우지 않으며, 대상 ID를 확인한 뒤 `npm run transmit:remove -- remove <ID> --remote --confirm <ID>`로 내립니다. 지우기 전에 글 전체를 git이 무시하는 `backups/transmit/`에 백업하며, `npm run transmit:remove -- restore <백업 파일> --remote --confirm <ID>`로 그대로 되돌릴 수 있습니다(`--confirm` 없이는 계획만 출력). 백업은 가져온 곳(운영 또는 로컬)으로만 되돌리며, 다르면 거부합니다. 실행 도중 실패하면 메시지에 백업 경로가 함께 나오므로 `list`로 상태를 확인한 뒤 진행합니다. `--remote`를 빼면 로컬 시뮬레이션에서 확인 없이 동작합니다.

## 공개 입력을 누가 어디서 남겼는지 볼 때

Transmit 글·게스트 신청(대기 포함)·Signal 구독이 저장되면 운영자 전용 `submission_traces`에 한 줄이 남습니다. 칸은 접속 국가·지역·도시·통신사(ASN), IP의 비밀 키 해시(`ip_hash`, 원문 IP는 저장하지 않음), 브라우저·OS·기기, 그리고 유입 쿠키(`tw_entry`, 30일)에서 읽은 유입 경로입니다. 유입은 아티스트 코드 링크(`entry_kind = code`, 코드를 아티스트 id로 풀어 `entry_artist_id`), 호스트 페이지(`host`, 링크의 `t`는 저장하지 않음), 외부 사이트(`ref`, `entry_referrer`)입니다. 링크 끝의 `?from=<태그>`(소문자·숫자·`-`·`_`, 32자까지, 예: `ig-bio`, `ig-story`)는 어느 유입에든 붙어 `entry_source`에 남고, QR 스티커(`/q`)는 홈을 `?from=qr`로 엽니다. 아티스트 링크·호스트 페이지 방문은 저장된 유입을 바꾸고, 태그 링크는 외부 사이트나 다른 태그만 바꾸며, 태그 없는 외부 사이트는 비어 있을 때만 채웁니다.

```
npx wrangler d1 execute terminal-db --remote --command "SELECT * FROM submission_traces WHERE record_id = '<글·신청·구독 id>'"
npx wrangler d1 execute terminal-db --remote --command "SELECT kind, record_id, created_at, city, browser FROM submission_traces WHERE ip_hash = '<ip_hash>' ORDER BY created_at"
```

`ip_hash`는 Worker secret `TRACE_HASH_SECRET`이 있을 때만 채워지며, 같은 키 아래에서 같은 주소(IPv6는 /64)는 같은 값입니다. 키를 바꾸면 이전 기록과 묶이지 않습니다. 90일 지난 행은 새 기록을 쓸 때 함께 지워지므로 한동안 입력이 없으면 남아 있을 수 있습니다. Signal 수신 거부는 그 구독의 기록도 지웁니다. 아티스트가 호스트 페이지에서 직접 올린 게스트는 기록하지 않습니다.

## 아티스트 링크가 몇 번 열리고 몇 명이 신청했는지 볼 때

초대 링크(`/events/<id>/request?invite=<코드>`)를 브라우저가 열어 코드가 확인되면 `link_opens`에 KST 날짜·아티스트·태그(`source`, 없으면 빈 값)별로 1이 더해집니다. 같은 브라우저는 같은 코드를 하루 한 번만 셉니다(localStorage). 미리보기 크롤러는 스크립트를 돌리지 않아 세지 않습니다. 사람을 가리키는 값은 두지 않습니다. 코드를 직접 입력한 확인은 세지 않습니다.

```
npx wrangler d1 execute terminal-db --remote --env production --command "SELECT o.artist_id, SUM(o.opens) AS opens, (SELECT COUNT(*) FROM access_requests r WHERE r.event_id = o.event_id AND r.artist_id = o.artist_id) AS requests FROM link_opens o WHERE o.event_id = 'TRM-03' GROUP BY o.artist_id ORDER BY opens DESC"
npx wrangler d1 execute terminal-db --remote --env production --command "SELECT day, artist_id, source, opens FROM link_opens WHERE event_id = 'TRM-03' ORDER BY day DESC, opens DESC"
npx wrangler d1 execute terminal-db --remote --env production --command "SELECT entry_source, kind, COUNT(*) FROM submission_traces WHERE entry_source IS NOT NULL GROUP BY 1, 2"
```

`requests`는 링크를 열지 않고 코드를 입력한 신청까지 포함하므로 열람 수와 1:1 비율이 아닙니다. 링크 열람 수는 이 기능이 배포된 날부터 셉니다.

## 요청이 많다는 안내(429)가 뜰 때

쓰기 API 네 곳은 접속 IP·작업마다 60초에 20회까지 받습니다(`wrangler.toml`의 `PUBLIC_RATE_LIMITER`). 같은 와이파이·통신사 주소를 여럿이 함께 쓰면 일찍 걸릴 수 있으므로, 현장에서 자주 보이면 `limit`를 올려 다시 배포합니다.

## 이벤트가 시작하자마자 기록으로 넘어갈 때

끝 시각을 알 수 없는 이벤트는 시작과 함께 기록이 됩니다. 이벤트 데이터에 `endTime`(`HH:MM`, KST)을 넣거나 공개 공연표의 모든 슬롯에 `HH:MM - HH:MM` 시간을 넣으면 그 끝까지 진행 중으로 보입니다.
