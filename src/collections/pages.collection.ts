/**
 * Pages Collection
 *
 * All five public-facing pages for Family Fun in Bmore.
 * Each page is stored as a single content item identified by its slug
 * (home, venues, about, contact, book). Fields are grouped by page below.
 *
 * This collection OVERRIDES SonicJS's built-in pages collection schema so
 * that all custom content areas are editable from the admin panel.
 */

import type { CollectionConfig } from "@sonicjs-cms/core";

export default {
  name: "pages",
  displayName: "Pages",
  description: "Content for all public pages — edit hero text, FAQs, team bios, and more",
  icon: "📄",

  schema: {
    type: "object",
    properties: {

      // ── Identity (all pages) ──────────────────────────────────────────────
      title: {
        type: "string",
        title: "Title (browser tab)",
        required: true,
        maxLength: 200,
      },
      slug: {
        type: "slug",
        title: "Page Slug",
        required: true,
        maxLength: 100,
        helpText: "One of: home, venues, about, contact, book",
      },
      meta_description: {
        type: "textarea",
        title: "Meta Description (SEO)",
        maxLength: 300,
      },

      // ── Shared hero header (all pages except home) ────────────────────────
      pageHeading: {
        type: "string",
        title: "Page Heading (H1)",
        maxLength: 200,
        helpText: "Main heading shown at the top of the page",
      },
      pageSubtext: {
        type: "textarea",
        title: "Page Subtext",
        maxLength: 500,
        helpText: "Paragraph below the main heading",
      },

      // ── HOME PAGE ─────────────────────────────────────────────────────────
      heroHeading: {
        type: "string",
        title: "Home: Hero Heading",
        maxLength: 200,
        helpText: "Large headline in the orange hero banner",
      },
      heroSubtext: {
        type: "textarea",
        title: "Home: Hero Subtext",
        maxLength: 400,
        helpText: "Supporting paragraph in the hero banner",
      },
      heroCtaPrimary: {
        type: "string",
        title: "Home: Hero Primary Button Label",
        maxLength: 80,
        helpText: "White button in hero (e.g. 'Book a Space')",
      },
      heroCtaSecondary: {
        type: "string",
        title: "Home: Hero Secondary Button Label",
        maxLength: 80,
        helpText: "Outline button in hero (e.g. 'Browse Venues')",
      },

      // Stats bar
      statVenues: {
        type: "string",
        title: "Home: Stat — Venues Count",
        maxLength: 20,
        helpText: "e.g. '10+'",
      },
      statVenuesLabel: {
        type: "string",
        title: "Home: Stat — Venues Label",
        maxLength: 60,
        helpText: "e.g. 'Vetted Venues'",
      },
      statRadius: {
        type: "string",
        title: "Home: Stat — Radius",
        maxLength: 20,
        helpText: "e.g. '5 mi'",
      },
      statRadiusLabel: {
        type: "string",
        title: "Home: Stat — Radius Label",
        maxLength: 60,
        helpText: "e.g. 'Patterson Park Radius'",
      },
      statCapacity: {
        type: "string",
        title: "Home: Stat — Max Capacity",
        maxLength: 20,
        helpText: "e.g. '250'",
      },
      statCapacityLabel: {
        type: "string",
        title: "Home: Stat — Capacity Label",
        maxLength: 60,
        helpText: "e.g. 'Max Capacity'",
      },
      statPrice: {
        type: "string",
        title: "Home: Stat — Starting Price",
        maxLength: 20,
        helpText: "e.g. '$35'",
      },
      statPriceLabel: {
        type: "string",
        title: "Home: Stat — Price Label",
        maxLength: 60,
        helpText: "e.g. 'Starting Per Hour'",
      },

      // How It Works
      howItWorksHeading: {
        type: "string",
        title: "Home: How It Works — Heading",
        maxLength: 100,
      },
      howItWorksSubtext: {
        type: "textarea",
        title: "Home: How It Works — Subtext",
        maxLength: 300,
      },
      step1Title: {
        type: "string",
        title: "Home: Step 1 Title",
        maxLength: 100,
        helpText: "e.g. '1. Tell Us Your Needs'",
      },
      step1Text: {
        type: "textarea",
        title: "Home: Step 1 Description",
        maxLength: 300,
      },
      step2Title: {
        type: "string",
        title: "Home: Step 2 Title",
        maxLength: 100,
      },
      step2Text: {
        type: "textarea",
        title: "Home: Step 2 Description",
        maxLength: 300,
      },
      step3Title: {
        type: "string",
        title: "Home: Step 3 Title",
        maxLength: 100,
      },
      step3Text: {
        type: "textarea",
        title: "Home: Step 3 Description",
        maxLength: 300,
      },

      // Featured Venues section
      featuredHeading: {
        type: "string",
        title: "Home: Featured Venues — Heading",
        maxLength: 100,
      },
      featuredSubtext: {
        type: "textarea",
        title: "Home: Featured Venues — Subtext",
        maxLength: 300,
      },

      // Home CTA section
      ctaHeading: {
        type: "string",
        title: "Home: CTA Section — Heading",
        maxLength: 200,
      },
      ctaSubtext: {
        type: "textarea",
        title: "Home: CTA Section — Subtext",
        maxLength: 400,
      },
      ctaButtonPrimary: {
        type: "string",
        title: "Home: CTA Section — Primary Button",
        maxLength: 80,
        helpText: "e.g. 'Book Your Space Now'",
      },
      ctaButtonSecondary: {
        type: "string",
        title: "Home: CTA Section — Secondary Button",
        maxLength: 80,
        helpText: "e.g. 'Browse All Venues'",
      },

      // ── ABOUT PAGE ────────────────────────────────────────────────────────
      missionHeading: {
        type: "string",
        title: "About: Mission — Heading",
        maxLength: 100,
      },
      missionText: {
        type: "textarea",
        title: "About: Mission — Body Text",
        maxLength: 800,
      },
      storyHeading: {
        type: "string",
        title: "About: Our Story — Heading",
        maxLength: 100,
      },
      storyText: {
        type: "textarea",
        title: "About: Our Story — Body Text",
        maxLength: 800,
      },

      // Values section
      valueFamilyFirst: {
        type: "textarea",
        title: "About: Value — Family First",
        maxLength: 300,
        helpText: "Text under the 'Family First' value card",
      },
      valueCommunity: {
        type: "textarea",
        title: "About: Value — Community Powered",
        maxLength: 300,
        helpText: "Text under the 'Community Powered' value card",
      },
      valueTransparent: {
        type: "textarea",
        title: "About: Value — Easy & Transparent",
        maxLength: 300,
        helpText: "Text under the 'Easy & Transparent' value card",
      },

      // Patterson Park neighborhood section
      neighborhoodHeading: {
        type: "string",
        title: "About: Neighborhood — Heading",
        maxLength: 100,
      },
      neighborhoodText: {
        type: "textarea",
        title: "About: Neighborhood — Body Text",
        maxLength: 600,
      },

      // Team section
      teamHeading: {
        type: "string",
        title: "About: Team — Section Heading",
        maxLength: 100,
        helpText: "e.g. 'Built by Baltimoreans'",
      },
      teamSubtext: {
        type: "textarea",
        title: "About: Team — Section Subtext",
        maxLength: 300,
      },
      team1Name: {
        type: "string",
        title: "About: Team Member 1 — Name",
        maxLength: 100,
      },
      team1Role: {
        type: "string",
        title: "About: Team Member 1 — Role",
        maxLength: 100,
      },
      team1Bio: {
        type: "string",
        title: "About: Team Member 1 — Short Bio",
        maxLength: 200,
      },
      team2Name: {
        type: "string",
        title: "About: Team Member 2 — Name",
        maxLength: 100,
      },
      team2Role: {
        type: "string",
        title: "About: Team Member 2 — Role",
        maxLength: 100,
      },
      team2Bio: {
        type: "string",
        title: "About: Team Member 2 — Short Bio",
        maxLength: 200,
      },
      team3Name: {
        type: "string",
        title: "About: Team Member 3 — Name",
        maxLength: 100,
      },
      team3Role: {
        type: "string",
        title: "About: Team Member 3 — Role",
        maxLength: 100,
      },
      team3Bio: {
        type: "string",
        title: "About: Team Member 3 — Short Bio",
        maxLength: 200,
      },

      // About CTA banner
      aboutCtaHeading: {
        type: "string",
        title: "About: CTA Banner — Heading",
        maxLength: 200,
        helpText: "e.g. 'Ready to Find Your Space?'",
      },
      aboutCtaSubtext: {
        type: "textarea",
        title: "About: CTA Banner — Subtext",
        maxLength: 400,
      },
      aboutCtaBtnPrimary: {
        type: "string",
        title: "About: CTA Banner — Primary Button",
        maxLength: 80,
        helpText: "e.g. 'Browse Venues'",
      },
      aboutCtaBtnSecondary: {
        type: "string",
        title: "About: CTA Banner — Secondary Button",
        maxLength: 80,
        helpText: "e.g. 'Get in Touch'",
      },

      // ── CONTACT PAGE ─────────────────────────────────────────────────────
      email: {
        type: "string",
        title: "Contact: Email Address",
        maxLength: 200,
      },
      phone: {
        type: "string",
        title: "Contact: Phone Number",
        maxLength: 50,
      },
      hours: {
        type: "textarea",
        title: "Contact: Office Hours",
        maxLength: 200,
        helpText: "e.g. 'Mon-Fri: 9am - 6pm | Sat: 10am - 4pm | Sun: Closed'",
      },

      // FAQ
      faqHeading: {
        type: "string",
        title: "Contact: FAQ — Section Heading",
        maxLength: 100,
      },
      faqQ1: {
        type: "string",
        title: "Contact: FAQ 1 — Question",
        maxLength: 200,
      },
      faqBookingAdvance: {
        type: "textarea",
        title: "Contact: FAQ 1 — Answer (Booking Advance)",
        maxLength: 400,
      },
      faqQ2: {
        type: "string",
        title: "Contact: FAQ 2 — Question",
        maxLength: 200,
      },
      faqCancellation: {
        type: "textarea",
        title: "Contact: FAQ 2 — Answer (Cancellation)",
        maxLength: 400,
      },
      faqQ3: {
        type: "string",
        title: "Contact: FAQ 3 — Question",
        maxLength: 200,
      },
      faqTour: {
        type: "textarea",
        title: "Contact: FAQ 3 — Answer (Venue Tour)",
        maxLength: 400,
      },
      faqQ4: {
        type: "string",
        title: "Contact: FAQ 4 — Question",
        maxLength: 200,
      },
      faqCatering: {
        type: "textarea",
        title: "Contact: FAQ 4 — Answer (Catering)",
        maxLength: 400,
      },

    },
    required: ["title", "slug"],
  },

  listFields: ["title", "slug", "meta_description"],
  searchFields: ["title", "slug", "pageHeading", "pageSubtext"],
  defaultSort: "title",
  defaultSortOrder: "asc",

  managed: true,
  isActive: true,
} satisfies CollectionConfig;
