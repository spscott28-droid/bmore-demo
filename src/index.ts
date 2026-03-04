/**
 * Family Fun in Bmore — Standalone SonicJS App
 *
 * Airbnb-style booking platform for family spaces in Baltimore
 */

import { Hono } from 'hono'
import { createSonicJSApp, registerCollections } from '@sonicjs-cms/core'

// Import custom collections
import venuesCollection from './collections/venues.collection'
import bookingsCollection from './collections/bookings.collection'
import contactsCollection from './collections/contacts.collection'

// Import Family Fun in Bmore routes
import bmoreRoutes from './bmore/routes'

// Register collections (gives admin panel management for venues, bookings & contacts)
registerCollections([venuesCollection, bookingsCollection, contactsCollection])

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
// three collections into the DB on the first request per Worker instance,
// matching the same INSERT format SonicJS uses in its own syncCollections().
// ─────────────────────────────────────────────────────────────────────────────

let collectionsSynced = false

async function ensureCollectionsSynced(db: D1Database): Promise<void> {
  // Confirm migrations have run — bail out if the collections table doesn't exist yet
  try {
    await db.prepare('SELECT 1 FROM collections LIMIT 1').first()
  } catch {
    return
  }

  const configs = [venuesCollection, bookingsCollection, contactsCollection]
  const now = Date.now()

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
