/**
 * Family Fun in Bmore — All Routes
 *
 * Airbnb-style booking platform for family spaces in Baltimore
 * Churches, rec centers, and community spaces near Patterson Park
 */

import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { bmoreLayout } from './layout'
import { VENUES, EVENT_TYPES, VENUE_TYPE_LABELS, ALCOHOL_LABELS } from './venue-data'
import type { VenueData } from './venue-data'

const bmore = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// D1 DATABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getVenuesFromDB(db: D1Database): Promise<VenueData[]> {
  try {
    const col = await db.prepare(
      "SELECT id FROM collections WHERE name = ? AND is_active = 1"
    ).bind("venues").first<{ id: string }>()
    if (!col) return []

    const { results } = await db.prepare(
      "SELECT * FROM content WHERE collection_id = ? AND status = 'published'"
    ).bind(col.id).all()

    // Collection exists but has no venues — auto-seed from hardcoded data
    if (results.length === 0) {
      const now = Date.now()
      for (const venue of VENUES) {
        await db.prepare(
          `INSERT INTO content (id, collection_id, slug, title, data, status, author_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), col.id, venue.slug, venue.title,
          JSON.stringify(venue), 'published', 'system', now, now
        ).run()
      }
      return VENUES
    }

    return results.map(row => ({
      ...JSON.parse(row.data as string),
      title: row.title as string,
      slug: row.slug as string,
    }))
  } catch {
    return []
  }
}

async function getVenueBySlug(db: D1Database, slug: string): Promise<VenueData | null> {
  try {
    const col = await db.prepare(
      "SELECT id FROM collections WHERE name = ? AND is_active = 1"
    ).bind("venues").first<{ id: string }>()

    if (!col) {
      // DB not initialised yet (migrations not run) — graceful degradation
      return VENUES.find(v => v.slug === slug) ?? null
    }

    const row = await db.prepare(
      "SELECT * FROM content WHERE collection_id = ? AND slug = ?"
    ).bind(col.id, slug).first()
    if (!row) return null  // Collection is in DB but this slug isn't → 404

    return { ...JSON.parse(row.data as string), title: row.title as string, slug: row.slug as string }
  } catch {
    return VENUES.find(v => v.slug === slug) ?? null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED ROUTE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/seed', async (c) => {
  const db = c.env.DB
  const col = await db.prepare(
    "SELECT id FROM collections WHERE name = ? AND is_active = 1"
  ).bind("venues").first<{ id: string }>()

  if (!col) return c.json({ error: 'Venues collection not found. Run migrations first and make sure the admin panel has been visited at least once.' }, 500)

  // Check if already seeded
  const existing = await db.prepare(
    "SELECT COUNT(*) as count FROM content WHERE collection_id = ?"
  ).bind(col.id).first<{ count: number }>()

  if (existing && existing.count > 0) {
    return c.json({ message: `Already seeded (${existing.count} venues exist)` })
  }

  // Insert all venues
  for (const venue of VENUES) {
    const id = crypto.randomUUID()
    const now = Date.now()
    await db.prepare(`
      INSERT INTO content (id, collection_id, slug, title, data, status, author_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, col.id, venue.slug, venue.title, JSON.stringify(venue), 'published', '6b27b79e-9936-47a7-936e-7ec8aab43ac9', now, now).run()
  }

  return c.json({ success: true, message: `Seeded ${VENUES.length} venues` })
})

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/', async (c) => {
  let venues = await getVenuesFromDB(c.env.DB)
  if (venues.length === 0) venues = VENUES
  const featured = venues.slice(0, 6)
  return c.html(bmoreLayout('Home', renderHomePage(featured, venues), { activeNav: 'home' }))
})

