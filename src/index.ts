/**
 * Family Fun in Bmore — Standalone SonicJS App
 *
 * Airbnb-style booking platform for family spaces in Baltimore
 */

import { Hono } from 'hono'
import { createSonicJSApp, registerCollections } from '@sonicjs-cms/core'

// Import custom collections
import venuesCollection from './collections/venues.collection'
import pagesCollection from './collections/pages.collection'

// Import Family Fun in Bmore routes
import bmoreRoutes from './bmore/routes'

// Register collections (gives admin panel management for venues & pages)
// NOTE: Bookings and contacts are handled via SonicJS Forms (not collections),
// so their submissions appear under Forms > Venue Booking Wizard / Contact Form.
registerCollections([venuesCollection, pagesCollection])

// Create the core SonicJS app (admin panel at /admin)
const coreApp = createSonicJSApp()

// Create main app
const app = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION SYNC MIDDLEWARE
//
// SonicJS stores registerCollections() configs in memory only. The admin panel
// reads from the DB `collections` table, so collections not in that table are
// invisible to admin and can't receive POST data. This middleware upserts all
// custom collections into the DB on the first request per Worker instance,
// matching the same INSERT format SonicJS uses in its own syncCollections().
//
// For the `pages` collection we also UPDATE the schema on every cold start so
// that changes to pages.collection.ts are immediately reflected in the admin UI
// without needing a manual DB migration.
//
// NOTE: We intentionally do NOT create a system user here. SonicJS determines
// whether a registering user is the first admin by counting rows in the users
// table — if we pre-insert a system user, the first real user gets 'viewer'
// instead of 'admin'. System user creation is deferred to routes.ts and only
// happens on-demand when an anonymous submission arrives with no admin present.
// ─────────────────────────────────────────────────────────────────────────────

let collectionsSynced = false

async function ensureCollectionsSynced(db: D1Database): Promise<void> {
  // Confirm migrations have run — bail out if the collections table doesn't exist yet
  try {
    await db.prepare('SELECT 1 FROM collections LIMIT 1').first()
  } catch {
    return
  }

  const now = Date.now()

  const configs = [venuesCollection]

  // INSERT-only collections (never overwrite once created)
  for (const col of configs) {
    const exists = await db
      .prepare('SELECT id FROM collections WHERE name = ?')
      .bind(col.name)
      .first<{ id: string }>()

    if (!exists) {
      await db
        .prepare(
          `INSERT INTO collections (id, name, display_name, description, schema, is_active, managed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `col-${col.name}-${crypto.randomUUID().slice(0, 8)}`,
          col.name,
          col.displayName,
          col.description ?? null,
          JSON.stringify(col.schema),
          1,
          col.managed ? 1 : 0,
          now,
          now
        )
        .run()
    }
  }

  // Pages collection: INSERT if absent, or UPDATE schema/display so admin always
  // reflects the latest field definitions from pages.collection.ts
  const pagesExists = await db
    .prepare('SELECT id FROM collections WHERE name = ?')
    .bind(pagesCollection.name)
    .first<{ id: string }>()

  if (!pagesExists) {
    await db
      .prepare(
        `INSERT INTO collections (id, name, display_name, description, schema, is_active, managed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `col-${pagesCollection.name}-${crypto.randomUUID().slice(0, 8)}`,
        pagesCollection.name,
        pagesCollection.displayName,
        pagesCollection.description ?? null,
        JSON.stringify(pagesCollection.schema),
        1,
        pagesCollection.managed ? 1 : 0,
        now,
        now
      )
      .run()
  } else {
    // Always keep the schema in sync so admin shows the latest fields
    await db
      .prepare(
        `UPDATE collections
         SET schema = ?, display_name = ?, description = ?, is_active = 1, updated_at = ?
         WHERE name = ?`
      )
      .bind(
        JSON.stringify(pagesCollection.schema),
        pagesCollection.displayName,
        pagesCollection.description ?? null,
        now,
        pagesCollection.name
      )
      .run()
  }
}

app.use('*', async (c, next) => {
  if (!collectionsSynced) {
    try {
      await ensureCollectionsSynced((c.env as { DB: D1Database }).DB)
      collectionsSynced = true
    } catch {
      // Don't block requests if sync fails (e.g. during cold start before migrations)
    }
  }
  await next()
})

// Redirect /admin and /admin/ to /admin/dashboard
app.get('/admin', (c) => c.redirect('/admin/dashboard'))
app.get('/admin/', (c) => c.redirect('/admin/dashboard'))

// Mount Family Fun in Bmore public site at root
app.route('/', bmoreRoutes)

// Mount core app last (catch-all for admin, API, auth, etc.)
app.route('/', coreApp)

export default app
