import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

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
export type EventRow = typeof events.$inferSelect;
export type ArtistRow = typeof artists.$inferSelect;
export type TransmitLog = typeof transmitLogs.$inferSelect;
export type NewTransmitLog = typeof transmitLogs.$inferInsert;
export type AccessRequest = typeof accessRequests.$inferSelect;
export type NewAccessRequest = typeof accessRequests.$inferInsert;
export type SignalSubscriber = typeof signal.$inferSelect;
export type NewSignalSubscriber = typeof signal.$inferInsert;
