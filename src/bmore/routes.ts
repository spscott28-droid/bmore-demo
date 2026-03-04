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



const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

// Returns the ID to use as author_id for anonymous/system-generated content.
// Prefers an existing admin user so the system user doesn't need to exist
// (which would block SonicJS from assigning admin role to the first registrant).
// Creates the system user on-demand only as a last resort.
async function getAuthorId(db: D1Database): Promise<string> {
  const admin = await db.prepare(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  ).first<{ id: string }>()
  if (admin) return admin.id

  const sys = await db.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(SYSTEM_USER_ID).first<{ id: string }>()
  if (sys) return SYSTEM_USER_ID

  // Last resort: create system user now (only if no admin has registered yet)
  const now = Date.now()
  await db.prepare(
    `INSERT OR IGNORE INTO users (id, email, username, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(SYSTEM_USER_ID, 'system@bmore.local', 'system', 'System', 'User', 'viewer', 1, now, now).run()
  return SYSTEM_USER_ID
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE DATA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface PageData {
  // Identity
  title?: string
  slug?: string
  meta_description?: string
  // Shared header (all pages)
  pageHeading?: string
  pageSubtext?: string
  // Home hero
  heroHeading?: string
  heroSubtext?: string
  heroCtaPrimary?: string
  heroCtaSecondary?: string
  // Home stats bar
  statVenues?: string
  statVenuesLabel?: string
  statRadius?: string
  statRadiusLabel?: string
  statCapacity?: string
  statCapacityLabel?: string
  statPrice?: string
  statPriceLabel?: string
  // Home How It Works
  howItWorksHeading?: string
  howItWorksSubtext?: string
  step1Title?: string
  step1Text?: string
  step2Title?: string
  step2Text?: string
  step3Title?: string
  step3Text?: string
  // Home Featured Venues
  featuredHeading?: string
  featuredSubtext?: string
  // Home CTA section
  ctaHeading?: string
  ctaSubtext?: string
  ctaButtonPrimary?: string
  ctaButtonSecondary?: string
  // About: mission & story
  missionHeading?: string
  missionText?: string
  storyHeading?: string
  storyText?: string
  // About: values
  valueFamilyFirst?: string
  valueCommunity?: string
  valueTransparent?: string
  // About: neighborhood
  neighborhoodHeading?: string
  neighborhoodText?: string
  // About: team
  teamHeading?: string
  teamSubtext?: string
  team1Name?: string
  team1Role?: string
  team1Bio?: string
  team2Name?: string
  team2Role?: string
  team2Bio?: string
  team3Name?: string
  team3Role?: string
  team3Bio?: string
  // About: CTA banner
  aboutCtaHeading?: string
  aboutCtaSubtext?: string
  aboutCtaBtnPrimary?: string
  aboutCtaBtnSecondary?: string
  // Contact info
  email?: string
  phone?: string
  hours?: string
  // Contact FAQ
  faqHeading?: string
  faqQ1?: string
  faqBookingAdvance?: string
  faqQ2?: string
  faqCancellation?: string
  faqQ3?: string
  faqTour?: string
  faqQ4?: string
  faqCatering?: string
  // Catch-all for any extra fields
  content?: string
  [key: string]: unknown
}

async function getPageFromDB(db: D1Database, slug: string): Promise<PageData | null> {
  try {
    const col = await db.prepare(
      "SELECT id FROM collections WHERE name = 'pages' AND is_active = 1"
    ).first<{ id: string }>()
    if (!col) return null

    // Prefer published, but fall back to draft so admin edits show up even if
    // the user saved without clicking "Save & Publish"
    const row = await db.prepare(
      "SELECT data FROM content WHERE collection_id = ? AND slug = ? AND status IN ('published','draft') ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END LIMIT 1"
    ).bind(col.id, slug).first()
    if (!row) return null

    return JSON.parse(row.data as string) as PageData
  } catch {
    return null
  }
}

// Turnstile site key (public key, safe to embed in HTML)
interface TurnstileConfig {
  enabled: boolean
  siteKey: string
  theme: 'light' | 'dark' | 'auto'
  size: 'normal' | 'compact'
  mode: 'managed' | 'non-interactive' | 'invisible'
  appearance: 'always' | 'execute' | 'interaction-only'
}

// Reads Turnstile plugin settings from DB.
// Returns null when the plugin is disabled or not configured.
async function getTurnstileConfig(db: D1Database): Promise<TurnstileConfig | null> {
  try {
    const plugin = await db.prepare(
      "SELECT settings FROM plugins WHERE id = 'turnstile' LIMIT 1"
    ).first()
    if (!plugin?.settings) return null
    const s = JSON.parse(plugin.settings as string) as Partial<TurnstileConfig>
    if (!s.enabled || !s.siteKey) return null
    return {
      enabled: true,
      siteKey: s.siteKey,
      theme: s.theme ?? 'auto',
      size: s.size ?? 'normal',
      mode: s.mode ?? 'managed',
      appearance: s.appearance ?? 'always',
    }
  } catch {
    return null
  }
}

// Build the cf-turnstile widget HTML from config.
// Invisible mode: renders a hidden div; execution is triggered on form submit via JS.
function turnstileWidget(cfg: TurnstileConfig, id?: string): string {
  const idAttr = id ? ` id="${id}"` : ''
  if (cfg.mode === 'invisible') {
    return `<div${idAttr} class="cf-turnstile" data-sitekey="${cfg.siteKey}" data-size="invisible"></div>`
  }
  const sizeAttr = cfg.size === 'compact' ? ' data-size="compact"' : ''
  const appearAttr = cfg.appearance !== 'always' ? ` data-appearance="${cfg.appearance}"` : ''
  return `<div${idAttr} class="cf-turnstile" data-sitekey="${cfg.siteKey}" data-theme="${cfg.theme}"${sizeAttr}${appearAttr}></div>`
}

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
          JSON.stringify(venue), 'published', await getAuthorId(db), now, now
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

  // Upsert all venues — inserts new ones, skips existing (by slug)
  let added = 0
  let skipped = 0
  const authorId = await getAuthorId(db)
  const now = Date.now()

  for (const venue of VENUES) {
    const exists = await db.prepare(
      "SELECT id FROM content WHERE collection_id = ? AND slug = ?"
    ).bind(col.id, venue.slug).first<{ id: string }>()

    if (exists) {
      skipped++
    } else {
      const id = crypto.randomUUID()
      await db.prepare(`
        INSERT INTO content (id, collection_id, slug, title, data, status, author_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, col.id, venue.slug, venue.title, JSON.stringify(venue), 'published', authorId, now, now).run()
      added++
    }
  }

  return c.json({ success: true, message: `Venues synced: ${added} added, ${skipped} already existed` })
})