function renderHomePage(featured: VenueData[], allVenues: VenueData[] = VENUES) {
  return html`
    <!-- Hero Section -->
    <section class="relative overflow-hidden">
      <div class="hero-gradient">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div class="text-white">
              <h1 class="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Your Family's<br>
                <span class="text-orange-200">Perfect Space</span><br>
                Awaits in Baltimore
              </h1>
              <p class="text-orange-100 text-lg md:text-xl mb-8 leading-relaxed">
                Book beautiful churches, recreation centers, and community spaces
                for your next celebration — all within 5 miles of Patterson Park.
              </p>
              <div class="flex flex-col sm:flex-row gap-4">
                <a href="/book" class="inline-flex items-center justify-center px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg text-lg">
                  Book a Space
                  <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </a>
                <a href="/venues" class="inline-flex items-center justify-center px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-lg">
                  Browse Venues
                </a>
              </div>
            </div>
            <div class="hidden md:block">
              <div class="relative">
                <img src="https://images.unsplash.com/photo-1529543544282-ea57407bc2f7?w=600&h=500&fit=crop" alt="Baltimore community gathering" class="rounded-2xl shadow-2xl w-full object-cover" style="max-height:500px" />
                <div class="absolute -bottom-4 -left-4 bg-white rounded-xl p-4 shadow-lg">
                  <div class="flex items-center gap-3">
                    <span class="text-3xl">🏛️</span>
                    <div>
                      <p class="font-bold text-gray-900">10+ Venues</p>
                      <p class="text-gray-500 text-sm">Near Patterson Park</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Bar -->
    <section class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p class="font-display text-3xl font-bold text-orange-500">10+</p>
            <p class="text-gray-500 text-sm mt-1">Vetted Venues</p>
          </div>
          <div>
            <p class="font-display text-3xl font-bold text-teal-600">5 mi</p>
            <p class="text-gray-500 text-sm mt-1">Patterson Park Radius</p>
          </div>
          <div>
            <p class="font-display text-3xl font-bold text-orange-500">250</p>
            <p class="text-gray-500 text-sm mt-1">Max Capacity</p>
          </div>
          <div>
            <p class="font-display text-3xl font-bold text-teal-600">$35</p>
            <p class="text-gray-500 text-sm mt-1">Starting Per Hour</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="font-display text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p class="text-gray-500 text-lg max-w-2xl mx-auto">Book your perfect family space in three easy steps</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">📝</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-2">1. Tell Us Your Needs</h3>
            <p class="text-gray-500">Share your event details — guest count, kitchen needs, duration, and more. We'll match you with the perfect spaces.</p>
          </div>
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🗺️</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-2">2. Choose Your Venue</h3>
            <p class="text-gray-500">Browse available spaces on a map, compare amenities and pricing, and select the one that fits your family best.</p>
          </div>
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🎉</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-2">3. Book & Celebrate</h3>
            <p class="text-gray-500">Pick your date and time, confirm your booking, and get ready for an amazing family gathering!</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Venues -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="font-display text-3xl font-bold text-gray-900 mb-2">Featured Venues</h2>
            <p class="text-gray-500">Hand-picked spaces perfect for your next family event</p>
          </div>
          <a href="/venues" class="hidden sm:inline-flex items-center text-orange-500 font-semibold hover:text-orange-600">
            View All
            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${featured.map(v => renderVenueCard(v))}
        </div>
        <div class="text-center mt-8 sm:hidden">
          <a href="/venues" class="inline-flex items-center text-orange-500 font-semibold hover:text-orange-600">
            View All Venues
            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    </section>

    <!-- Event Types -->
    <section class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="font-display text-3xl font-bold text-gray-900 mb-4">Spaces for Every Occasion</h2>
          <p class="text-gray-500 text-lg max-w-2xl mx-auto">From birthday parties to family reunions, we've got the perfect space for your event</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          ${EVENT_TYPES.slice(0, 5).map(et => html`
            <a href="/book?eventType=${et.value}" class="bg-gray-50 rounded-xl p-6 text-center card-hover hover:bg-orange-50 transition-colors">
              <span class="text-4xl block mb-3">${et.icon}</span>
              <p class="font-semibold text-gray-800 text-sm">${et.label}</p>
            </a>
          `)}
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 max-w-3xl mx-auto">
          ${EVENT_TYPES.slice(5).map(et => html`
            <a href="/book?eventType=${et.value}" class="bg-gray-50 rounded-xl p-6 text-center card-hover hover:bg-orange-50 transition-colors">
              <span class="text-4xl block mb-3">${et.icon}</span>
              <p class="font-semibold text-gray-800 text-sm">${et.label}</p>
            </a>
          `)}
        </div>
      </div>
    </section>

    <!-- Map Preview -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-8">
          <h2 class="font-display text-3xl font-bold text-gray-900 mb-4">All Near Patterson Park</h2>
          <p class="text-gray-500 text-lg">Every venue is within a 5-mile radius of Baltimore's beloved Patterson Park</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div id="home-map" style="height:400px;width:100%;"></div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-16 hero-gradient">
      <div class="max-w-4xl mx-auto px-4 text-center text-white">
        <h2 class="font-display text-3xl md:text-4xl font-bold mb-4">Ready to Plan Your Event?</h2>
        <p class="text-orange-100 text-lg mb-8 max-w-2xl mx-auto">Our booking wizard makes it easy to find and reserve the perfect space for your family gathering.</p>
        <a href="/book" class="inline-flex items-center px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg text-lg">
          Start Booking Now
        </a>
      </div>
    </section>

    <!-- Home Map Script -->
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const mapEl = document.getElementById('home-map');
        if (!mapEl) return;
        const map = L.map('home-map').setView([39.2890, -76.5700], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Patterson Park marker
        L.marker([39.2918, -76.5716], {
          icon: L.divIcon({ className: '', html: '<div style="background:#14b8a6;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;">🌳</div>', iconSize: [24,24], iconAnchor: [12,12] })
        }).addTo(map).bindPopup('<b>Patterson Park</b><br>The heart of our neighborhood');

        const venues = ${raw(JSON.stringify(allVenues.map(v => ({ title: v.title, lat: v.latitude, lng: v.longitude, slug: v.slug, type: v.venueType, rate: v.hourlyRate }))))};
        venues.forEach(v => {
          L.marker([v.lat, v.lng], {
            icon: L.divIcon({ className: '', html: '<div class="venue-pin"></div>', iconSize: [20,20], iconAnchor: [10,10] })
          }).addTo(map).bindPopup('<b>' + v.title + '</b><br>From $' + v.rate + '/hr<br><a href="/venues/' + v.slug + '" style="color:#f97316;">View Details &rarr;</a>');
        });
      });
    </script>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// VENUE CARD (shared component)
// ─────────────────────────────────────────────────────────────────────────────

function renderVenueCard(v: VenueData) {
  const typeLabel = VENUE_TYPE_LABELS[v.venueType] || v.venueType
  const typeColor: Record<string, string> = {
    church: 'bg-purple-100 text-purple-700',
    rec_center: 'bg-blue-100 text-blue-700',
    community_center: 'bg-teal-100 text-teal-700',
    library: 'bg-amber-100 text-amber-700',
    school: 'bg-emerald-100 text-emerald-700',
  }

  return html`
    <a href="/venues/${v.slug}" class="bg-white rounded-xl overflow-hidden shadow-sm card-hover block">
      <div class="relative">
        <img src="${v.imageUrl}" alt="${v.title}" class="w-full h-48 object-cover" loading="lazy" />
        <span class="absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-semibold ${typeColor[v.venueType] || 'bg-gray-100 text-gray-700'}">
          ${typeLabel}
        </span>
        <span class="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-semibold text-gray-700">
          ${v.distanceFromPark} mi
        </span>
      </div>
      <div class="p-4">
        <h3 class="font-semibold text-gray-900 mb-1">${v.title}</h3>
        <p class="text-gray-500 text-sm mb-3">${v.neighborhood} &middot; Up to ${v.capacity} guests</p>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 text-xs text-gray-500">
            ${v.hasKitchen ? html`<span title="Kitchen">🍳</span>` : ''}
            ${v.hasGymnasium ? html`<span title="Gymnasium">🏀</span>` : ''}
            ${v.alcoholPolicy !== 'none' ? html`<span title="${ALCOHOL_LABELS[v.alcoholPolicy]}">🍷</span>` : ''}
            ${v.adaAccessible ? html`<span title="ADA Accessible">♿</span>` : ''}
          </div>
          <p class="font-bold text-orange-600">$${v.hourlyRate}<span class="text-gray-400 font-normal text-sm">/hr</span></p>
        </div>
      </div>
    </a>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// VENUES LISTING PAGE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/venues', async (c) => {
  let allVenues = await getVenuesFromDB(c.env.DB)
  if (allVenues.length === 0) allVenues = VENUES
  const typeFilter = c.req.query('type') || ''
  const venues = typeFilter ? allVenues.filter(v => v.venueType === typeFilter) : allVenues
  return c.html(bmoreLayout('Venues', renderVenuesPage(venues, typeFilter, allVenues), { activeNav: 'venues' }))
})

