/**
 * Shared layout for Family Fun in Bmore
 *
 * Provides consistent nav, footer, styling, and meta tags across all pages
 */

import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'

export function bmoreLayout(title: string, content: HtmlEscapedString, options?: { activeNav?: string }) {
  const active = options?.activeNav || ''

  const navLink = (href: string, label: string, key: string) => {
    const isActive = active === key
    const cls = isActive
      ? 'text-orange-500 font-semibold'
      : 'text-gray-600 hover:text-orange-500'
    return html`<a href="${href}" class="${cls} transition-colors duration-200">${label}</a>`
  }

  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Family Fun in Bmore</title>
  <meta name="description" content="Book family-friendly event spaces in Baltimore — churches, recreation centers, and community spaces near Patterson Park.">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            orange: {
              50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
              400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
              800: '#9a3412', 900: '#7c2d12', 950: '#431407',
            },
            teal: {
              50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
              400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
              800: '#115e59', 900: '#134e4a', 950: '#042f2e',
            },
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            display: ['Poppins', 'system-ui', 'sans-serif'],
          },
        },
      },
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; }
    .font-display { font-family: 'Poppins', system-ui, sans-serif; }
    .hero-gradient { background: linear-gradient(135deg, #431407 0%, #7c2d12 30%, #c2410c 70%, #f97316 100%); }
    .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.12); }
    .step-active { background: #f97316; color: white; }
    .step-completed { background: #14b8a6; color: white; }
    .step-pending { background: #e5e7eb; color: #6b7280; }
    .venue-pin { background: #f97316; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .booking-step { display: none; }
    .booking-step.active { display: block; }
  </style>
</head>
<body class="min-h-screen bg-gray-50 flex flex-col">
  <!-- Navigation -->
  <nav class="bg-white shadow-sm sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <a href="/" class="flex items-center gap-2">
          <span class="text-2xl">🎉</span>
          <span class="font-display font-bold text-xl text-gray-900">Family Fun</span>
          <span class="font-display font-bold text-xl text-orange-500">in Bmore</span>
        </a>

        <!-- Desktop Nav -->
        <div class="hidden md:flex items-center gap-8">
          ${navLink('/', 'Home', 'home')}
          ${navLink('/venues', 'Venues', 'venues')}
          ${navLink('/book', 'Book a Space', 'book')}
          ${navLink('/about', 'About', 'about')}
          ${navLink('/contact', 'Contact', 'contact')}
        </div>

        <!-- CTA Button -->
        <a href="/book" class="hidden md:inline-flex items-center px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-sm">
          Book Now
        </a>

        <!-- Mobile menu button -->
        <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100" onclick="document.getElementById('mobile-menu').classList.toggle('hidden')">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Nav -->
    <div id="mobile-menu" class="hidden md:hidden border-t border-gray-100 bg-white">
      <div class="px-4 py-3 space-y-3">
        <a href="/" class="block text-gray-700 hover:text-orange-500">Home</a>
        <a href="/venues" class="block text-gray-700 hover:text-orange-500">Venues</a>
        <a href="/book" class="block text-gray-700 hover:text-orange-500">Book a Space</a>
        <a href="/about" class="block text-gray-700 hover:text-orange-500">About</a>
        <a href="/contact" class="block text-gray-700 hover:text-orange-500">Contact</a>
        <a href="/book" class="block bg-orange-500 text-white text-center py-2 rounded-lg font-semibold">Book Now</a>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="flex-1">
    ${content}
  </main>

  <!-- Footer -->
  <footer class="bg-gray-900 text-gray-300 mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <!-- Brand -->
        <div class="md:col-span-1">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-2xl">🎉</span>
            <span class="font-display font-bold text-lg text-white">Family Fun in Bmore</span>
          </div>
          <p class="text-gray-400 text-sm leading-relaxed">
            Connecting Baltimore families with amazing community spaces for celebrations,
            gatherings, and events near Patterson Park.
          </p>
        </div>

        <!-- Quick Links -->
        <div>
          <h4 class="font-semibold text-white mb-4">Quick Links</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="/venues" class="hover:text-orange-400 transition-colors">Browse Venues</a></li>
            <li><a href="/book" class="hover:text-orange-400 transition-colors">Book a Space</a></li>
            <li><a href="/about" class="hover:text-orange-400 transition-colors">About Us</a></li>
            <li><a href="/contact" class="hover:text-orange-400 transition-colors">Contact</a></li>
          </ul>
        </div>

        <!-- Venue Types -->
        <div>
          <h4 class="font-semibold text-white mb-4">Venue Types</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="/venues?type=church" class="hover:text-orange-400 transition-colors">Church Halls</a></li>
            <li><a href="/venues?type=rec_center" class="hover:text-orange-400 transition-colors">Recreation Centers</a></li>
            <li><a href="/venues?type=community_center" class="hover:text-orange-400 transition-colors">Community Centers</a></li>
            <li><a href="/venues?type=library" class="hover:text-orange-400 transition-colors">Libraries</a></li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <h4 class="font-semibold text-white mb-4">Get in Touch</h4>
          <ul class="space-y-2 text-sm">
            <li class="flex items-center gap-2">
              <span>📍</span> Patterson Park area, Baltimore MD
            </li>
            <li class="flex items-center gap-2">
              <span>📧</span> <a href="mailto:hello@familyfuninbmore.com" class="hover:text-orange-400 transition-colors">hello@familyfuninbmore.com</a>
            </li>
            <li class="flex items-center gap-2">
              <span>📞</span> (410) 555-FUN1
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p class="text-gray-500 text-sm">&copy; 2026 Family Fun in Bmore. All rights reserved.</p>
        <p class="text-gray-600 text-xs">Powered by <a href="https://sonicjs.com" class="text-teal-400 hover:text-teal-300">SonicJS</a> — The Edge-Native Headless CMS</p>
      </div>
    </div>
  </footer>
</body>
</html>`
}
