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

---

---

# Session 2 State — March 4, 2026 (superseded by Session 3)

See Session 3 below for current state.

---

# Session 3 State — March 4, 2026

**From**: Cowork session (Windows)
**To**: Next session

## What Was Done This Session

### 1. Port fix
`npm run dev` now explicitly uses `--port 8787`. If 8787 is taken, it errors loudly instead of silently falling back to 8788. Kill port first if needed:
```powershell
for /f "tokens=5" %a in ('netstat -ano ^| findstr :8787') do taskkill /PID %a /F
```

### 2. System user bug fixed (admin role regression)
**Root cause:** `ensureCollectionsSynced` in `src/index.ts` was inserting a system user into the `users` table on the first request. SonicJS uses `SELECT COUNT(*) FROM users` to determine if a registrant is the first user (who gets `admin` role). With the system user pre-inserted, all real users got `viewer` role.

**Fix:** Removed system user INSERT from `ensureCollectionsSynced`. System user is now created on-demand in `routes.ts` via `getAuthorId(db)`, which prefers the first existing admin user's ID, only creating the system user as a last resort if no real admin exists yet.

**For existing installs where Siata already has `viewer` role:**
```powershell
npx wrangler d1 execute DB --local --command "UPDATE users SET role='admin' WHERE email='spscott28@gmail.com'"
```
Then log out and back in at `/auth/login` to refresh the JWT.

### 3. Seed route hardcoded UUID fixed
`GET /seed` was using a hardcoded author UUID instead of `SYSTEM_USER_ID`. Fixed to use `getAuthorId(db)`.

### 4. Pages wired to SonicJS Pages collection
- Added `PageData` interface and `getPageFromDB(db, slug)` helper to `routes.ts`
- Added `GET /seed-pages` route — creates 5 page entries (home, venues, about, contact, book) in the Pages collection with structured editable fields
- All 5 route handlers now fetch their page from DB and pass it to render functions
- All render functions accept `page: PageData | null` with hardcoded fallbacks
- Pages are editable at `/admin/content` → filter by **Pages** model

**To seed pages on a fresh install:** `GET /seed-pages`

**Known issue:** SonicJS's Pages collection schema only shows `title`, `slug`, `meta_description`, `content` in the admin UI. Custom fields (`heroHeading`, `heroSubtext`, etc.) are stored in the `data` JSON blob but don't appear as separate editable fields in admin. Fix: extend the Pages collection schema in `src/collections/` to include all custom fields (not yet done).

### 5. Forms wired to SonicJS form builder
- Added `GET /seed-forms` route — creates two forms in the SonicJS `forms` table:
  - **Contact Form** (`name: contact`) — name, email, subject, message
  - **Venue Booking Wizard** (`name: venue-booking-wizard`) — all booking fields
- Booking wizard submit now POSTs to `/forms/venue-booking-wizard/submit` (SonicJS endpoint)
- Contact form submit now POSTs to `/forms/contact/submit` (SonicJS endpoint)
- Submissions visible at `/admin/forms` → click form → Submissions tab
- Removed old custom `POST /book` and `POST /contact` route handlers

**To seed forms on a fresh install:** `GET /seed-forms`

## Full Seed Checklist (fresh install order)
1. `npm run dev`
2. Visit `/auth/login` → register (first user gets admin)
3. Visit `/seed` → seeds 10 venues
4. Visit `/seed-pages` → seeds 5 CMS pages
5. Visit `/seed-forms` → seeds 2 SonicJS forms
6. Verify at `/admin/content` (venues + pages) and `/admin/forms` (contact + booking wizard)

## Current Route Map

| Route | Handler | Notes |
|-------|---------|-------|
| `GET /` | routes.ts | Fetches page from DB (slug: home) |
| `GET /venues` | routes.ts | Fetches page from DB (slug: venues) |
| `GET /venues/:slug` | routes.ts | Venue detail from DB |
| `GET /book` | routes.ts | Fetches page from DB (slug: book) |
| `GET /about` | routes.ts | Fetches page from DB (slug: about) |
| `GET /contact` | routes.ts | Fetches page from DB (slug: contact) |
| `GET /seed` | routes.ts | Seeds 10 venues (idempotent) |
| `GET /seed-pages` | routes.ts | Seeds 5 CMS pages (idempotent) |
| `GET /seed-forms` | routes.ts | Seeds 2 SonicJS forms (idempotent) |
| `POST /forms/venue-booking-wizard/submit` | SonicJS | Booking wizard submission |
| `POST /forms/contact/submit` | SonicJS | Contact form submission |
| `GET /admin/*` | SonicJS | Admin panel |
| `GET /auth/*` | SonicJS | Authentication |
| `GET /api/*` | SonicJS | REST API |