function renderVenuesPage(venues: VenueData[], typeFilter: string, allVenuesForMap: VenueData[] = VENUES) {
  const types = [
    { value: '', label: 'All Venues' },
    { value: 'church', label: 'Church Halls' },
    { value: 'rec_center', label: 'Recreation Centers' },
    { value: 'community_center', label: 'Community Centers' },
    { value: 'library', label: 'Libraries' },
    { value: 'school', label: 'Schools' },
  ]

  return html`
    <!-- Header -->
    <section class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="font-display text-3xl font-bold text-gray-900 mb-2">Browse Venues</h1>
        <p class="text-gray-500 text-lg">Find the perfect family-friendly space near Patterson Park</p>

        <!-- Filters -->
        <div class="flex flex-wrap gap-2 mt-6">
          ${types.map(t => html`
            <a href="/venues${t.value ? '?type=' + t.value : ''}"
               class="px-4 py-2 rounded-full text-sm font-medium transition-colors
                      ${typeFilter === t.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
              ${t.label}
            </a>
          `)}
        </div>
      </div>
    </section>

    <!-- Venue Grid + Map -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Venue List -->
        <div class="lg:col-span-2">
          <p class="text-gray-500 mb-4">${venues.length} venue${venues.length !== 1 ? 's' : ''} found</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${venues.map(v => renderVenueCard(v))}
          </div>
        </div>

        <!-- Sidebar Map -->
        <div class="lg:col-span-1">
          <div class="sticky top-20">
            <div class="bg-white rounded-xl shadow-sm overflow-hidden">
              <div id="venues-map" style="height:500px;width:100%;"></div>
            </div>
            <div class="mt-4 bg-orange-50 rounded-xl p-4">
              <h4 class="font-semibold text-gray-900 mb-2">Need help choosing?</h4>
              <p class="text-gray-600 text-sm mb-3">Our booking wizard matches you with venues based on your event needs.</p>
              <a href="/book" class="inline-flex items-center text-orange-600 font-semibold text-sm hover:text-orange-700">
                Start Booking Wizard
                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const map = L.map('venues-map').setView([39.2890, -76.5700], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OSM'
        }).addTo(map);

        L.marker([39.2918, -76.5716], {
          icon: L.divIcon({ className: '', html: '<div style="background:#14b8a6;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;">🌳</div>', iconSize: [24,24], iconAnchor: [12,12] })
        }).addTo(map).bindPopup('<b>Patterson Park</b>');

        const venues = ${raw(JSON.stringify(allVenuesForMap.map(v => ({ title: v.title, lat: v.latitude, lng: v.longitude, slug: v.slug, rate: v.hourlyRate }))))};
        venues.forEach(v => {
          L.marker([v.lat, v.lng], {
            icon: L.divIcon({ className: '', html: '<div class="venue-pin"></div>', iconSize: [20,20], iconAnchor: [10,10] })
          }).addTo(map).bindPopup('<b>' + v.title + '</b><br>$' + v.rate + '/hr<br><a href="/venues/' + v.slug + '" style="color:#f97316;">Details &rarr;</a>');
        });
      });
    </script>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// VENUE DETAIL PAGE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/venues/:slug', async (c) => {
  const slug = c.req.param('slug')
  const venue = await getVenueBySlug(c.env.DB, slug)
  if (!venue) {
    return c.html(bmoreLayout('Not Found', html`
      <div class="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 class="font-display text-4xl font-bold text-gray-900 mb-4">Venue Not Found</h1>
        <p class="text-gray-500 mb-8">We couldn't find that venue. It may have been removed or the URL is incorrect.</p>
        <a href="/venues" class="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600">Browse All Venues</a>
      </div>
    `))
  }
  return c.html(bmoreLayout(venue.title, renderVenueDetailPage(venue), { activeNav: 'venues' }))
})

function renderVenueDetailPage(v: VenueData) {
  const typeLabel = VENUE_TYPE_LABELS[v.venueType] || v.venueType
  const amenityList = v.amenities.split(',').map(a => a.trim())
  const amenityLabels: Record<string, string> = {
    tables: '🪑 Tables', chairs: '💺 Chairs', kitchen: '🍳 Kitchen',
    sound_system: '🔊 Sound System', projector: '📽️ Projector', wifi: '📶 WiFi',
    parking: '🅿️ Parking', stage: '🎭 Stage', gymnasium: '🏀 Gymnasium', patio: '🌿 Patio',
  }

  const stars = '★'.repeat(Math.floor(v.rating)) + (v.rating % 1 >= 0.5 ? '½' : '')

  return html`
    <!-- Hero -->
    <div class="relative h-64 md:h-96 overflow-hidden">
      <img src="${v.heroImageUrl}" alt="${v.title}" class="w-full h-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <div class="max-w-7xl mx-auto">
          <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-white/20 text-white backdrop-blur mb-3">${typeLabel}</span>
          <h1 class="font-display text-3xl md:text-4xl font-bold text-white mb-2">${v.title}</h1>
          <p class="text-white/80 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            ${v.address}
          </p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-8">
          <!-- Quick Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <p class="text-2xl font-bold text-orange-500">${v.capacity}</p>
              <p class="text-gray-500 text-sm">Max Guests</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <p class="text-2xl font-bold text-orange-500">$${v.hourlyRate}</p>
              <p class="text-gray-500 text-sm">Per Hour</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <p class="text-2xl font-bold text-teal-600">${v.distanceFromPark} mi</p>
              <p class="text-gray-500 text-sm">From Park</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <p class="text-2xl font-bold text-amber-500">${v.rating}</p>
              <p class="text-gray-500 text-sm">${v.reviewCount} reviews</p>
            </div>
          </div>

          <!-- Description -->
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <h2 class="font-semibold text-lg text-gray-900 mb-3">About This Venue</h2>
            <p class="text-gray-600 leading-relaxed">${v.description}</p>
          </div>

          <!-- Amenities -->
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <h2 class="font-semibold text-lg text-gray-900 mb-4">Amenities</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              ${amenityList.map(a => html`
                <div class="flex items-center gap-2 text-gray-600">
                  <span>${amenityLabels[a] || a}</span>
                </div>
              `)}
            </div>
          </div>

          <!-- Policies -->
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <h2 class="font-semibold text-lg text-gray-900 mb-4">Policies & Features</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex items-center gap-3">
                <span class="w-10 h-10 rounded-lg ${v.hasKitchen ? 'bg-green-100' : 'bg-gray-100'} flex items-center justify-center">
                  ${v.hasKitchen ? '✅' : '❌'}
                </span>
                <div>
                  <p class="font-medium text-gray-900">Kitchen</p>
                  <p class="text-gray-500 text-sm">${v.hasKitchen ? 'Full kitchen available' : 'No kitchen'}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-10 h-10 rounded-lg ${v.hasGymnasium ? 'bg-green-100' : 'bg-gray-100'} flex items-center justify-center">
                  ${v.hasGymnasium ? '✅' : '❌'}
                </span>
                <div>
                  <p class="font-medium text-gray-900">Gymnasium</p>
                  <p class="text-gray-500 text-sm">${v.hasGymnasium ? 'Full gym available' : 'No gymnasium'}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">🍷</span>
                <div>
                  <p class="font-medium text-gray-900">Alcohol Policy</p>
                  <p class="text-gray-500 text-sm">${ALCOHOL_LABELS[v.alcoholPolicy] || v.alcoholPolicy}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-10 h-10 rounded-lg ${v.adaAccessible ? 'bg-green-100' : 'bg-gray-100'} flex items-center justify-center">
                  ${v.adaAccessible ? '✅' : '⚠️'}
                </span>
                <div>
                  <p class="font-medium text-gray-900">ADA Accessible</p>
                  <p class="text-gray-500 text-sm">${v.adaAccessible ? 'Fully accessible' : 'Limited accessibility'}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Map -->
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <h2 class="font-semibold text-lg text-gray-900 mb-4">Location</h2>
            <div id="venue-map" style="height:300px;width:100%;border-radius:12px;overflow:hidden;"></div>
            <p class="text-gray-500 text-sm mt-3">${v.address} &middot; ${v.parkingSpaces} parking spaces</p>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="lg:col-span-1">
          <div class="sticky top-20 space-y-6">
            <!-- Booking Card -->
            <div class="bg-white rounded-xl shadow-sm p-6 border-2 border-orange-100">
              <div class="flex items-baseline gap-1 mb-4">
                <span class="font-display text-3xl font-bold text-gray-900">$${v.hourlyRate}</span>
                <span class="text-gray-500">/hour</span>
              </div>
              <div class="space-y-3 mb-6">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">2-hour minimum</span>
                  <span class="font-medium">$${v.hourlyRate * 2}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">4-hour event</span>
                  <span class="font-medium">$${v.hourlyRate * 4}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">Full day (8 hours)</span>
                  <span class="font-medium">$${v.hourlyRate * 8}</span>
                </div>
              </div>
              <a href="/book?venue=${v.slug}" class="block w-full bg-orange-500 text-white text-center py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                Book This Venue
              </a>
              <p class="text-gray-400 text-xs text-center mt-3">Free cancellation up to 48 hours before</p>
            </div>

            <!-- Contact -->
            <div class="bg-white rounded-xl shadow-sm p-6">
              <h3 class="font-semibold text-gray-900 mb-4">Contact Venue</h3>
              <div class="space-y-3">
                <a href="tel:${v.contactPhone}" class="flex items-center gap-3 text-gray-600 hover:text-orange-500 transition-colors">
                  <span>📞</span> ${v.contactPhone}
                </a>
                <a href="mailto:${v.contactEmail}" class="flex items-center gap-3 text-gray-600 hover:text-orange-500 transition-colors text-sm">
                  <span>📧</span> ${v.contactEmail}
                </a>
              </div>
            </div>

            <!-- Neighborhood -->
            <div class="bg-teal-50 rounded-xl p-6">
              <h3 class="font-semibold text-gray-900 mb-2">${v.neighborhood}</h3>
              <p class="text-gray-600 text-sm">This venue is in the ${v.neighborhood} neighborhood, ${v.distanceFromPark} miles from Patterson Park. Easy access by car or bus from downtown Baltimore.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const map = L.map('venue-map').setView([${v.latitude}, ${v.longitude}], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OSM'
        }).addTo(map);
        L.marker([${v.latitude}, ${v.longitude}], {
          icon: L.divIcon({ className: '', html: '<div class="venue-pin" style="width:24px;height:24px;"></div>', iconSize: [24,24], iconAnchor: [12,12] })
        }).addTo(map).bindPopup('<b>${v.title}</b>');
        L.marker([39.2918, -76.5716], {
          icon: L.divIcon({ className: '', html: '<div style="background:#14b8a6;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>', iconSize: [20,20], iconAnchor: [10,10] })
        }).addTo(map).bindPopup('Patterson Park');
      });
    </script>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING WIZARD (multi-step)
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/book', async (c) => {
  const preselectedVenue = c.req.query('venue') || ''
  const preselectedEventType = c.req.query('eventType') || ''
  let venues = await getVenuesFromDB(c.env.DB)
  if (venues.length === 0) venues = VENUES
  return c.html(bmoreLayout('Book a Space', renderBookingPage(preselectedVenue, preselectedEventType, venues), { activeNav: 'book' }))
})

