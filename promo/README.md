# Promo kit

웹사이트와 같은 팔레트·폰트·플레이트·링 모티프로 만드는 포스터와 모션 그래픽입니다. 색은 `app/palettes.css`, 표면과 폰트는 `app/globals.css`를 그대로 읽습니다.

## 구성

| 종류 | 포스터 | 모션 |
| --- | --- | --- |
| 티저 | 3:4 | 3:4, 9:16 |
| 아티스트 공개(아티스트별) | 3:4 | 3:4 |
| 라인업 공개 | 3:4 | 3:4, 9:16 |
| 메인 | A2, 3:4 | 3:4, 9:16 |

아티스트 공개·라인업 공개는 `artists`가 비어 있으면 내보내지 않고, 미리보기의 Templates에서 샘플 이름으로만 보여 줍니다(`node promo/export.mjs templates`로 PNG 확인). 메인은 그동안 "Lineup To be announced"를 표시합니다.

3:4는 1080×1440(인스타그램 세로 피드), 9:16은 1080×1920(스토리·릴스), A2는 420×594mm입니다. 모든 조각은 하나의 컴포지션이고, 포스터는 모션이 완성된 프레임입니다.

## 사용

```sh
npm run promo          # 미리보기: http://<host>:3007
npm run promo:export   # promo/out/ 에 PNG·PDF·MP4 생성
node promo/export.mjs posters --only main   # 일부만
```

- 회차 정보는 `promo/data.js` 한 곳만 고칩니다(운영 DB의 이벤트 정보와 맞춰 둡니다). 포스터에는 최소 이벤트 정보만 두고 소개글은 게시물 캡션에 씁니다. `signal.period`는 모션의 링·펄스 박자(초)입니다. 팔레트는 같은 파일의 `palette`, 또는 미리보기 주소에 `&palette=terminal-night`.
- 단일 조각: `poster.html?piece=teaser|artist|lineup|main&format=feed|story|a2` (`&artist=<id>`, `&play`).
- 내보내기는 로컬 Chrome(또는 Playwright의 `chrome-headless-shell`, `CHROME_PATH`로 지정 가능)과 `ffmpeg`가 필요합니다. A2는 벡터 PDF와 300dpi PNG로 나옵니다.
- 이름·제목이 판을 넘치면 내보내기 중 `content overflows` 경고가 나옵니다.