## Startup Warnings (Non-Blocking, Fine for Local Dev)
```
JWT_SECRET is not set — using hardcoded fallback. Fix: wrangler secret put JWT_SECRET
CORS_ORIGINS is not set — cross-origin API requests will be rejected.
```

## Known Issues / Next Steps
1. **Pages custom fields not visible in admin** — `heroHeading`, `heroSubtext`, etc. are stored in `data` JSON but the Pages collection schema doesn't define them, so admin only shows title/slug/content. Fix: add a custom pages collection in `src/collections/pages.collection.ts` with all the custom fields registered.
2. **Remote deployment** — replace placeholder IDs in `wrangler.toml`, set secrets (`JWT_SECRET`, `CORS_ORIGINS`), run `npm run deploy:preview`
3. **Booking wizard options** — event types, duration options, time slots still hardcoded in `routes.ts`. Future: pull from a CMS collection so they're admin-editable.

---

# Session 4 State — March 4, 2026

**From**: Cowork session (context continuation)
**To**: Next session

## What Was Done

### Pages Collection Schema — Full Implementation

All five public pages now have comprehensive editable fields in the SonicJS admin panel.

#### New file: `src/collections/pages.collection.ts`
Custom `CollectionConfig` that overrides SonicJS's built-in minimal pages schema with ~60 named fields covering every editable content area across all pages:
- **Common**: title, slug, meta_description, pageHeading, pageSubtext
- **Home**: heroHeading, heroSubtext, heroCtaPrimary/Secondary, statVenues/Radius/Capacity/Price (+ labels), howItWorksHeading/Subtext, step1-3 Title/Text, featuredHeading/Subtext, ctaHeading/Subtext/ButtonPrimary/Secondary
- **About**: missionHeading/Text, storyHeading/Text, valueFamilyFirst/Community/Transparent, neighborhoodHeading/Text, teamHeading/Subtext, team1-3 Name/Role/Bio, aboutCtaHeading/Subtext/BtnPrimary/Secondary
- **Contact**: email, phone, hours, faqHeading, faqQ1-4, faqBookingAdvance/Cancellation/Tour/Catering

#### Modified: `src/index.ts`
- Added `import pagesCollection from './collections/pages.collection'`
- Added `pagesCollection` to `registerCollections([...])`
- `ensureCollectionsSynced` now **UPDATEs** the pages collection's schema on every Worker cold start (not just INSERT). This means changes to pages.collection.ts are immediately reflected in admin without manual DB migration.

#### Modified: `src/bmore/routes.ts`
- **PageData interface**: Expanded from 8 fields to ~60 fields matching the schema
- **renderHomePage**: heroHeading, all 4 stats (+ labels), How It Works heading/subtext and all 3 step titles/texts, featuredHeading/Subtext, CTA heading/subtext/button
- **renderAboutPage**: team member names/roles/bios, about CTA heading/subtext/buttons
- **renderContactPage**: faqHeading, all 4 FAQ question labels (faqQ1-4)
- **/seed-pages route**: Changed from INSERT-only to UPSERT (re-running refreshes all field data); all ~60 field values populated with proper defaults
- Response message updated: `{ seeded, updated }` (was `{ seeded, skipped }`)

## How To Activate in Admin

After restarting the dev server, the pages schema auto-syncs on first request. Then:

1. Visit `http://localhost:8787/` (triggers schema UPDATE in DB)
2. Visit `http://localhost:8787/seed-pages` — refreshes all 5 page entries with full field data
3. Visit `http://localhost:8787/admin/content?collection=pages` — you should now see ~60 fields per page

## Key File Map (Updated)

| File | What changed |
|------|-------------|
| `src/collections/pages.collection.ts` | **NEW** — ~60-field schema for all pages |
| `src/index.ts` | Imports pagesCollection, registers it, UPDATEs schema in ensureCollectionsSynced |
| `src/bmore/routes.ts` | PageData interface expanded; render functions wired to all new page fields; /seed-pages upserts with full data |

## Remaining Work

1. **Multi-page wizard form** — the booking form in `/admin/forms` is a flat form, not the 6-step wizard shown on the public site. Formio `wizard` panel layout needs to be configured.
2. **Remote deployment** — replace placeholder IDs in `wrangler.toml`, set `JWT_SECRET` and `CORS_ORIGINS` secrets, run `npm run deploy:preview`
3. **Booking wizard options from CMS** — event types, duration, time slots still hardcoded in `routes.ts`
