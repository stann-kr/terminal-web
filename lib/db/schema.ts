import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

// ──────────────────────────────────────────────────────────
// events 테이블
// data JSON 예시: { status, date, session, subtitle, venue, district, coords, capacity, sound, ... }
// 필드 추가/삭제 시 마이그레이션 불필요
// ──────────────────────────────────────────────────────────
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),  // 예) "TRM-02"
  data: text("data").notNull(), // JSON string
});

// ──────────────────────────────────────────────────────────
// artists 테이블
// data JSON 예시: { name, origin, dock, time, status, ... }
// ──────────────────────────────────────────────────────────
export const artists = sqliteTable("artists", {
  id: text("id").primaryKey(), // 예) "02-A"
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  data: text("data").notNull(), // JSON string
});

// ──────────────────────────────────────────────────────────
// transmit_logs 테이블 — created_at은 UTC ISO-8601 TEXT NOT NULL 정본
// ──────────────────────────────────────────────────────────
export const transmitLogs = sqliteTable("transmit_logs", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull(),
  message: text("message").notNull(),
  ts: text("ts").notNull(),
  createdAt: text("created_at").notNull(),
  deviceId: text("device_id"),  // 레거시 nullable 컬럼. 신규 입력·공개 응답에서는 사용하지 않음.
  hiddenAt: text("hidden_at"),  // 운영자가 숨긴 시각(UTC ISO). 값이 있으면 공개 목록에서 빠지고 DB에는 남음.
});

// ──────────────────────────────────────────────────────────
// access_requests 테이블 — Gate 게스트 신청
// ──────────────────────────────────────────────────────────
export const accessRequests = sqliteTable(
  "access_requests",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),  // 소식 수신에 동의한 게스트만 남김.
    instagram: text("instagram").notNull(),
    artistId: text("artist_id").references(() => artists.id),
    invitedBy: text("invited_by"),
    privacyConsent: integer("privacy_consent", { mode: "boolean" }).notNull(),
    marketingConsent: integer("marketing_consent", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("access_requests_event_email_idx").on(table.eventId, table.email),
  ],
);

// ──────────────────────────────────────────────────────────
// access_waitlist 테이블 — 초대 코드 정원이 찬 뒤 들어온 신청(이름·인스타그램만)
// 아티스트가 올리면 같은 id로 access_requests에 옮겨지고 여기서 지워진다.
// ──────────────────────────────────────────────────────────
export const accessWaitlist = sqliteTable(
  "access_waitlist",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    artistId: text("artist_id").notNull().references(() => artists.id),
    invitedBy: text("invited_by"),
    name: text("name").notNull(),
    instagram: text("instagram").notNull(),
    privacyConsent: integer("privacy_consent", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("access_waitlist_event_artist_idx").on(table.eventId, table.artistId),
  ],
);

// ──────────────────────────────────────────────────────────
// signal 테이블 — Signal 구독자
// ──────────────────────────────────────────────────────────
export const signal = sqliteTable(
  "signal",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    instagram: text("instagram").notNull(),
    source: text("source").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("signal_email_idx").on(table.email)],
);

// 타입 추론
// ──────────────────────────────────────────────────────────
// submission_traces 테이블 — 공개 입력(Transmit·게스트 신청·Signal)의 접속 기록, 운영자 전용
// IP 원문은 두지 않고 비밀 키 해시만 둔다. 90일 지난 행은 새 기록을 쓸 때 지운다.
// ──────────────────────────────────────────────────────────
export const submissionTraces = sqliteTable(
  "submission_traces",
  {
    kind: text("kind").notNull(), // transmit | gate | signal
    recordId: text("record_id").notNull(),
    createdAt: text("created_at").notNull(),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    asn: integer("asn"),
    asOrg: text("as_org"),
    ipHash: text("ip_hash"),
    browser: text("browser"),
    os: text("os"),
    device: text("device"),
    entryKind: text("entry_kind"), // code | host | ref
    entryArtistId: text("entry_artist_id"),
    entryEventId: text("entry_event_id"),
    entryReferrer: text("entry_referrer"),
    entryAt: text("entry_at"),
    entrySource: text("entry_source"), // ?from= 링크 태그(ig-bio 등)
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.recordId] }),
    index("submission_traces_created_at_idx").on(table.createdAt),
    index("submission_traces_ip_hash_idx").on(table.ipHash),
  ],
);

// ──────────────────────────────────────────────────────────
// link_opens 테이블 — 아티스트 초대 링크가 브라우저에서 열린 횟수(KST 날짜·아티스트·링크 태그별 합계)
// 사람을 가리키는 값은 두지 않는다. 같은 브라우저는 하루에 한 번만 센다(클라이언트 표시).
// ──────────────────────────────────────────────────────────
export const linkOpens = sqliteTable(
  "link_opens",
  {
    day: text("day").notNull(), // KST YYYY-MM-DD
    eventId: text("event_id").notNull(),
    artistId: text("artist_id").notNull(),
    source: text("source").notNull().default(""), // ?from= 태그, 없으면 ''
    opens: integer("opens").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.eventId, table.artistId, table.source] })],
);

export type EventRow = typeof events.$inferSelect;
export type ArtistRow = typeof artists.$inferSelect;
export type TransmitLog = typeof transmitLogs.$inferSelect;
export type NewTransmitLog = typeof transmitLogs.$inferInsert;
export type AccessRequest = typeof accessRequests.$inferSelect;
export type NewAccessRequest = typeof accessRequests.$inferInsert;
export type SignalSubscriber = typeof signal.$inferSelect;
export type NewSignalSubscriber = typeof signal.$inferInsert;

// ──────────────────────────────────────────────────────────
// mail_stats 테이블 — 소식 메일의 열람(이미지 로드)·링크 클릭 수(메일·KST 날짜·종류·대상별 합계)
// 받는 사람을 가리키는 값은 두지 않는다. mail_key는 발송 로그 키(scripts/lib/signalMail mailKey).
// ──────────────────────────────────────────────────────────
export const mailStats = sqliteTable(
  "mail_stats",
  {
    mailKey: text("mail_key").notNull(),
    day: text("day").notNull(), // KST YYYY-MM-DD
    kind: text("kind").notNull(), // 'open' | 'click'
    target: text("target").notNull().default(""), // 클릭한 링크 주소, 열람은 ''
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.mailKey, table.day, table.kind, table.target] })],
);