bmore.post('/book', async (c) => {
  const body = await c.req.json()
  const db = c.env.DB

  const col = await db.prepare(
    "SELECT id FROM collections WHERE name = ? AND is_active = 1"
  ).bind("bookings").first<{ id: string }>()

  if (!col) return c.json({ error: 'Bookings collection not found' }, 500)

  const id = crypto.randomUUID()
  const now = Date.now()
  const bookingRef = 'BK-' + now

  await db.prepare(`
    INSERT INTO content (id, collection_id, slug, title, data, status, author_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, col.id,
    `booking-${id.slice(0, 8)}`,
    `${body.eventName || 'Booking'} - ${body.contactName || 'Guest'}`,
    JSON.stringify({ ...body, bookingRef, status: 'pending' }),
    'published', 'system', now, now
  ).run()

  return c.json({ success: true, bookingId: bookingRef, message: 'Booking request received! We will confirm within 24 hours.' })
})

function renderBookingPage(preselectedVenue: string, preselectedEventType: string, venues: VenueData[] = VENUES) {
  const venueData = preselectedVenue ? venues.find(v => v.slug === preselectedVenue) : null

  return html`
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="font-display text-3xl font-bold text-gray-900 mb-2">Book Your Space</h1>
        <p class="text-gray-500 text-lg">Tell us about your event and we'll find the perfect venue</p>
      </div>

      <!-- Progress Steps -->
      <div class="flex items-center justify-center mb-10">
        <div class="flex items-center gap-0" id="step-indicators">
          ${[
            { num: 1, label: 'Event' },
            { num: 2, label: 'Needs' },
            { num: 3, label: 'Venue' },
            { num: 4, label: 'Date' },
            { num: 5, label: 'Info' },
            { num: 6, label: 'Review' },
          ].map((s, i) => html`
            ${i > 0 ? html`<div class="w-8 md:w-12 h-0.5 bg-gray-200 step-connector" data-step="${s.num}"></div>` : ''}
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-circle ${s.num === 1 ? 'step-active' : 'step-pending'}" data-step="${s.num}">
                ${String(s.num)}
              </div>
              <span class="text-xs mt-1 text-gray-500 hidden md:block">${s.label}</span>
            </div>
          `)}
        </div>
      </div>

      <!-- Step 1: Event Details -->
      <div class="booking-step active fade-in" id="step-1">
        <div class="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 class="font-display text-2xl font-bold text-gray-900 mb-6">Tell Us About Your Event</h2>

          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Event Name</label>
              <input type="text" id="book-event-name" placeholder="e.g., Marcus's 5th Birthday Party" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">What type of event?</label>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3" id="event-type-grid">
                ${EVENT_TYPES.map(et => html`
                  <button type="button" data-value="${et.value}"
                    class="event-type-btn p-4 rounded-xl border-2 ${preselectedEventType === et.value ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'} text-left transition-all"
                    onclick="selectEventType(this, '${et.value}')">
                    <span class="text-2xl block mb-1">${et.icon}</span>
                    <span class="text-sm font-medium text-gray-700">${et.label}</span>
                  </button>
                `)}
              </div>
              <input type="hidden" id="book-event-type" value="${preselectedEventType}" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Number of Adults</label>
                <input type="number" id="book-adult-count" min="1" max="300" value="20" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Number of Children</label>
                <input type="number" id="book-child-count" min="0" max="200" value="10" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
              </div>
            </div>
          </div>

          <div class="flex justify-end mt-8">
            <button onclick="goToStep(2)" class="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
              Next: Your Requirements
              <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: Requirements -->
      <div class="booking-step fade-in" id="step-2">
        <div class="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 class="font-display text-2xl font-bold text-gray-900 mb-6">What Do You Need?</h2>

          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Duration</label>
              <div class="grid grid-cols-4 gap-3" id="duration-grid">
                ${[2, 4, 6, 8].map(d => html`
                  <button type="button" data-value="${String(d)}"
                    class="duration-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all"
                    onclick="selectDuration(this, ${d})">
                    <span class="font-bold text-lg text-gray-800">${d}</span>
                    <span class="text-gray-500 text-sm block">hours</span>
                  </button>
                `)}
              </div>
              <input type="hidden" id="book-duration" value="" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Kitchen Access</label>
              <div class="grid grid-cols-2 gap-3">
                <button type="button" class="kitchen-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all" onclick="selectKitchen(this, true)">
                  <span class="text-2xl block mb-1">🍳</span>
                  <span class="text-sm font-medium text-gray-700">Yes, need a kitchen</span>
                </button>
                <button type="button" class="kitchen-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all" onclick="selectKitchen(this, false)">
                  <span class="text-2xl block mb-1">🚫</span>
                  <span class="text-sm font-medium text-gray-700">No kitchen needed</span>
                </button>
              </div>
              <input type="hidden" id="book-kitchen" value="" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Alcohol</label>
              <div class="grid grid-cols-3 gap-3">
                <button type="button" class="alcohol-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all" onclick="selectAlcohol(this, 'none')">
                  <span class="text-2xl block mb-1">🚫</span>
                  <span class="text-sm font-medium text-gray-700">No Alcohol</span>
                </button>
                <button type="button" class="alcohol-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all" onclick="selectAlcohol(this, 'beer_wine')">
                  <span class="text-2xl block mb-1">🍷</span>
                  <span class="text-sm font-medium text-gray-700">Beer & Wine</span>
                </button>
                <button type="button" class="alcohol-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all" onclick="selectAlcohol(this, 'full_bar')">
                  <span class="text-2xl block mb-1">🍸</span>
                  <span class="text-sm font-medium text-gray-700">Full Bar</span>
                </button>
              </div>
              <input type="hidden" id="book-alcohol" value="" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Gymnasium / Active Play Area</label>
              <div class="grid grid-cols-2 gap-3">
                <button type="button" class="gym-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all" onclick="selectGym(this, true)">
                  <span class="text-2xl block mb-1">🏀</span>
                  <span class="text-sm font-medium text-gray-700">Yes, need a gym</span>
                </button>
                <button type="button" class="gym-btn py-4 rounded-xl border-2 border-gray-200 hover:border-orange-300 text-center transition-all" onclick="selectGym(this, false)">
                  <span class="text-2xl block mb-1">🪑</span>
                  <span class="text-sm font-medium text-gray-700">No gym needed</span>
                </button>
              </div>
              <input type="hidden" id="book-gym" value="" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Any special requirements?</label>
              <textarea id="book-special" rows="3" placeholder="e.g., wheelchair access, specific setup needs, dietary requirements for kitchen..." class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"></textarea>
            </div>
          </div>

          <div class="flex justify-between mt-8">
            <button onclick="goToStep(1)" class="px-6 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              Back
            </button>
            <button onclick="goToStep(3)" class="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
              Next: Choose Venue
              <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Step 3: Choose Venue -->
      <div class="booking-step fade-in" id="step-3">
        <div class="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 class="font-display text-2xl font-bold text-gray-900 mb-2">Choose Your Venue</h2>
          <p class="text-gray-500 mb-6" id="venue-match-msg">Venues matching your requirements</p>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Map -->
            <div>
              <div id="booking-map" style="height:400px;width:100%;border-radius:12px;overflow:hidden;"></div>
            </div>

            <!-- Venue List -->
            <div id="venue-results" class="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              <!-- Populated by JS -->
            </div>
          </div>
          <input type="hidden" id="book-venue-slug" value="${preselectedVenue}" />

          <div class="flex justify-between mt-8">
            <button onclick="goToStep(2)" class="px-6 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              Back
            </button>
            <button onclick="goToStep(4)" id="btn-step3-next" class="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Next: Pick Date
              <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Step 4: Date & Time -->
      <div class="booking-step fade-in" id="step-4">
        <div class="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 class="font-display text-2xl font-bold text-gray-900 mb-6">Pick a Date & Time</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Calendar -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Select Date</label>
              <div id="calendar-container" class="bg-gray-50 rounded-xl p-4">
                <div class="flex items-center justify-between mb-4">
                  <button onclick="calendarPrev()" class="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <span id="calendar-month" class="font-semibold text-gray-900"></span>
                  <button onclick="calendarNext()" class="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
                <div class="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
                  <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>
                <div id="calendar-days" class="grid grid-cols-7 gap-1"></div>
              </div>
              <input type="hidden" id="book-date" value="" />
            </div>

            <!-- Time Slots -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">Select Start Time</label>
              <div id="time-slots" class="grid grid-cols-2 gap-2">
                ${['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'].map(t => html`
                  <button type="button" class="time-btn py-3 rounded-xl border border-gray-200 hover:border-orange-300 text-sm font-medium text-gray-700 transition-all"
                    onclick="selectTime(this, '${t}')">
                    ${t}
                  </button>
                `)}
              </div>
              <input type="hidden" id="book-time" value="" />

              <div id="time-summary" class="mt-4 p-4 bg-orange-50 rounded-xl hidden">
                <p class="text-sm text-gray-600"><strong>Your event:</strong></p>
                <p class="text-sm text-gray-600" id="time-summary-text"></p>
              </div>
            </div>
          </div>

          <div class="flex justify-between mt-8">
            <button onclick="goToStep(3)" class="px-6 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              Back
            </button>
            <button onclick="goToStep(5)" class="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
              Next: Your Info
              <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Step 5: Contact Info -->
      <div class="booking-step fade-in" id="step-5">
        <div class="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 class="font-display text-2xl font-bold text-gray-900 mb-6">Your Information</h2>

          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input type="text" id="book-name" placeholder="John Smith" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Organization (optional)</label>
                <input type="text" id="book-org" placeholder="e.g., Smith Family, St. Mary's Youth Group" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input type="email" id="book-email" placeholder="john@example.com" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                <input type="tel" id="book-phone" placeholder="(410) 555-1234" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Anything else we should know?</label>
              <textarea id="book-notes" rows="3" placeholder="Special setup requests, dietary needs, etc." class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"></textarea>
            </div>
          </div>

          <div class="flex justify-between mt-8">
            <button onclick="goToStep(4)" class="px-6 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              Back
            </button>
            <button onclick="goToStep(6)" class="px-8 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
              Next: Review Booking
              <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Step 6: Review & Confirm -->
      <div class="booking-step fade-in" id="step-6">
        <div class="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 class="font-display text-2xl font-bold text-gray-900 mb-6">Review Your Booking</h2>

          <div id="review-summary" class="space-y-6">
            <!-- Populated by JS -->
          </div>

          <div class="mt-6 p-4 bg-gray-50 rounded-xl">
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" id="book-terms" class="mt-1 w-4 h-4 text-orange-500 rounded" />
              <span class="text-sm text-gray-600">I agree to the <a href="#" class="text-orange-500 underline">terms and conditions</a> and understand this is a booking request. The venue will confirm availability within 24 hours.</span>
            </label>
          </div>

          <div class="flex justify-between mt-8">
            <button onclick="goToStep(5)" class="px-6 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              Back
            </button>
            <button onclick="submitBooking()" id="btn-submit" class="px-8 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50" disabled>
              Confirm Booking Request
            </button>
          </div>
        </div>
      </div>

      <!-- Confirmation (shown after submit) -->
      <div class="booking-step fade-in" id="step-confirm" style="display:none;">
        <div class="bg-white rounded-2xl shadow-sm p-8 md:p-12 text-center">
          <div class="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl">🎉</span>
          </div>
          <h2 class="font-display text-3xl font-bold text-gray-900 mb-4">Booking Request Sent!</h2>
          <p class="text-gray-500 text-lg mb-2">Your booking request has been submitted successfully.</p>
          <p class="text-gray-500 mb-8">The venue will review your request and confirm availability within 24 hours. You'll receive a confirmation email shortly.</p>
          <div id="confirm-details" class="bg-gray-50 rounded-xl p-6 text-left max-w-md mx-auto mb-8">
            <!-- Populated by JS -->
          </div>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/" class="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600">Back to Home</a>
            <a href="/venues" class="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">Browse More Venues</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Wizard Script -->
    <script>
      // ── Venue data (for filtering) ──
      const allVenues = ${raw(JSON.stringify(venues))}
      let currentStep = 1
      let bookingMap = null
      let calendarYear, calendarMonth

      // ── Step navigation ──
      function goToStep(n) {
        document.querySelectorAll('.booking-step').forEach(el => {
          el.classList.remove('active')
          el.style.display = 'none'
        })
        const target = document.getElementById('step-' + n)
        if (target) {
          target.style.display = 'block'
          // Force reflow then add active class for animation
          target.offsetHeight
          target.classList.add('active')
        }
        currentStep = n

        // Update step indicators
        document.querySelectorAll('.step-circle').forEach(el => {
          const s = parseInt(el.dataset.step)
          el.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-circle ' +
            (s < n ? 'step-completed' : s === n ? 'step-active' : 'step-pending')
          if (s < n) el.textContent = '✓'
          else el.textContent = s
        })
        document.querySelectorAll('.step-connector').forEach(el => {
          const s = parseInt(el.dataset.step)
          el.className = 'w-8 md:w-12 h-0.5 step-connector ' + (s <= n ? 'bg-teal-500' : 'bg-gray-200')
        })

        // Special init for steps
        if (n === 3) initVenueStep()
        if (n === 4) initCalendar()
        if (n === 6) buildReview()

        window.scrollTo({ top: 0, behavior: 'smooth' })
      }

      // ── Step 1: Event type selection ──
      function selectEventType(btn, value) {
        document.querySelectorAll('.event-type-btn').forEach(b => {
          b.classList.remove('border-orange-500', 'bg-orange-50')
          b.classList.add('border-gray-200')
        })
        btn.classList.add('border-orange-500', 'bg-orange-50')
        btn.classList.remove('border-gray-200')
        document.getElementById('book-event-type').value = value
      }

      // ── Step 2: Selection helpers ──
      function selectDuration(btn, val) {
        document.querySelectorAll('.duration-btn').forEach(b => { b.classList.remove('border-orange-500', 'bg-orange-50'); b.classList.add('border-gray-200') })
        btn.classList.add('border-orange-500', 'bg-orange-50'); btn.classList.remove('border-gray-200')
        document.getElementById('book-duration').value = val
      }
      function selectKitchen(btn, val) {
        document.querySelectorAll('.kitchen-btn').forEach(b => { b.classList.remove('border-orange-500', 'bg-orange-50'); b.classList.add('border-gray-200') })
        btn.classList.add('border-orange-500', 'bg-orange-50'); btn.classList.remove('border-gray-200')
        document.getElementById('book-kitchen').value = val
      }
      function selectAlcohol(btn, val) {
        document.querySelectorAll('.alcohol-btn').forEach(b => { b.classList.remove('border-orange-500', 'bg-orange-50'); b.classList.add('border-gray-200') })
        btn.classList.add('border-orange-500', 'bg-orange-50'); btn.classList.remove('border-gray-200')
        document.getElementById('book-alcohol').value = val
      }
      function selectGym(btn, val) {
        document.querySelectorAll('.gym-btn').forEach(b => { b.classList.remove('border-orange-500', 'bg-orange-50'); b.classList.add('border-gray-200') })
        btn.classList.add('border-orange-500', 'bg-orange-50'); btn.classList.remove('border-gray-200')
        document.getElementById('book-gym').value = val
      }

      // ── Step 3: Venue filtering & map ──
      function initVenueStep() {
        const totalGuests = parseInt(document.getElementById('book-adult-count').value || '0') + parseInt(document.getElementById('book-child-count').value || '0')
        const needKitchen = document.getElementById('book-kitchen').value === 'true'
        const needGym = document.getElementById('book-gym').value === 'true'
        const alcohol = document.getElementById('book-alcohol').value

        let filtered = allVenues.filter(v => {
          if (v.capacity < totalGuests) return false
          if (needKitchen && !v.hasKitchen) return false
          if (needGym && !v.hasGymnasium) return false
          if (alcohol === 'beer_wine' && v.alcoholPolicy === 'none') return false
          if (alcohol === 'full_bar' && v.alcoholPolicy !== 'full_bar') return false
          return true
        })

        const container = document.getElementById('venue-results')
        const msg = document.getElementById('venue-match-msg')

        if (filtered.length === 0) {
          msg.textContent = 'No exact matches. Showing all venues — some may not meet all requirements.'
          filtered = allVenues
        } else {
          msg.textContent = filtered.length + ' venue' + (filtered.length !== 1 ? 's' : '') + ' match your requirements'
        }

        const selected = document.getElementById('book-venue-slug').value
        container.innerHTML = filtered.map(v => {
          const isSelected = v.slug === selected
          return '<div class="p-4 rounded-xl border-2 cursor-pointer transition-all ' + (isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300') + '" onclick="selectVenue(\\'' + v.slug + '\\')">' +
            '<div class="flex gap-4">' +
            '<img src="' + v.imageUrl + '" class="w-24 h-20 rounded-lg object-cover flex-shrink-0" />' +
            '<div class="flex-1 min-w-0">' +
            '<h4 class="font-semibold text-gray-900 truncate">' + v.title + '</h4>' +
            '<p class="text-gray-500 text-sm">' + v.neighborhood + ' &middot; ' + v.distanceFromPark + ' mi</p>' +
            '<div class="flex items-center justify-between mt-2">' +
            '<span class="text-xs text-gray-500">Up to ' + v.capacity + ' guests</span>' +
            '<span class="font-bold text-orange-600">$' + v.hourlyRate + '/hr</span>' +
            '</div></div></div></div>'
        }).join('')

        // Init or update map
        if (!bookingMap) {
          bookingMap = L.map('booking-map').setView([39.2890, -76.5700], 13)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(bookingMap)
        }

        // Clear existing markers
        bookingMap.eachLayer(l => { if (l instanceof L.Marker) bookingMap.removeLayer(l) })

        L.marker([39.2918, -76.5716], {
          icon: L.divIcon({ className: '', html: '<div style="background:#14b8a6;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>', iconSize: [20,20], iconAnchor: [10,10] })
        }).addTo(bookingMap).bindPopup('Patterson Park')

        filtered.forEach(v => {
          const isSelected = v.slug === selected
          L.marker([v.latitude, v.longitude], {
            icon: L.divIcon({ className: '', html: '<div style="background:' + (isSelected ? '#14b8a6' : '#f97316') + ';border:3px solid white;border-radius:50%;width:' + (isSelected ? '24' : '20') + 'px;height:' + (isSelected ? '24' : '20') + 'px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
              iconSize: [isSelected ? 24 : 20, isSelected ? 24 : 20], iconAnchor: [isSelected ? 12 : 10, isSelected ? 12 : 10] })
          }).addTo(bookingMap).bindPopup('<b>' + v.title + '</b><br>$' + v.hourlyRate + '/hr')
        })

        setTimeout(() => { bookingMap.invalidateSize() }, 100)

        if (selected) document.getElementById('btn-step3-next').disabled = false
      }

      function selectVenue(slug) {
        document.getElementById('book-venue-slug').value = slug
        document.getElementById('btn-step3-next').disabled = false
        initVenueStep() // Re-render with selection
      }

      // ── Step 4: Calendar ──
      function initCalendar() {
        const now = new Date()
        calendarYear = now.getFullYear()
        calendarMonth = now.getMonth()
        renderCalendar()
      }

      function calendarPrev() { calendarMonth--; if (calendarMonth < 0) { calendarMonth = 11; calendarYear-- } renderCalendar() }
      function calendarNext() { calendarMonth++; if (calendarMonth > 11) { calendarMonth = 0; calendarYear++ } renderCalendar() }

      function renderCalendar() {
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
        document.getElementById('calendar-month').textContent = months[calendarMonth] + ' ' + calendarYear

        const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
        const today = new Date()
        today.setHours(0,0,0,0)
        const selectedDate = document.getElementById('book-date').value

        let html = ''
        for (let i = 0; i < firstDay; i++) html += '<div></div>'
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(calendarYear, calendarMonth, d)
          const dateStr = calendarYear + '-' + String(calendarMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
          const isPast = date < today
          const isSelected = dateStr === selectedDate
          const isToday = date.getTime() === today.getTime()

          let cls = 'w-full aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all cursor-pointer '
          if (isPast) cls += 'text-gray-300 cursor-not-allowed'
          else if (isSelected) cls += 'bg-orange-500 text-white'
          else if (isToday) cls += 'bg-orange-100 text-orange-700 hover:bg-orange-200'
          else cls += 'text-gray-700 hover:bg-gray-100'

          html += '<button type="button" class="' + cls + '" ' + (isPast ? 'disabled' : 'onclick="selectDate(\\'' + dateStr + '\\')"') + '>' + d + '</button>'
        }
        document.getElementById('calendar-days').innerHTML = html
      }

      function selectDate(dateStr) {
        document.getElementById('book-date').value = dateStr
        renderCalendar()
        updateTimeSummary()
      }

      function selectTime(btn, time) {
        document.querySelectorAll('.time-btn').forEach(b => {
          b.classList.remove('border-orange-500', 'bg-orange-50', 'text-orange-700')
          b.classList.add('border-gray-200', 'text-gray-700')
        })
        btn.classList.add('border-orange-500', 'bg-orange-50', 'text-orange-700')
        btn.classList.remove('border-gray-200', 'text-gray-700')
        document.getElementById('book-time').value = time
        updateTimeSummary()
      }

      function updateTimeSummary() {
        const date = document.getElementById('book-date').value
        const time = document.getElementById('book-time').value
        const duration = document.getElementById('book-duration').value || '4'
        const summary = document.getElementById('time-summary')
        const text = document.getElementById('time-summary-text')

        if (date && time) {
          const d = new Date(date + 'T12:00:00')
          const dateFormatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          text.textContent = dateFormatted + ', ' + time + ' (' + duration + ' hours)'
          summary.classList.remove('hidden')
        }
      }

      // ── Step 6: Review ──
      function buildReview() {
        const venue = allVenues.find(v => v.slug === document.getElementById('book-venue-slug').value) || {}
        const duration = parseInt(document.getElementById('book-duration').value || '4')
        const total = (venue.hourlyRate || 0) * duration
        const eventTypes = ${raw(JSON.stringify(Object.fromEntries(EVENT_TYPES.map(e => [e.value, e.label]))))}
        const alcoholLabels = { none: 'No Alcohol', beer_wine: 'Beer & Wine', full_bar: 'Full Bar' }

        const date = document.getElementById('book-date').value
        let dateFormatted = date
        if (date) {
          const d = new Date(date + 'T12:00:00')
          dateFormatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        }

        const sections = [
          { title: 'Event Details', items: [
            ['Event', document.getElementById('book-event-name').value || 'Unnamed Event'],
            ['Type', eventTypes[document.getElementById('book-event-type').value] || '-'],
            ['Adults', document.getElementById('book-adult-count').value],
            ['Children', document.getElementById('book-child-count').value || '0'],
          ]},
          { title: 'Venue', items: [
            ['Venue', venue.title || '-'],
            ['Address', venue.address || '-'],
            ['Neighborhood', venue.neighborhood || '-'],
          ]},
          { title: 'Date & Time', items: [
            ['Date', dateFormatted],
            ['Time', document.getElementById('book-time').value || '-'],
            ['Duration', duration + ' hours'],
          ]},
          { title: 'Requirements', items: [
            ['Kitchen', document.getElementById('book-kitchen').value === 'true' ? 'Yes' : 'No'],
            ['Gymnasium', document.getElementById('book-gym').value === 'true' ? 'Yes' : 'No'],
            ['Alcohol', alcoholLabels[document.getElementById('book-alcohol').value] || '-'],
          ]},
          { title: 'Contact', items: [
            ['Name', document.getElementById('book-name').value || '-'],
            ['Email', document.getElementById('book-email').value || '-'],
            ['Phone', document.getElementById('book-phone').value || '-'],
            ['Organization', document.getElementById('book-org').value || '-'],
          ]},
        ]

        let html = sections.map(s =>
          '<div class="border-b border-gray-100 pb-4">' +
          '<h3 class="font-semibold text-gray-900 mb-3">' + s.title + '</h3>' +
          '<div class="grid grid-cols-2 gap-2">' +
          s.items.map(([k,v]) => '<div class="text-sm text-gray-500">' + k + '</div><div class="text-sm font-medium text-gray-900">' + v + '</div>').join('') +
          '</div></div>'
        ).join('')

        html += '<div class="bg-orange-50 rounded-xl p-4 mt-4">' +
          '<div class="flex justify-between items-center">' +
          '<span class="font-semibold text-gray-900">Estimated Total</span>' +
          '<span class="font-display text-2xl font-bold text-orange-600">$' + total + '</span>' +
          '</div>' +
          '<p class="text-gray-500 text-xs mt-1">$' + (venue.hourlyRate || 0) + '/hr &times; ' + duration + ' hours. Final price confirmed by venue.</p>' +
          '</div>'

        document.getElementById('review-summary').innerHTML = html
      }

      // ── Terms checkbox ──
      document.addEventListener('DOMContentLoaded', function() {
        const cb = document.getElementById('book-terms')
        if (cb) cb.addEventListener('change', function() {
          document.getElementById('btn-submit').disabled = !this.checked
        })
      })

      // ── Submit booking ──
      async function submitBooking() {
        const btn = document.getElementById('btn-submit')
        btn.disabled = true
        btn.textContent = 'Submitting...'

        const venue = allVenues.find(v => v.slug === document.getElementById('book-venue-slug').value) || {}
        const duration = parseInt(document.getElementById('book-duration').value || '4')

        const booking = {
          eventName: document.getElementById('book-event-name').value,
          eventType: document.getElementById('book-event-type').value,
          adultCount: parseInt(document.getElementById('book-adult-count').value),
          childCount: parseInt(document.getElementById('book-child-count').value || '0'),
          duration: duration,
          needsKitchen: document.getElementById('book-kitchen').value === 'true',
          needsGymnasium: document.getElementById('book-gym').value === 'true',
          alcoholRequested: document.getElementById('book-alcohol').value,
          venueSlug: document.getElementById('book-venue-slug').value,
          venueName: venue.title,
          eventDate: document.getElementById('book-date').value,
          startTime: document.getElementById('book-time').value,
          contactName: document.getElementById('book-name').value,
          contactEmail: document.getElementById('book-email').value,
          contactPhone: document.getElementById('book-phone').value,
          organization: document.getElementById('book-org').value,
          specialRequests: document.getElementById('book-notes').value || document.getElementById('book-special').value,
          estimatedTotal: (venue.hourlyRate || 0) * duration,
        }

        try {
          const res = await fetch('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(booking)
          })
          const data = await res.json()

          // Show confirmation
          document.querySelectorAll('.booking-step').forEach(el => { el.classList.remove('active'); el.style.display = 'none' })
          const confirm = document.getElementById('step-confirm')
          confirm.style.display = 'block'
          confirm.classList.add('active')

          document.getElementById('confirm-details').innerHTML =
            '<p class="text-sm"><strong>Booking ID:</strong> ' + (data.bookingId || 'N/A') + '</p>' +
            '<p class="text-sm mt-1"><strong>Event:</strong> ' + booking.eventName + '</p>' +
            '<p class="text-sm mt-1"><strong>Venue:</strong> ' + booking.venueName + '</p>' +
            '<p class="text-sm mt-1"><strong>Date:</strong> ' + booking.eventDate + ' at ' + booking.startTime + '</p>' +
            '<p class="text-sm mt-1"><strong>Total:</strong> $' + booking.estimatedTotal + '</p>'

          // Update step indicators to all complete
          document.querySelectorAll('.step-circle').forEach(el => {
            el.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold step-circle step-completed'
            el.textContent = '✓'
          })
          document.querySelectorAll('.step-connector').forEach(el => {
            el.className = 'w-8 md:w-12 h-0.5 step-connector bg-teal-500'
          })
        } catch (err) {
          btn.disabled = false
          btn.textContent = 'Confirm Booking Request'
          alert('Something went wrong. Please try again.')
        }
      }

      // ── Pre-select venue if provided in URL ──
      document.addEventListener('DOMContentLoaded', function() {
        const preselected = '${preselectedVenue}'
        if (preselected) {
          document.getElementById('book-venue-slug').value = preselected
        }
      })
    </script>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// ABOUT PAGE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/about', async (c) => {
  let venues = await getVenuesFromDB(c.env.DB)
  if (venues.length === 0) venues = VENUES
  return c.html(bmoreLayout('About', renderAboutPage(venues), { activeNav: 'about' }))
})

function renderAboutPage(allVenues: VenueData[] = VENUES) {
  return html`
    <!-- Hero -->
    <section class="bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 class="font-display text-4xl font-bold text-gray-900 mb-6">Bringing Families Together in Baltimore</h1>
            <p class="text-gray-600 text-lg leading-relaxed mb-6">
              Family Fun in Bmore was born from a simple idea: Baltimore's churches, rec centers, and community spaces
              are amazing gathering places — but finding and booking them shouldn't be hard.
            </p>
            <p class="text-gray-600 leading-relaxed mb-6">
              We partner with venues within 5 miles of Patterson Park to make it easy for families to find, compare,
              and book the perfect space for birthday parties, reunions, baby showers, and community events.
            </p>
            <p class="text-gray-600 leading-relaxed">
              Every venue in our network is vetted for safety, accessibility, and family-friendliness.
              We believe every family deserves a great space to celebrate together.
            </p>
          </div>
          <div>
            <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600&h=500&fit=crop" alt="Family gathering" class="rounded-2xl shadow-lg w-full object-cover" style="max-height:500px" />
          </div>
        </div>
      </div>
    </section>

    <!-- Values -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="font-display text-3xl font-bold text-gray-900 text-center mb-12">Our Values</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="bg-white rounded-xl p-8 shadow-sm text-center">
            <div class="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">👨‍👩‍👧‍👦</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-3">Family First</h3>
            <p class="text-gray-500">Every space we list is evaluated for family-friendliness, safety, and comfort. Your family's experience is our top priority.</p>
          </div>
          <div class="bg-white rounded-xl p-8 shadow-sm text-center">
            <div class="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🤝</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-3">Community Powered</h3>
            <p class="text-gray-500">We work directly with local churches, schools, and community organizations. Your rental helps support these vital neighborhood institutions.</p>
          </div>
          <div class="bg-white rounded-xl p-8 shadow-sm text-center">
            <div class="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">💡</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-3">Easy & Transparent</h3>
            <p class="text-gray-500">No hidden fees, no surprise charges. See exactly what you get and what it costs before you book. Simple as that.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Patterson Park Area -->
    <section class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div id="about-map" style="height:350px;width:100%;border-radius:16px;overflow:hidden;"></div>
          </div>
          <div>
            <h2 class="font-display text-3xl font-bold text-gray-900 mb-6">The Patterson Park Neighborhood</h2>
            <p class="text-gray-600 leading-relaxed mb-4">
              Patterson Park is the heart of Southeast Baltimore — a 155-acre urban oasis surrounded by vibrant
              neighborhoods including Highlandtown, Canton, Fells Point, and Butchers Hill.
            </p>
            <p class="text-gray-600 leading-relaxed mb-4">
              The area is home to a rich tapestry of cultures, with strong community ties and a tradition of
              neighborhood gatherings. From the historic Pagoda to the boat lake, the park itself is a beloved
              Baltimore landmark.
            </p>
            <p class="text-gray-600 leading-relaxed">
              Our venues span the neighborhoods surrounding the park, each bringing its own character and charm
              to your family event.
            </p>
            <div class="grid grid-cols-2 gap-4 mt-6">
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="font-bold text-gray-900">Highlandtown</p>
                <p class="text-gray-500 text-sm">Arts district, diverse dining</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="font-bold text-gray-900">Canton</p>
                <p class="text-gray-500 text-sm">Waterfront charm, shops</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="font-bold text-gray-900">Fells Point</p>
                <p class="text-gray-500 text-sm">Historic cobblestone streets</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="font-bold text-gray-900">Patterson Park</p>
                <p class="text-gray-500 text-sm">155-acre urban oasis</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Team -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="font-display text-3xl font-bold text-gray-900 mb-4">Built by Baltimoreans</h2>
        <p class="text-gray-500 text-lg mb-8">We're a small team of Baltimore residents who believe in the power of community spaces to bring families together.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <div class="w-20 h-20 bg-orange-100 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">👩🏾</div>
            <h4 class="font-semibold text-gray-900">Aisha Johnson</h4>
            <p class="text-gray-500 text-sm">Founder & CEO</p>
            <p class="text-gray-400 text-xs mt-2">Patterson Park resident, mother of three</p>
          </div>
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <div class="w-20 h-20 bg-teal-100 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">👨🏻</div>
            <h4 class="font-semibold text-gray-900">Mike Rodriguez</h4>
            <p class="text-gray-500 text-sm">Venue Partnerships</p>
            <p class="text-gray-400 text-xs mt-2">Canton native, community organizer</p>
          </div>
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <div class="w-20 h-20 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">👩🏽</div>
            <h4 class="font-semibold text-gray-900">Priya Patel</h4>
            <p class="text-gray-500 text-sm">Operations</p>
            <p class="text-gray-400 text-xs mt-2">Highlandtown, event planner</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-16 hero-gradient">
      <div class="max-w-4xl mx-auto px-4 text-center text-white">
        <h2 class="font-display text-3xl font-bold mb-4">Ready to Find Your Space?</h2>
        <p class="text-orange-100 text-lg mb-8">Browse our curated collection of family-friendly venues near Patterson Park.</p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/venues" class="px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg">Browse Venues</a>
          <a href="/contact" class="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors">Get in Touch</a>
        </div>
      </div>
    </section>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const mapEl = document.getElementById('about-map');
        if (!mapEl) return;
        const map = L.map('about-map').setView([39.2890, -76.5750], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OSM'
        }).addTo(map);

        // 5-mile radius circle
        L.circle([39.2918, -76.5716], { radius: 8047, color: '#f97316', fillColor: '#f97316', fillOpacity: 0.08, weight: 2 }).addTo(map);

        L.marker([39.2918, -76.5716], {
          icon: L.divIcon({ className: '', html: '<div style="background:#14b8a6;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;">🌳</div>', iconSize: [24,24], iconAnchor: [12,12] })
        }).addTo(map).bindPopup('<b>Patterson Park</b>');

        const venues = ${raw(JSON.stringify(allVenues.map(v => ({ title: v.title, lat: v.latitude, lng: v.longitude }))))};
        venues.forEach(v => {
          L.marker([v.lat, v.lng], {
            icon: L.divIcon({ className: '', html: '<div class="venue-pin"></div>', iconSize: [20,20], iconAnchor: [10,10] })
          }).addTo(map).bindPopup(v.title);
        });
      });
    </script>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT PAGE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/contact', (c) => {
  return c.html(bmoreLayout('Contact', renderContactPage(), { activeNav: 'contact' }))
})

bmore.post('/contact', async (c) => {
  const body = await c.req.json()
  const db = c.env.DB

  try {
    const col = await db.prepare(
      "SELECT id FROM collections WHERE name = ? AND is_active = 1"
    ).bind("contacts").first<{ id: string }>()

    if (col) {
      const id = crypto.randomUUID()
      const now = Date.now()
      await db.prepare(`
        INSERT INTO content (id, collection_id, slug, title, data, status, author_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, col.id,
        `contact-${id.slice(0, 8)}`,
        `Contact: ${body.name || 'Anonymous'} - ${body.subject || 'General'}`,
        JSON.stringify({ ...body, status: 'new' }),
        'published', 'system', now, now
      ).run()
    }
  } catch {
    // Silently continue — still return success to the user
  }

  return c.json({ success: true, message: 'Thank you! We\'ll get back to you within 24 hours.' })
})

