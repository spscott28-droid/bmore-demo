# Bmore-Demo Handoff State Document

**Date**: March 3, 2026
**From**: Claude Code session on Linux
**To**: Claude Code session on Windows

---

## What This Project Is

A standalone Airbnb-style venue booking app for Baltimore family event spaces, built on SonicJS CMS. It runs on Cloudflare Workers with a D1 database.

**Origin CMS**: https://github.com/mmcintosh/sonicjs

---

## What Was Done (All Completed)

### 1. Moved public site from `/bmore` to `/`

- `src/index.ts`: Changed `app.route('/bmore', bmoreRoutes)` to `app.route('/', bmoreRoutes)`
- `src/bmore/layout.ts`: All 16 nav/footer links changed from `/bmore/...` to `/...`
- `src/bmore/routes.ts`: All ~25 link references and 2 `fetch()` calls updated

### 2. Wired venue pages to D1 database

In `src/bmore/routes.ts`, added two helper functions:
- `getVenuesFromDB(db)` — queries the `content` table for published venues
- `getVenueBySlug(db, slug)` — queries a single venue by slug

Updated these route handlers to query DB first, fall back to hardcoded `VENUES` array if DB is empty:
- `GET /` (homepage — featured venues)
- `GET /venues` (listing page)
- `GET /venues/:slug` (detail page)
- `GET /book` (booking wizard venue picker)
- `GET /about` (map pins)

### 3. Added seed route

`GET /seed` in `src/bmore/routes.ts`:
- Checks if venues collection exists in DB
- If no venues yet, inserts all 10 from the hardcoded `VENUES` array
- Returns JSON success/already-seeded message
- Idempotent — safe to hit multiple times

### 4. Booking & contact forms now save to D1

- `POST /book` — saves booking as a content item in the `bookings` collection
- `POST /contact` — saves contact submission in the `bookings` collection (with `type: 'contact'` in the data)
- Both generate unique IDs and timestamps

### 5. Environment config

`wrangler.toml` now has:
- **`CACHE_KV`** KV namespace binding (required by SonicJS for caching)
- **`DB`** D1 database binding
- `[env.preview]` section (workers_dev = true)
- `[env.production]` section (workers_dev = false, commented-out custom domain route)

`package.json` scripts added:
- `deploy:preview`, `deploy:production`
- `db:migrate:preview`, `db:migrate:production`

### 6. README rewritten

Full beginner-friendly documentation with Windows/Mac instructions, local setup, Cloudflare deployment, custom domain, admin panel usage, SonicJS update process, troubleshooting.

---

## What Has NOT Been Tested

The code changes were verified via `wrangler deploy --dry-run` (build succeeds, all bindings show correctly), but **no live testing was done**. The following need to be tested on this Windows machine:

1. `npm install` — should succeed
2. `npm run db:migrate:local` — should apply migrations
3. `npm run dev` — server starts (likely on port 8787)
4. Visit `http://localhost:8787/` — homepage loads (may show hardcoded venues initially)
5. Visit `http://localhost:8787/seed` — should seed 10 venues, returns JSON
6. Refresh `http://localhost:8787/` — venues should now come from DB
7. Visit `http://localhost:8787/venues` — venue listing page
8. Visit `http://localhost:8787/venues/st-elizabeth-church-hall` — venue detail
9. Visit `http://localhost:8787/book` — complete booking wizard, submit — should get success JSON
10. Visit `http://localhost:8787/contact` — submit contact form — should save
11. Visit `http://localhost:8787/admin` — register admin account, verify venues/bookings appear
12. Verify `/admin`, `/api/content`, `/auth` still work (no route conflicts with public site)

---

## Known Issues / Things to Watch For

### Route conflict potential
Both `bmoreRoutes` and `coreApp` are mounted at `/`. Hono should match bmore routes first (registered first), with SonicJS catching `/admin`, `/api`, `/auth`. If any bmore routes return 404 unexpectedly, the mounting order in `src/index.ts` may need adjustment.

### Seed route requires collections to exist
`GET /seed` looks up the `venues` collection in the `collections` table. This table is populated by SonicJS when it first boots. If `/seed` returns "Venues collection not found", visit `/admin` first to trigger collection registration, then try `/seed` again.

### `wrangler.toml` placeholder IDs
The file contains placeholder values that must be replaced before remote deployment:
- `database_id = "YOUR_DATABASE_ID_HERE"` — replace after `wrangler d1 create bmore-db`
- `id = "YOUR_KV_NAMESPACE_ID_HERE"` — replace after `wrangler kv namespace create CACHE_KV`

These placeholders are fine for local dev (`npm run dev`).

### D1 types
The code uses `D1Database` type directly (globally available in Cloudflare Workers types). The `@cloudflare/workers-types` dev dependency provides this.

---

## Key File Map

| File | What changed |
|------|-------------|
| `src/index.ts` | Route mounting: `/bmore` → `/` |
| `src/bmore/routes.ts` | D1 helpers, seed route, booking/contact save, link updates |
| `src/bmore/layout.ts` | Nav/footer link updates |
| `src/bmore/venue-data.ts` | Unchanged — seed data source |
| `src/collections/venues.collection.ts` | Unchanged — schema definition |
| `src/collections/bookings.collection.ts` | Unchanged — schema definition |
| `wrangler.toml` | Added CACHE_KV, env.preview, env.production |
| `package.json` | Added deploy/migrate scripts |
| `README.md` | Full rewrite |
| `HANDOFF-STATE.md` | This file |

---

## Architecture Notes

```
Request → Hono Router
           ├── bmoreRoutes (mounted at /)
           │     GET /          → homepage (DB → fallback VENUES)
           │     GET /seed      → seed venues into DB
           │     GET /venues    → listing (DB → fallback)
           │     GET /venues/:slug → detail (DB → fallback)
           │     GET /book      → booking wizard
           │     POST /book     → save booking to D1
           │     GET /about     → about page
           │     GET /contact   → contact page
           │     POST /contact  → save contact to D1
           │
           └── coreApp (SonicJS, mounted at /)
                 /admin/*       → admin panel
                 /api/*         → REST API
                 /auth/*        → authentication
```

**Database**: All content (venues, bookings, contacts) lives in the `content` table, keyed by `collection_id`. SonicJS manages the schema via migrations in `node_modules/@sonicjs-cms/core/migrations/`.

**Caching**: SonicJS uses a three-tier cache: Memory → KV (`CACHE_KV`) → D1. The KV binding is required.

---

## For the New Claude Code Session

If picking up this work, the immediate next step is:

1. Run the test checklist above (items 1-12)
2. Fix any route conflicts or issues that surface
3. If deploying to Cloudflare, replace the placeholder IDs in `wrangler.toml`
