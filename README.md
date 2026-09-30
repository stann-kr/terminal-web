# terminal-web — STANN OS LIVE

terminal-web is the STANN OS LIVE surface for `https://terminal.stann.kr`.

- Surface role: LIVE
- SYS.ID: TM-02
- Related surfaces:
  - HUB: `https://stann.kr`
  - ARCHIVE: `https://lumo.stann.kr`
  - LIVE: `https://terminal.stann.kr`

## Event experience

`/` and `/home` open the event overview. Event selection prefers live events, then the nearest upcoming event, then the latest past event. Dates and countdowns use Korea Standard Time. Gate and Lineup preserve `?event=`; an artist profile is linked with `/lineup?event=…&artist=…`. An unknown event or artist has an explicit recovery state.

The Aspen interface uses an edge-to-edge black-and-orange grid, a fixed directory and footer, and one scrolling content area. Home combines the event title, session or poster, countdown, introduction, venue and actions. Lineup starts with the first published artist. Request and Signal pair their context and form; Guestbook pairs writing and messages. Narrow screens follow the same content order in one column.

Pixie is reserved for the TERMINAL wordmark; Orbit and monospace faces carry titles, body copy and data. CRT texture and glow cover the entire shell without an outer border. The saved CRT setting, reduced motion, contrast, visibility and data-saving preferences control decorative effects. Content and layout print at the reference cadence; keyboard, pointer, scrolling or input completes the effect immediately. Semantic text and input state remain available.

The optional boot/idle experience is available at `/entry` and from About. The previous `/?experience=terminal` URL redirects there. Browser language is detected when no language has been chosen; the user's explicit choice is remembered.

Events and guestbook entries come from the public API. Guest requests retain server-side event/code/consent checks, and a receipt appears only after an accepted submission. A receipt does not confirm admission. Failed requests preserve drafts; a changed target requires explicit review. Guestbook retries retain idempotency and pagination recovery. The standalone design reference remains under `mockups/aspen-terminal`; its scenario controls and simulated submissions are not part of the product.

## Previous design archive

The complete previous application is preserved under [archives/classic](archives/classic/README.md), including its package lock and original assets. Run it independently, alongside the current application:

```bash
npm run archive:dev -- --port 3006
```

This verifies the frozen snapshot, installs its own dependencies, and prepares its own local development database using bundled public event records. Environment files, subscriptions, guest requests and messages from the current app are not copied. The archive does not depend on the current UI source or deploy anything.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS
- TanStack Query
- Cloudflare OpenNext
- Cloudflare D1 + Drizzle schema
- Docker for local/container workflows

## Local development

Node.js 22 or newer is required.

```bash
npm ci
npm run dev
```

Default dev URL:

```text
http://localhost:3005
```

## Verification

Run these before treating the project as healthy:

```bash
npm audit --omit=dev
npm run db:check-history
npm test
npm run lint
npm run typecheck
npm run build
npm run smoke:http
npm run build:worker
npm run test:d1
npx wrangler deploy --env production --dry-run
```

For Worker HTTP smoke, run `npm run cf:preview` and then run `SMOKE_BASE_URL=http://127.0.0.1:8787 SMOKE_API=1 npm run smoke:http` in another terminal.

`npm run build` intentionally runs `scripts/check-token-sync.mjs` first through the `prebuild` hook. This confirms the local STANN OS token copy at `app/stann-os.css` matches the expected canonical token hash.

`npm ci` applies and verifies the bundled `use-scramble` security patch. The same check runs after a regular `npm install`.

## Cloudflare / OpenNext

Build an environment-specific Cloudflare Worker bundle:

```bash
npm run build:worker:development
npm run build:worker:production
```

Run the development configuration in a local Cloudflare preview:

```bash
npm run cf:preview
```

Deployment targets are explicit:

```bash
npm run deploy:development
npm run deploy:production
```

Cloudflare Workers Builds is the only automatic deployment path. A `dev` push deploys the fixed `terminal-2-dev` Worker and a `main` push deploys the production `terminal-2` Worker. GitHub Actions performs validation only.

Important: production deployment requires separate approval. D1 migrations, secrets, bindings, and routes are not automatically changed by Worker code deployment and must be applied and verified as separate operations.

## D1

Configuration:

- `wrangler.toml`
- `drizzle.config.ts`
- `lib/db/schema.ts`
- `migrations/*.sql`
- `migrations/meta/*.json`
- `scripts/migration-history.lock.json`

D1 binding name:

```text
DB
```

Both remote Workers intentionally use the same `terminal-db` database. Requests, Signal subscriptions, and Transmit posts submitted through development also write to live production data. Remote smoke checks are read-only unless a data write is explicitly approved. Local development and CI use local D1 storage.

The repository history currently contains 10 continuous migrations, `0000` through `0009`. Migration `0009_normalize_transmit_created_at.sql` rebuilds `transmit_logs.created_at` as ISO timestamp `TEXT NOT NULL` after normalizing supported legacy values.

Migration history is append-only. Before validation or generation, the guard requires continuous unique SQL prefixes, exact journal/SQL tags, one snapshot per SQL file with a valid `id`/`prevId` chain, and exact path + SHA-256 matches against the lock:

```bash
npm run db:check-history
```

Generate a schema migration only through the guarded wrapper with an explicit lowercase snake_case name:

```bash
npm run db:generate -- --name add_example_column
```

The wrapper validates the current structure and lock, stages Drizzle output outside the repository, requires the next prefix, permits only the journal update plus one new SQL and snapshot, preserves every existing migration file, and then atomically advances the lock. Do not run `drizzle-kit generate` or `npx drizzle-kit generate` directly. `npm run db:lock-history` is only for creating the initial lock after a complete, reviewed reconciliation; it refuses to replace an existing lock.

Local migration apply example with an explicit environment:

```bash
npx wrangler d1 migrations apply DB --env development --local
```

Development and production resolve to the same remote database and migration history. Inspect the shared target through either environment; apply an approved migration once:

```bash
npx wrangler d1 migrations list DB --env development --remote
npx wrangler d1 migrations list DB --env production --remote
# After approval, apply once to the shared production database:
npx wrangler d1 migrations apply DB --env production --remote
```

Every remote apply is a database write and requires separate approval plus environment-specific preflight and post-apply verification. Worker deployment never applies D1 migrations automatically.

## Public write endpoints

These routes accept public writes and must be protected by validation, body guards, and abuse controls before high-traffic public use:

- `POST /api/gate/request`
- `POST /api/signal`
- `POST /api/transmit`

`POST /api/gate/code-info` and `POST /api/gate/request` require the displayed `eventId` in the JSON body. The server independently selects the eligible event. Missing IDs return `400 EVENT_ID_REQUIRED`; changed targets return `409 EVENT_MISMATCH`; no eligible upcoming event returns `404 NO_UPCOMING_EVENT`. Clients must refresh and review the event before retrying, preserving the draft. Older clients without an event ID must reload.

Current local contracts include exact JSON media-type and streaming byte guards, runtime DTO validation, a Cloudflare rate-limit binding interface, and a server-side Turnstile validator. Broad public launch still requires the real binding/secret, client token flow, and verified Signal unsubscribe/retention operations.

## Documentation

Public project documentation:

- [Documentation overview](docs/README.md)
- [Requirements](docs/REQUIREMENTS.md)
- [Technical specification](docs/TECH_SPEC.md)
- [Change log](docs/CHANGE_LOG.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