function renderContactPage() {
  return html`
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
        <!-- Contact Form -->
        <div>
          <h1 class="font-display text-3xl font-bold text-gray-900 mb-4">Get in Touch</h1>
          <p class="text-gray-500 mb-8">Have a question about a venue or need help planning your event? We'd love to hear from you.</p>

          <form id="contact-form" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input type="text" name="name" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" placeholder="Your name" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" name="email" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select name="subject" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white">
                <option value="general">General Inquiry</option>
                <option value="booking">Booking Help</option>
                <option value="venue">Venue Question</option>
                <option value="partnership">Venue Partnership</option>
                <option value="feedback">Feedback</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea name="message" rows="5" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none" placeholder="Tell us how we can help..."></textarea>
            </div>
            <button type="submit" class="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
              Send Message
            </button>
          </form>

          <div id="contact-success" class="hidden mt-6 p-4 bg-teal-50 rounded-xl text-teal-800">
            <p class="font-semibold">Message sent!</p>
            <p class="text-sm mt-1">We'll get back to you within 24 hours.</p>
          </div>
        </div>

        <!-- Contact Info & Map -->
        <div class="space-y-8">
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <h3 class="font-semibold text-lg text-gray-900 mb-4">Contact Information</h3>
            <div class="space-y-4">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">📍</div>
                <div>
                  <p class="font-medium text-gray-900">Address</p>
                  <p class="text-gray-500 text-sm">Patterson Park area<br>Baltimore, MD 21224</p>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">📧</div>
                <div>
                  <p class="font-medium text-gray-900">Email</p>
                  <p class="text-gray-500 text-sm">hello@familyfuninbmore.com</p>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">📞</div>
                <div>
                  <p class="font-medium text-gray-900">Phone</p>
                  <p class="text-gray-500 text-sm">(410) 555-FUN1</p>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">🕐</div>
                <div>
                  <p class="font-medium text-gray-900">Hours</p>
                  <p class="text-gray-500 text-sm">Mon-Fri: 9am - 6pm<br>Sat: 10am - 4pm<br>Sun: Closed</p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <div id="contact-map" style="height:250px;width:100%;"></div>
          </div>

          <!-- FAQ -->
          <div class="bg-orange-50 rounded-xl p-6">
            <h3 class="font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
            <div class="space-y-4">
              <div>
                <p class="font-medium text-gray-900 text-sm">How far in advance should I book?</p>
                <p class="text-gray-500 text-sm mt-1">We recommend booking at least 2 weeks ahead. Popular dates (holidays, summer weekends) should be booked 4-6 weeks in advance.</p>
              </div>
              <div>
                <p class="font-medium text-gray-900 text-sm">Is there a cancellation policy?</p>
                <p class="text-gray-500 text-sm mt-1">Free cancellation up to 48 hours before your event. After that, a 50% fee applies.</p>
              </div>
              <div>
                <p class="font-medium text-gray-900 text-sm">Can I tour a venue before booking?</p>
                <p class="text-gray-500 text-sm mt-1">Absolutely! Contact us and we'll arrange a visit with the venue coordinator.</p>
              </div>
              <div>
                <p class="font-medium text-gray-900 text-sm">Do you handle catering?</p>
                <p class="text-gray-500 text-sm mt-1">We don't provide catering directly, but many of our venues have kitchen facilities and we can recommend local caterers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const map = L.map('contact-map').setView([39.2890, -76.5700], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);
        L.marker([39.2918, -76.5716], {
          icon: L.divIcon({ className: '', html: '<div style="background:#14b8a6;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:12px;">🌳</div>', iconSize: [24,24], iconAnchor: [12,12] })
        }).addTo(map).bindPopup('<b>Patterson Park</b><br>Our home base');

        // Contact form
        document.getElementById('contact-form').addEventListener('submit', async function(e) {
          e.preventDefault()
          const formData = new FormData(this)
          const data = Object.fromEntries(formData)

          try {
            const res = await fetch('/contact', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
            if (res.ok) {
              this.reset()
              document.getElementById('contact-success').classList.remove('hidden')
              setTimeout(() => document.getElementById('contact-success').classList.add('hidden'), 5000)
            }
          } catch (err) {
            alert('Something went wrong. Please try again.')
          }
        })
      });
    </script>
  `
}

export default bmore
