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

// Import Family Fun in Bmore routes
import bmoreRoutes from './bmore/routes'

// Register collections (gives admin panel management for venues & bookings)
registerCollections([venuesCollection, bookingsCollection])

// Create the core SonicJS app (admin panel at /admin)
const coreApp = createSonicJSApp()

// Create main app
const app = new Hono()

// Mount Family Fun in Bmore demo site
app.route('/bmore', bmoreRoutes)

// Mount core app last (catch-all for admin, API, auth, etc.)
app.route('/', coreApp)

export default app