// ─────────────────────────────────────────────────────────────────────────────
// SEED PAGES ROUTE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/seed-pages', async (c) => {
  const db = c.env.DB
  const authorId = await getAuthorId(db)

  const col = await db.prepare(
    "SELECT id FROM collections WHERE name = 'pages' AND is_active = 1"
  ).first<{ id: string }>()

  if (!col) return c.json({ error: 'Pages collection not found. Visit /admin first.' }, 500)

  const pages = [
    {
      slug: 'home',
      title: 'Home',
      data: {
        // Hero
        heroHeading: "Your Family's Perfect Space Awaits in Baltimore",
        heroSubtext: "Book beautiful churches, recreation centers, and community spaces for your next celebration \u2014 all within 5 miles of Patterson Park.",
        heroCtaPrimary: "Book a Space",
        heroCtaSecondary: "Browse Venues",
        // Stats bar
        statVenues: "10+",
        statVenuesLabel: "Vetted Venues",
        statRadius: "5 mi",
        statRadiusLabel: "Patterson Park Radius",
        statCapacity: "250",
        statCapacityLabel: "Max Capacity",
        statPrice: "$35",
        statPriceLabel: "Starting Per Hour",
        // How It Works
        howItWorksHeading: "How It Works",
        howItWorksSubtext: "Book your perfect family space in three easy steps",
        step1Title: "1. Tell Us Your Needs",
        step1Text: "Share your event details \u2014 guest count, kitchen needs, duration, and more. We'll match you with the perfect spaces.",
        step2Title: "2. Choose Your Venue",
        step2Text: "Browse available spaces on a map, compare amenities and pricing, and select the one that fits your family best.",
        step3Title: "3. Book & Celebrate",
        step3Text: "Pick your date and time, confirm your booking, and get ready for an amazing family gathering!",
        // Featured Venues
        featuredHeading: "Featured Venues",
        featuredSubtext: "Hand-picked spaces perfect for your next family event",
        // CTA section
        ctaHeading: "Ready to Plan Your Event?",
        ctaSubtext: "Our booking wizard makes it easy to find and reserve the perfect space for your family gathering.",
        ctaButtonPrimary: "Start Booking Now",
        ctaButtonSecondary: "Browse All Venues",
        // SEO
        meta_description: "Book family-friendly event spaces in Baltimore \u2014 churches, recreation centers, and community spaces near Patterson Park.",
      }
    },
    {
      slug: 'venues',
      title: 'Browse Venues',
      data: {
        pageHeading: "Find Your Perfect Venue",
        pageSubtext: "Browse our curated selection of family-friendly spaces across Baltimore's Patterson Park neighborhoods.",
        meta_description: "Browse family-friendly venues near Patterson Park in Baltimore. Churches, rec centers, and community spaces available to book.",
      }
    },
    {
      slug: 'about',
      title: 'About Us',
      data: {
        pageHeading: "Building Community, One Celebration at a Time",
        pageSubtext: "We believe every family deserves a beautiful, affordable space to gather and celebrate.",
        // Mission & Story
        missionHeading: "Our Mission",
        missionText: "Family Fun in Bmore exists to make it easy for Baltimore families to find, book, and enjoy community spaces for their gatherings and celebrations. We curate only the best family-friendly venues within the Patterson Park corridor \u2014 churches, recreation centers, schools, and community organizations that open their doors to the community.",
        storyHeading: "Our Story",
        storyText: "Family Fun in Bmore was born from a simple frustration: finding a good space for a family event in Baltimore shouldn't require weeks of phone calls and uncertainty. We set out to change that by creating a simple, transparent booking platform focused on Southeast Baltimore's incredible community spaces.",
        // Values
        valueFamilyFirst: "Every space we list is evaluated for family-friendliness, safety, and comfort. Your family's experience is our top priority.",
        valueCommunity: "We work directly with local churches, schools, and community organizations. Your rental helps support these vital neighborhood institutions.",
        valueTransparent: "No hidden fees, no surprise charges. See exactly what you get and what it costs before you book. Simple as that.",
        // Neighborhood
        neighborhoodHeading: "The Patterson Park Neighborhood",
        neighborhoodText: "Patterson Park is the heart of Southeast Baltimore \u2014 a 155-acre urban oasis surrounded by vibrant neighborhoods including Highlandtown, Canton, Fells Point, and Butchers Hill.",
        // Team
        teamHeading: "Built by Baltimoreans",
        teamSubtext: "We're a small team of Baltimore residents who believe in the power of community spaces to bring families together.",
        team1Name: "Aisha Johnson",
        team1Role: "Founder & CEO",
        team1Bio: "Patterson Park resident, mother of three",
        team2Name: "Mike Rodriguez",
        team2Role: "Venue Partnerships",
        team2Bio: "Canton native, community organizer",
        team3Name: "Priya Patel",
        team3Role: "Operations",
        team3Bio: "Highlandtown, event planner",
        // CTA banner
        aboutCtaHeading: "Ready to Find Your Space?",
        aboutCtaSubtext: "Browse our curated collection of family-friendly venues near Patterson Park.",
        aboutCtaBtnPrimary: "Browse Venues",
        aboutCtaBtnSecondary: "Get in Touch",
        // SEO
        meta_description: "About Family Fun in Bmore \u2014 connecting Baltimore families with community spaces for celebrations near Patterson Park.",
      }
    },
    {
      slug: 'contact',
      title: 'Contact Us',
      data: {
        pageHeading: "Get in Touch",
        pageSubtext: "Have a question about a venue or need help planning your event? We'd love to hear from you.",
        // Contact info
        email: "hello@familyfuninbmore.com",
        phone: "(410) 555-FUN1",
        hours: "Mon-Fri: 9am - 6pm | Sat: 10am - 4pm | Sun: Closed",
        // FAQ
        faqHeading: "Frequently Asked Questions",
        faqQ1: "How far in advance should I book?",
        faqBookingAdvance: "We recommend booking at least 2 weeks ahead. Popular dates (holidays, summer weekends) should be booked 4-6 weeks in advance.",
        faqQ2: "Is there a cancellation policy?",
        faqCancellation: "Free cancellation up to 48 hours before your event. After that, a 50% fee applies.",
        faqQ3: "Can I tour a venue before booking?",
        faqTour: "Absolutely! Contact us and we'll arrange a visit with the venue coordinator.",
        faqQ4: "Do you handle catering?",
        faqCatering: "We don't provide catering directly, but many of our venues have kitchen facilities and we can recommend local caterers.",
        // SEO
        meta_description: "Contact Family Fun in Bmore \u2014 reach us with venue questions, booking help, or partnership inquiries.",
      }
    },
    {
      slug: 'book',
      title: 'Book a Space',
      data: {
        pageHeading: "Book Your Space",
        pageSubtext: "Tell us about your event and we'll find the perfect venue",
        meta_description: "Book a family-friendly event space near Patterson Park in Baltimore. 6-step booking wizard.",
      }
    },
  ]

  let seeded = 0
  let skipped = 0
  const now = Date.now()

  for (const page of pages) {
    const existing = await db.prepare(
      "SELECT id FROM content WHERE collection_id = ? AND slug = ?"
    ).bind(col.id, page.slug).first()

    if (existing) {
      // Update existing page so re-running /seed-pages refreshes all content
      await db.prepare(
        `UPDATE content SET title = ?, data = ?, updated_at = ? WHERE collection_id = ? AND slug = ?`
      ).bind(page.title, JSON.stringify(page.data), now, col.id, page.slug).run()
      skipped++
    } else {
      await db.prepare(
        `INSERT INTO content (id, collection_id, slug, title, data, status, author_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), col.id, page.slug, page.title,
        JSON.stringify(page.data), 'published', authorId, now, now
      ).run()
      seeded++
    }
  }

  return c.json({ success: true, seeded, updated: skipped, message: `Pages synced: ${seeded} new, ${skipped} updated` })
})


// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/', async (c) => {
  let venues = await getVenuesFromDB(c.env.DB)
  if (venues.length === 0) venues = VENUES
  const featured = venues.slice(0, 6)
  const page = await getPageFromDB(c.env.DB, 'home')
  return c.html(bmoreLayout(page?.pageHeading ? page.pageHeading : 'Home', renderHomePage(featured, venues, page), { activeNav: 'home' }))
})

function renderHomePage(featured: VenueData[], allVenues: VenueData[] = VENUES, page: PageData | null = null) {
  return html`
    <!-- Hero Section -->
    <section class="relative overflow-hidden">
      <div class="hero-gradient">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div class="text-white">
              <h1 class="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                ${page?.heroHeading ?? 'Your Family\'s Perfect Space Awaits in Baltimore'}
              </h1>
              <p class="text-orange-100 text-lg md:text-xl mb-8 leading-relaxed">
                ${page?.heroSubtext ?? 'Book beautiful churches, recreation centers, and community spaces for your next celebration — all within 5 miles of Patterson Park.'}
              </p>
              <div class="flex flex-col sm:flex-row gap-4">
                <a href="/book" class="inline-flex items-center justify-center px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg text-lg">
                  ${page?.heroCtaPrimary ?? 'Book a Space'}
                  <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </a>
                <a href="/venues" class="inline-flex items-center justify-center px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-lg">
                  ${page?.heroCtaSecondary ?? 'Browse Venues'}
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
            <p class="font-display text-3xl font-bold text-orange-500">${page?.statVenues ?? '10+'}</p>
            <p class="text-gray-500 text-sm mt-1">${page?.statVenuesLabel ?? 'Vetted Venues'}</p>
          </div>
          <div>
            <p class="font-display text-3xl font-bold text-teal-600">${page?.statRadius ?? '5 mi'}</p>
            <p class="text-gray-500 text-sm mt-1">${page?.statRadiusLabel ?? 'Patterson Park Radius'}</p>
          </div>
          <div>
            <p class="font-display text-3xl font-bold text-orange-500">${page?.statCapacity ?? '250'}</p>
            <p class="text-gray-500 text-sm mt-1">${page?.statCapacityLabel ?? 'Max Capacity'}</p>
          </div>
          <div>
            <p class="font-display text-3xl font-bold text-teal-600">${page?.statPrice ?? '$35'}</p>
            <p class="text-gray-500 text-sm mt-1">${page?.statPriceLabel ?? 'Starting Per Hour'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="py-16 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="font-display text-3xl font-bold text-gray-900 mb-4">${page?.howItWorksHeading ?? 'How It Works'}</h2>
          <p class="text-gray-500 text-lg max-w-2xl mx-auto">${page?.howItWorksSubtext ?? 'Book your perfect family space in three easy steps'}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">📝</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-2">${page?.step1Title ?? '1. Tell Us Your Needs'}</h3>
            <p class="text-gray-500">${page?.step1Text ?? 'Share your event details — guest count, kitchen needs, duration, and more. We\'ll match you with the perfect spaces.'}</p>
          </div>
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🗺️</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-2">${page?.step2Title ?? '2. Choose Your Venue'}</h3>
            <p class="text-gray-500">${page?.step2Text ?? 'Browse available spaces on a map, compare amenities and pricing, and select the one that fits your family best.'}</p>
          </div>
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🎉</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-2">${page?.step3Title ?? '3. Book & Celebrate'}</h3>
            <p class="text-gray-500">${page?.step3Text ?? 'Pick your date and time, confirm your booking, and get ready for an amazing family gathering!'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Venues -->
    <section class="py-16 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="font-display text-3xl font-bold text-gray-900 mb-2">${page?.featuredHeading ?? 'Featured Venues'}</h2>
            <p class="text-gray-500">${page?.featuredSubtext ?? 'Hand-picked spaces perfect for your next family event'}</p>
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
        <h2 class="font-display text-3xl md:text-4xl font-bold mb-4">${page?.ctaHeading ?? 'Ready to Plan Your Event?'}</h2>
        <p class="text-orange-100 text-lg mb-8 max-w-2xl mx-auto">${page?.ctaSubtext ?? 'Our booking wizard makes it easy to find and reserve the perfect space for your family gathering.'}</p>
        <a href="/book" class="inline-flex items-center px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg text-lg">
          ${page?.ctaButtonPrimary ?? 'Start Booking Now'}
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
  const page = await getPageFromDB(c.env.DB, 'venues')
  return c.html(bmoreLayout(page?.pageHeading ? page.pageHeading : 'Venues', renderVenuesPage(venues, typeFilter, allVenues, page), { activeNav: 'venues' }))
})

function renderVenuesPage(venues: VenueData[], typeFilter: string, allVenuesForMap: VenueData[] = VENUES, page: PageData | null = null) {
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
        <h1 class="font-display text-3xl font-bold text-gray-900 mb-2">${page?.pageHeading ?? 'Browse Venues'}</h1>
        <p class="text-gray-500 text-lg">${page?.pageSubtext ?? 'Find the perfect family-friendly space near Patterson Park'}</p>

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
  const page = await getPageFromDB(c.env.DB, 'book')
  const turnstileCfg = await getTurnstileConfig(c.env.DB)
  return c.html(bmoreLayout(page?.pageHeading ? page.pageHeading : 'Book a Space', renderBookingPage(preselectedVenue, preselectedEventType, venues, page, turnstileCfg), { activeNav: 'book' }))
})


function renderBookingPage(preselectedVenue: string, preselectedEventType: string, venues: VenueData[] = VENUES, page: PageData | null = null, turnstileCfg: TurnstileConfig | null = null) {
  const venueData = preselectedVenue ? venues.find(v => v.slug === preselectedVenue) : null

  return html`
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="font-display text-3xl font-bold text-gray-900 mb-2">${page?.pageHeading ?? 'Book Your Space'}</h1>
        <p class="text-gray-500 text-lg">${page?.pageSubtext ?? 'Tell us about your event and we\'ll find the perfect venue'}</p>
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
            ${raw(turnstileCfg ? turnstileWidget(turnstileCfg, 'booking-turnstile') : '')}
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
          // Include Turnstile token if widget is present
          const tsToken = document.querySelector('#booking-turnstile [name="cf-turnstile-response"]')?.value
          if (tsToken) booking.turnstile = tsToken

          const res = await fetch('/forms/venue-booking-wizard/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: booking })
          })
          const data = await res.json()

          // Show confirmation
          document.querySelectorAll('.booking-step').forEach(el => { el.classList.remove('active'); el.style.display = 'none' })
          const confirm = document.getElementById('step-confirm')
          confirm.style.display = 'block'
          confirm.classList.add('active')

          document.getElementById('confirm-details').innerHTML =
            '<p class="text-sm"><strong>Booking ID:</strong> ' + (data.submissionId ? data.submissionId.slice(0,8).toUpperCase() : 'N/A') + '</p>' +
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
    ${raw(turnstileCfg ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '')}
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// ABOUT PAGE
// ─────────────────────────────────────────────────────────────────────────────

bmore.get('/about', async (c) => {
  let venues = await getVenuesFromDB(c.env.DB)
  if (venues.length === 0) venues = VENUES
  const page = await getPageFromDB(c.env.DB, 'about')
  return c.html(bmoreLayout(page?.pageHeading ? page.pageHeading : 'About', renderAboutPage(venues, page), { activeNav: 'about' }))
})

function renderAboutPage(allVenues: VenueData[] = VENUES, page: PageData | null = null) {
  return html`
    <!-- Hero -->
    <section class="bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 class="font-display text-4xl font-bold text-gray-900 mb-6">${page?.pageHeading ?? 'Bringing Families Together in Baltimore'}</h1>
            <p class="text-gray-600 text-lg leading-relaxed mb-6">
              ${page?.pageSubtext ?? 'Family Fun in Bmore was born from a simple idea: Baltimore\'s churches, rec centers, and community spaces are amazing gathering places — but finding and booking them shouldn\'t be hard.'}
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
            <p class="text-gray-500">${page?.valueFamilyFirst ?? 'Every space we list is evaluated for family-friendliness, safety, and comfort. Your family\'s experience is our top priority.'}</p>
          </div>
          <div class="bg-white rounded-xl p-8 shadow-sm text-center">
            <div class="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🤝</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-3">Community Powered</h3>
            <p class="text-gray-500">${page?.valueCommunity ?? 'We work directly with local churches, schools, and community organizations. Your rental helps support these vital neighborhood institutions.'}</p>
          </div>
          <div class="bg-white rounded-xl p-8 shadow-sm text-center">
            <div class="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">💡</span>
            </div>
            <h3 class="font-semibold text-lg text-gray-900 mb-3">Easy & Transparent</h3>
            <p class="text-gray-500">${page?.valueTransparent ?? 'No hidden fees, no surprise charges. See exactly what you get and what it costs before you book. Simple as that.'}</p>
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
            <h2 class="font-display text-3xl font-bold text-gray-900 mb-6">${page?.neighborhoodHeading ?? 'The Patterson Park Neighborhood'}</h2>
            <p class="text-gray-600 leading-relaxed mb-4">
              ${page?.neighborhoodText ?? 'Patterson Park is the heart of Southeast Baltimore — a 155-acre urban oasis surrounded by vibrant neighborhoods including Highlandtown, Canton, Fells Point, and Butchers Hill.'}
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
        <h2 class="font-display text-3xl font-bold text-gray-900 mb-4">${page?.teamHeading ?? 'Built by Baltimoreans'}</h2>
        <p class="text-gray-500 text-lg mb-8">${page?.teamSubtext ?? 'We\'re a small team of Baltimore residents who believe in the power of community spaces to bring families together.'}</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <div class="w-20 h-20 bg-orange-100 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">👩🏾</div>
            <h4 class="font-semibold text-gray-900">${page?.team1Name ?? 'Aisha Johnson'}</h4>
            <p class="text-gray-500 text-sm">${page?.team1Role ?? 'Founder & CEO'}</p>
            <p class="text-gray-400 text-xs mt-2">${page?.team1Bio ?? 'Patterson Park resident, mother of three'}</p>
          </div>
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <div class="w-20 h-20 bg-teal-100 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">👨🏻</div>
            <h4 class="font-semibold text-gray-900">${page?.team2Name ?? 'Mike Rodriguez'}</h4>
            <p class="text-gray-500 text-sm">${page?.team2Role ?? 'Venue Partnerships'}</p>
            <p class="text-gray-400 text-xs mt-2">${page?.team2Bio ?? 'Canton native, community organizer'}</p>
          </div>
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <div class="w-20 h-20 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">👩🏽</div>
            <h4 class="font-semibold text-gray-900">${page?.team3Name ?? 'Priya Patel'}</h4>
            <p class="text-gray-500 text-sm">${page?.team3Role ?? 'Operations'}</p>
            <p class="text-gray-400 text-xs mt-2">${page?.team3Bio ?? 'Highlandtown, event planner'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-16 hero-gradient">
      <div class="max-w-4xl mx-auto px-4 text-center text-white">
        <h2 class="font-display text-3xl font-bold mb-4">${page?.aboutCtaHeading ?? 'Ready to Find Your Space?'}</h2>
        <p class="text-orange-100 text-lg mb-8">${page?.aboutCtaSubtext ?? 'Browse our curated collection of family-friendly venues near Patterson Park.'}</p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/venues" class="px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors shadow-lg">${page?.aboutCtaBtnPrimary ?? 'Browse Venues'}</a>
          <a href="/contact" class="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors">${page?.aboutCtaBtnSecondary ?? 'Get in Touch'}</a>
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

bmore.get('/contact', async (c) => {
  const page = await getPageFromDB(c.env.DB, 'contact')
  const turnstileCfg = await getTurnstileConfig(c.env.DB)
  return c.html(bmoreLayout(page?.pageHeading ? page.pageHeading : 'Contact', renderContactPage(page, turnstileCfg), { activeNav: 'contact' }))
})


function renderContactPage(page: PageData | null = null, turnstileCfg: TurnstileConfig | null = null) {
  return html`
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
        <!-- Contact Form -->
        <div>
          <h1 class="font-display text-3xl font-bold text-gray-900 mb-4">${page?.pageHeading ?? 'Get in Touch'}</h1>
          <p class="text-gray-500 mb-8">${page?.pageSubtext ?? 'Have a question about a venue or need help planning your event? We\'d love to hear from you.'}</p>

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
            ${raw(turnstileCfg ? turnstileWidget(turnstileCfg) : '')}
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
                  <p class="text-gray-500 text-sm">${page?.email ?? 'hello@familyfuninbmore.com'}</p>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">📞</div>
                <div>
                  <p class="font-medium text-gray-900">Phone</p>
                  <p class="text-gray-500 text-sm">${page?.phone ?? '(410) 555-FUN1'}</p>
                </div>
              </div>
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">🕐</div>
                <div>
                  <p class="font-medium text-gray-900">Hours</p>
                  <p class="text-gray-500 text-sm">${page?.hours ?? 'Mon-Fri: 9am - 6pm<br>Sat: 10am - 4pm<br>Sun: Closed'}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <div id="contact-map" style="height:250px;width:100%;"></div>
          </div>

          <!-- FAQ -->
          <div class="bg-orange-50 rounded-xl p-6">
            <h3 class="font-semibold text-gray-900 mb-4">${page?.faqHeading ?? 'Frequently Asked Questions'}</h3>
            <div class="space-y-4">
              <div>
                <p class="font-medium text-gray-900 text-sm">${page?.faqQ1 ?? 'How far in advance should I book?'}</p>
                <p class="text-gray-500 text-sm mt-1">${page?.faqBookingAdvance ?? 'We recommend booking at least 2 weeks ahead. Popular dates (holidays, summer weekends) should be booked 4-6 weeks in advance.'}</p>
              </div>
              <div>
                <p class="font-medium text-gray-900 text-sm">${page?.faqQ2 ?? 'Is there a cancellation policy?'}</p>
                <p class="text-gray-500 text-sm mt-1">${page?.faqCancellation ?? 'Free cancellation up to 48 hours before your event. After that, a 50% fee applies.'}</p>
              </div>
              <div>
                <p class="font-medium text-gray-900 text-sm">${page?.faqQ3 ?? 'Can I tour a venue before booking?'}</p>
                <p class="text-gray-500 text-sm mt-1">${page?.faqTour ?? 'Absolutely! Contact us and we\'ll arrange a visit with the venue coordinator.'}</p>
              </div>
              <div>
                <p class="font-medium text-gray-900 text-sm">${page?.faqQ4 ?? 'Do you handle catering?'}</p>
                <p class="text-gray-500 text-sm mt-1">${page?.faqCatering ?? 'We don\'t provide catering directly, but many of our venues have kitchen facilities and we can recommend local caterers.'}</p>
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
          const btn = this.querySelector('button[type="submit"]')
          btn.disabled = true
          btn.textContent = 'Sending...'

          const formData = new FormData(this)
          const data = Object.fromEntries(formData)

          // Include Turnstile token if widget is present
          const tsToken = document.querySelector('.cf-turnstile [name="cf-turnstile-response"]')?.value
          if (tsToken) data.turnstile = tsToken

          try {
            const res = await fetch('/forms/contact/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data })
            })
            const result = await res.json()
            if (res.ok) {
              this.reset()
              if (window.turnstile) window.turnstile.reset()
              document.getElementById('contact-success').classList.remove('hidden')
              setTimeout(() => document.getElementById('contact-success').classList.add('hidden'), 5000)
            } else {
              alert(result.error || 'Something went wrong. Please try again.')
            }
          } catch (err) {
            alert('Something went wrong. Please try again.')
          } finally {
            btn.disabled = false
            btn.textContent = 'Send Message'
          }
        })
      });
    </script>
    ${raw(turnstileCfg ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '')}
  `
}


// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// SEED FORMS ROUTE
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

bmore.get('/seed-forms', async (c) => {
  const db = c.env.DB
  const authorId = await getAuthorId(db)

  const forms = [
    {
      id: 'form-contact',
      name: 'contact',
      display_name: 'Contact Form',
      description: 'General inquiries submitted via the Contact page',
      category: 'contact',
      icon: '📧',
      formio_schema: JSON.stringify({"components":[{"type":"textfield","key":"name","label":"Your Name","validate":{"required":true}},{"type":"email","key":"email","label":"Email Address","validate":{"required":true}},{"type":"select","key":"subject","label":"Subject","data":{"values":[{"value":"general","label":"General Inquiry"},{"value":"booking","label":"Booking Help"},{"value":"venue","label":"Venue Question"},{"value":"partnership","label":"Venue Partnership"},{"value":"feedback","label":"Feedback"}]}},{"type":"textarea","key":"message","label":"Message","validate":{"required":true}},{"type":"button","key":"submit","label":"Send Message","action":"submit"}]}),
      settings: '{}',
    },
    {
      id: 'form-venue-booking-wizard',
      name: 'venue-booking-wizard',
      display_name: 'Venue Booking Wizard',
      description: 'Venue booking requests submitted via the 6-step booking wizard',
      category: 'booking',
      icon: '🏛️',
      formio_schema: JSON.stringify({"display":"wizard","components":[{"type":"panel","key":"eventDetails","title":"Step 1: Event Details","components":[{"type":"textfield","key":"eventName","label":"Event Name","placeholder":"e.g., Marcus's 5th Birthday Party","validate":{"required":true}},{"type":"select","key":"eventType","label":"Event Type","validate":{"required":true},"data":{"values":[{"label":"Birthday Party","value":"birthday_party"},{"label":"Family Reunion","value":"family_reunion"},{"label":"Baby Shower","value":"baby_shower"},{"label":"Wedding Reception","value":"wedding_reception"},{"label":"Community Meeting","value":"community_meeting"},{"label":"Youth Group","value":"youth_group"},{"label":"Religious Gathering","value":"religious_gathering"},{"label":"Corporate Event","value":"corporate_event"},{"label":"Other","value":"other"}]}},{"type":"columns","columns":[{"width":6,"components":[{"type":"number","key":"adultCount","label":"Number of Adults","defaultValue":20,"validate":{"required":true,"min":1,"max":300}}]},{"width":6,"components":[{"type":"number","key":"childCount","label":"Number of Children","defaultValue":10}]}]}]},{"type":"panel","key":"requirements","title":"Step 2: Requirements","components":[{"type":"select","key":"alcoholRequested","label":"Alcohol Policy","data":{"values":[{"label":"No Alcohol","value":"none"},{"label":"Beer & Wine Only","value":"beer_wine"},{"label":"Full Bar","value":"full_bar"}]}},{"type":"columns","columns":[{"width":6,"components":[{"type":"checkbox","key":"needsKitchen","label":"Kitchen Access Required"}]},{"width":6,"components":[{"type":"checkbox","key":"needsGymnasium","label":"Gymnasium / Large Hall"}]}]},{"type":"textarea","key":"specialRequests","label":"Special Requests or Notes","rows":3}]},{"type":"panel","key":"venueSelection","title":"Step 3: Venue Selection","components":[{"type":"columns","columns":[{"width":6,"components":[{"type":"textfield","key":"venueName","label":"Preferred Venue Name"}]},{"width":6,"components":[{"type":"textfield","key":"venueSlug","label":"Venue Slug","tooltip":"Auto-filled when selected from the venues page"}]}]}]},{"type":"panel","key":"dateTime","title":"Step 4: Date & Time","components":[{"type":"columns","columns":[{"width":6,"components":[{"type":"datetime","key":"eventDate","label":"Event Date","format":"yyyy-MM-dd","enableTime":false,"validate":{"required":true}}]},{"width":6,"components":[{"type":"time","key":"startTime","label":"Start Time","validate":{"required":true}}]}]},{"type":"select","key":"duration","label":"Duration","validate":{"required":true},"data":{"values":[{"label":"1 Hour","value":"1"},{"label":"2 Hours","value":"2"},{"label":"3 Hours","value":"3"},{"label":"4 Hours (Half Day)","value":"4"},{"label":"6 Hours","value":"6"},{"label":"8 Hours (Full Day)","value":"8"}]}}]},{"type":"panel","key":"contactInfo","title":"Step 5: Contact Information","components":[{"type":"columns","columns":[{"width":6,"components":[{"type":"textfield","key":"contactName","label":"Your Name","validate":{"required":true}}]},{"width":6,"components":[{"type":"textfield","key":"organization","label":"Organization (optional)"}]}]},{"type":"columns","columns":[{"width":6,"components":[{"type":"email","key":"contactEmail","label":"Email Address","validate":{"required":true}}]},{"width":6,"components":[{"type":"phoneNumber","key":"contactPhone","label":"Phone Number","validate":{"required":true}}]}]}]},{"type":"panel","key":"reviewConfirm","title":"Step 6: Review & Submit","components":[{"type":"number","key":"estimatedTotal","label":"Estimated Total ($)","disabled":true,"tooltip":"Calculated automatically based on venue rate and duration"},{"type":"checkbox","key":"termsAccepted","label":"I agree to the venue rental terms and conditions","validate":{"required":true}},{"type":"button","key":"submit","label":"Submit Booking Request","action":"submit"}]}]}),
      settings: '{}',
    },
  ]

  let seeded = 0
  let updated = 0
  const now = Date.now()

  for (const form of forms) {
    const existing = await db.prepare(
      'SELECT id FROM forms WHERE name = ?'
    ).bind(form.name).first<{ id: string }>()

    if (existing) {
      // Update schema so re-running /seed-forms refreshes the wizard layout
      await db.prepare(
        'UPDATE forms SET display_name = ?, description = ?, formio_schema = ?, turnstile_enabled = 1, updated_at = ? WHERE name = ?'
      ).bind(form.display_name, form.description, form.formio_schema, now, form.name).run()
      updated++
    } else {
      await db.prepare(`
        INSERT INTO forms (id, name, display_name, description, category, icon,
          formio_schema, settings, is_active, is_public, managed, submission_count, turnstile_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 0, 1, ?, ?)
      `).bind(
        form.id, form.name, form.display_name, form.description, form.category, form.icon,
        form.formio_schema, form.settings, now, now).run()
      seeded++
    }
  }

  return c.json({ success: true, seeded, updated, message: `Forms synced: ${seeded} new, ${updated} updated` })
})
bmore.get('/seed-turnstile', async (c) => {
  const db = c.env.DB
  const settings = JSON.stringify({
    enabled: true,
    siteKey: '0x4AAAAAACmJRAjGlF1gXAj-',
    secretKey: '0x4AAAAAACmJRKUptgk1Z4zim8Ajir87TQM',
    theme: 'light',
    mode: 'managed',
    preclearance: false
  })
  try {
    const existing = await db.prepare(
      "SELECT id FROM plugins WHERE id = 'turnstile' LIMIT 1"
    ).first<{ id: string }>()
    const now = Date.now()
    if (existing) {
      // Plugin already installed - just update settings and activate it
      await db.prepare(
        "UPDATE plugins SET settings = ?, status = 'active', updated_at = ? WHERE id = 'turnstile'"
      ).bind(settings, now).run()
      return c.json({ success: true, action: 'updated', message: 'Turnstile plugin configured and activated' })
    } else {
      // Plugin not yet installed - insert full row
      await db.prepare(`
        INSERT INTO plugins (id, name, display_name, description, version, author, category, icon,
          status, is_core, settings, permissions, dependencies, installed_at, last_updated, updated_at)
        VALUES ('turnstile', 'turnstile-plugin', 'Cloudflare Turnstile', 'CAPTCHA-free bot protection for forms',
          '1.0.0', 'SonicJS', 'security', 'shield-check',
          'active', 0, ?, '[]', '[]', ?, ?, ?)
      `).bind(settings, now, now, now).run()
      return c.json({ success: true, action: 'created', message: 'Turnstile plugin installed and configured' })
    }
  } catch (err: unknown) {
    return c.json({ error: 'Failed to configure Turnstile', detail: String(err) }, 500)
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// SEED DB TABLES — creates any missing tables that SonicJS Stage 6+ migrations
// may not have run (user_profiles, activity_logs, etc.)
// Visit /seed-db-tables once if the user edit page throws a 500.
// ─────────────────────────────────────────────────────────────────────────────
bmore.get('/seed-db-tables', async (c) => {
  const db = c.env.DB
  const results: string[] = []

  const tables = [
    {
      name: 'user_profiles',
      sql: `CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT,
        bio TEXT,
        company TEXT,
        job_title TEXT,
        website TEXT,
        location TEXT,
        date_of_birth INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id)
      )`,
    },
    {
      name: 'activity_logs',
      sql: `CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      name: 'user_sessions',
      sql: `CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER
      )`,
    },
  ]

  for (const t of tables) {
    try {
      await db.prepare(t.sql).run()
      results.push(`✓ ${t.name}`)
    } catch (err) {
      results.push(`✗ ${t.name}: ${String(err)}`)
    }
  }

  // Also add any missing columns to the users table (Stage 6 ALTER TABLE)
  const userCols = [
    "ALTER TABLE users ADD COLUMN phone TEXT",
    "ALTER TABLE users ADD COLUMN bio TEXT",
    "ALTER TABLE users ADD COLUMN avatar_url TEXT",
    "ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC'",
    "ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en'",
    "ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'",
    "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
  ]
  for (const sql of userCols) {
    try {
      await db.prepare(sql).run()
      const col = sql.split('ADD COLUMN ')[1].split(' ')[0]
      results.push(`✓ users.${col}`)
    } catch {
      // Column likely already exists — that's fine
    }
  }

  return c.json({ success: true, results })
})

// Debug: show exactly what is stored in the DB for a given page slug
bmore.get('/debug-page/:slug', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const col = await db.prepare("SELECT id FROM collections WHERE name = 'pages' LIMIT 1").first<{id:string}>()
  if (!col) return c.json({ error: 'no pages collection' })
  const row = await db.prepare("SELECT id, slug, title, status, data FROM content WHERE collection_id = ? AND slug = ? LIMIT 1").bind(col.id, slug).first()
  if (!row) return c.json({ error: 'page not found', slug })
  return c.json({ id: row.id, slug: row.slug, title: row.title, status: row.status, data: JSON.parse(row.data as string) })
})

// Force-publish all pages collection content so admin edits always show up
bmore.get('/publish-pages', async (c) => {
  const db = c.env.DB
  const col = await db.prepare("SELECT id FROM collections WHERE name = 'pages' LIMIT 1").first<{id:string}>()
  if (!col) return c.json({ error: 'no pages collection' })
  const result = await db.prepare(
    "UPDATE content SET status = 'published', updated_at = ? WHERE collection_id = ? AND status = 'draft'"
  ).bind(Date.now(), col.id).run()
  return c.json({ success: true, rowsUpdated: result.meta?.changes ?? 0, message: 'All draft pages are now published' })
})

export default bmore
