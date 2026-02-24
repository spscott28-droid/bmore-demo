# Family Fun in Bmore

An Airbnb-style venue booking platform for family-friendly event spaces in Baltimore. Built on [SonicJS](https://sonicjs.com) — a headless CMS powered by Cloudflare Workers.

Browse 10 venues near Patterson Park, filter by type, capacity, and amenities, and submit booking requests — all from a responsive, mobile-friendly site.

---

## Table of Contents

- [What's Included](#whats-included)
- [Prerequisites](#prerequisites)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Deploying to Cloudflare (Preview URL)](#deploying-to-cloudflare-preview-url)
- [Setting Up a Custom Domain](#setting-up-a-custom-domain)
- [Using the Admin Panel](#using-the-admin-panel)
- [How It Works](#how-it-works)
- [Making Changes](#making-changes)
- [Updating SonicJS Core](#updating-sonicjs-core)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## What's Included

| Feature | Description |
|---------|-------------|
| **Venue Listings** | 10 Baltimore venues with photos, pricing, capacity, amenities |
| **Filtering** | Filter by venue type (church, rec center, community center, library, school) |
| **Venue Details** | Full venue pages with hero images, amenities list, contact info |
| **Booking Form** | Multi-step booking wizard: event details, date/time, contact info |
| **Admin Panel** | Full content management system at `/admin` |
| **Venues Collection** | Add, edit, remove venues from the admin panel |
| **Bookings Collection** | View and manage booking requests with status tracking |
| **Auth System** | User registration, login, password reset |
| **REST API** | Full API at `/api/content` for headless/mobile access |
| **Search** | Built-in keyword search across venues and bookings |

---

## Prerequisites

You need two things installed on your computer:

### 1. Node.js (version 18 or newer)

Node.js is the runtime that powers the app. Download and install it:

- **Windows/Mac**: Go to [https://nodejs.org](https://nodejs.org) and click the big green **"LTS"** button. Run the installer.
- **Verify it's installed**: Open a terminal (or Command Prompt on Windows) and type:
  ```
  node --version
  ```
  You should see something like `v20.11.0` or higher.

### 2. A Cloudflare Account (free)

Cloudflare hosts the app. You only need a free account:

1. Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Sign up with your email
3. No credit card required — the free plan is all you need for development and preview deployments

---

## Quick Start (Local Development)

This runs the app on your own computer for testing. No deployment needed.

### Step 1: Download the code

If you received this as a zip file, unzip it to a folder on your computer.

If you're cloning from GitHub:
```bash
git clone https://github.com/mmcintosh/bmore-demo.git
cd bmore-demo
```

### Step 2: Install dependencies

Open a terminal in the `bmore-demo` folder and run:
```bash
npm install
```
This downloads all required packages. It may take 1-2 minutes. You'll see some warnings — that's normal.

### Step 3: Run the database migrations

This creates the database tables the app needs:
```bash
npm run db:migrate:local
```
You should see output showing migrations being applied. If it says "Already up to date" that's fine too.

### Step 4: Start the development server

```bash
npm run dev
```

You should see output like:
```
Ready on http://localhost:8787
```

### Step 5: Open the app

Open your web browser and go to:

| URL | What you'll see |
|-----|-----------------|
| [http://localhost:8787/bmore](http://localhost:8787/bmore) | The venue listing homepage |
| [http://localhost:8787/admin](http://localhost:8787/admin) | The admin panel (login required) |

### Step 6: Create an admin account

The first time you visit `/admin`, you'll need to create an account:

1. Go to [http://localhost:8787/admin](http://localhost:8787/admin)
2. Click **"Register"**
3. Enter your email, name, and password
4. You'll be logged in and can manage venues, bookings, and content

> **Tip**: You can also create a default admin by visiting `http://localhost:8787/auth/seed-admin` in your browser. This creates an admin with email `admin@sonicjs.com` and password `sonicjs!`

### Stopping the server

Press `Ctrl+C` in the terminal to stop the development server.

---

## Deploying to Cloudflare (Preview URL)

This puts your app live on the internet with a free URL like `bmore-demo.your-name.workers.dev`.

### Step 1: Log in to Cloudflare from the terminal

Run this command:
```bash
npx wrangler login
```
A browser window will open asking you to authorize Wrangler (the Cloudflare command-line tool). Click **"Allow"**.

### Step 2: Create a database

Your app needs a database on Cloudflare. Run:
```bash
npx wrangler d1 create bmore-db
```

You'll see output like:
```
Created D1 database 'bmore-db'
database_id = "abc123-def456-ghi789"
```

**Copy the `database_id` value** (the long string in quotes).

### Step 3: Update the config file

Open `wrangler.toml` in a text editor (Notepad, VS Code, or any editor). Find this line:

```
database_id = "YOUR_DATABASE_ID_HERE"
```

Replace `YOUR_DATABASE_ID_HERE` with the database ID you copied. For example:

```
database_id = "abc123-def456-ghi789"
```

Save the file.

### Step 4: Run the database migrations on Cloudflare

```bash
npm run db:migrate
```

This sets up all the database tables on Cloudflare's servers. You should see migrations being applied.

### Step 5: Deploy

```bash
npm run deploy
```

After a few seconds you'll see:
```
Published bmore-demo
  https://bmore-demo.your-name.workers.dev
```

**That's your live URL!** Open it in a browser. Add `/bmore` to see the venue site, or `/admin` for the admin panel.

### Step 6: Create an admin account on the live site

Visit `https://bmore-demo.your-name.workers.dev/admin` and register an account, just like you did locally.

> **Important**: The live site has its own separate database. Anything you added locally won't be on the live site — you'll need to add venues and content through the live admin panel.

---

## Setting Up a Custom Domain

Once you've purchased a domain (like `familyfuninbmore.com`), you can point it at your Cloudflare Worker.

### Option A: Domain managed by Cloudflare (easiest)

If you bought your domain through Cloudflare or transferred DNS to Cloudflare:

1. Log in to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Click your domain in the dashboard
3. Go to **Workers Routes** in the left sidebar (under Websites > your domain)
4. Click **"Add Route"**
5. Enter: `familyfuninbmore.com/*` (replace with your domain)
6. Select your Worker: **bmore-demo**
7. Click **Save**

Or use the terminal:
```bash
npx wrangler deploy --route "familyfuninbmore.com/*"
```

### Option B: Domain at another registrar (e.g., GoDaddy, Namecheap)

1. Log in to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **"Add a Site"** and enter your domain name
3. Select the **Free** plan
4. Cloudflare will scan your DNS records and give you two **nameservers** (e.g., `anna.ns.cloudflare.com`)
5. Go to your domain registrar (GoDaddy, Namecheap, etc.) and change the nameservers to the ones Cloudflare gave you
6. Wait for DNS propagation (can take up to 24-48 hours, usually much faster)
7. Once active on Cloudflare, follow Option A above to set up the Workers Route

### Verifying it works

After DNS propagates, visiting your domain should show the app. You can check propagation at [https://www.whatsmydns.net](https://www.whatsmydns.net) — enter your domain and check NS records.

---

## Using the Admin Panel

The admin panel at `/admin` gives you full control over the site content.

### Managing Venues

1. Go to `/admin` and log in
2. Click **"Content"** in the sidebar
3. Select **"Venues"** from the model filter dropdown
4. You can:
   - **Add a venue**: Click "New" > select "Venues" > fill in the form
   - **Edit a venue**: Click on any venue name to edit its details
   - **Change status**: Set a venue to "Active", "Inactive", or "Under Maintenance"
   - **Search**: Use the search bar to find venues by name, neighborhood, or address

### Managing Bookings

1. Go to **Content** > filter by **"Bookings"**
2. Booking requests submitted through the site appear here
3. You can change the **status** of each booking:
   - **Pending** — new request, not yet reviewed
   - **Confirmed** — approved and confirmed with the customer
   - **Cancelled** — cancelled by either party
   - **Completed** — event has taken place

### Adding Venue Photos

Currently the venues use Unsplash stock photos. To use your own photos:

1. Edit a venue in the admin panel
2. Update the **"Image URL"** and **"Hero Image URL"** fields with URLs to your own images
3. For hosting images, you can use free services like:
   - [Imgur](https://imgur.com) — upload and get a direct link
   - [Cloudinary](https://cloudinary.com) — free tier with 25GB storage
   - [imgbb](https://imgbb.com) — simple image hosting

> **Tip**: For best results, use images that are at least 1200x600 pixels for hero images and 600x400 for card thumbnails.

---

## How It Works

This app is built on **SonicJS**, a headless content management system. Here's what each part does:

```
bmore-demo/
├── src/
│   ├── index.ts              <- Main entry point (wires everything together)
│   ├── bmore/
│   │   ├── routes.ts         <- The venue listing pages (what visitors see)
│   │   ├── layout.ts         <- HTML layout wrapper (header, footer, styles)
│   │   └── venue-data.ts     <- Seed data: 10 Baltimore venues
│   └── collections/
│       ├── venues.collection.ts    <- Venue data model (fields, validation)
│       └── bookings.collection.ts  <- Booking data model
├── wrangler.toml             <- Cloudflare deployment config
├── package.json              <- Project dependencies and scripts
├── tsconfig.json             <- TypeScript configuration
└── sonicjs-cms-core-*.tgz    <- The SonicJS CMS engine (bundled)
```

**SonicJS provides** (you get all of this automatically):
- Admin panel with content editing UI
- Database with automatic migrations
- REST API for reading/writing content
- User authentication (login, registration)
- Search across all content

**Your custom code** (the `bmore/` folder):
- The public-facing venue pages
- The booking form
- The visual design and layout
- The 10 seed venues

---

## Making Changes

### Changing venue data or adding fields

To add a new field to venues (e.g., "WiFi Password"):

1. Open `src/collections/venues.collection.ts`
2. Add a new property to the `properties` object:
   ```typescript
   wifiPassword: {
     type: "string",
     title: "WiFi Password",
   },
   ```
3. Restart the dev server (`Ctrl+C` then `npm run dev`)
4. The new field will appear in the admin panel's venue edit form

### Changing the site appearance

The visual design lives in `src/bmore/layout.ts` (the HTML wrapper with CSS) and `src/bmore/routes.ts` (the page content). Both are standard HTML/CSS — edit them with any text editor.

### Adding a new page

In `src/bmore/routes.ts`, add a new route:
```typescript
app.get('/about', (c) => {
  const content = `<h1>About Us</h1><p>Your content here...</p>`
  return c.html(renderLayout(content, 'About'))
})
```
The page will be available at `/bmore/about`.

---

## Updating SonicJS Core

The SonicJS engine is bundled as `sonicjs-cms-core-2.8.0.tgz` in the project root. To update it when a new version is available:

1. Obtain the new `.tgz` file (ask Mark for the latest build)
2. Copy it into the project folder, replacing the old one
3. Update the filename in `package.json`:
   ```json
   "@sonicjs-cms/core": "file:./sonicjs-cms-core-NEW_VERSION.tgz"
   ```
4. Run `npm install` to apply the update
5. Run `npm run db:migrate:local` (new versions may include database updates)
6. If deployed, also run `npm run db:migrate` and `npm run deploy`

---

## Project Structure

| File/Folder | Purpose |
|-------------|---------|
| `src/index.ts` | App entry point — registers collections, mounts routes |
| `src/bmore/routes.ts` | All public pages: venue list, venue detail, booking form |
| `src/bmore/layout.ts` | HTML template wrapper (header, navigation, footer, CSS) |
| `src/bmore/venue-data.ts` | 10 Baltimore venues with addresses, pricing, photos |
| `src/collections/venues.collection.ts` | Venue data schema (fields the admin panel shows) |
| `src/collections/bookings.collection.ts` | Booking data schema |
| `wrangler.toml` | Cloudflare config: database, environment, settings |
| `package.json` | Dependencies and npm scripts |
| `tsconfig.json` | TypeScript compiler settings |
| `sonicjs-cms-core-*.tgz` | The SonicJS CMS engine (bundled package) |

---

## Troubleshooting

### "command not found: npm" or "command not found: node"

Node.js isn't installed or isn't in your PATH. Download it from [https://nodejs.org](https://nodejs.org) and restart your terminal after installing.

### "Error: D1_ERROR: no such table"

The database migrations haven't been run. Run:
- Locally: `npm run db:migrate:local`
- On Cloudflare: `npm run db:migrate`

### "Error: database_id is required"

You forgot to update `wrangler.toml` with your database ID. See [Step 3 of deploying](#step-3-update-the-config-file).

### The admin panel shows "Unauthorized" or login fails

Make sure you've created an account. Visit `/admin` and click "Register" to create a new account. Or seed a default admin by visiting `/auth/seed-admin`.

### Changes I made locally don't appear on the live site

Local and live are separate environments with separate databases. To update the live site:
1. If you changed code: run `npm run deploy`
2. If you changed content in the admin: you need to make the same changes in the live admin panel (content is per-database)

### The site loads but venue images are broken

The venues use Unsplash stock photos. If they're not loading, Unsplash may be temporarily down or blocking requests. This won't affect real photos you add yourself.

### "Error: workers.dev subdomain not enabled"

Run `npx wrangler whoami` to verify you're logged in, then try `npm run deploy` again. If it persists, go to [https://dash.cloudflare.com](https://dash.cloudflare.com) > Workers & Pages > Settings and enable the workers.dev subdomain.

### I need help

Contact Mark at the email address you have on file. Include:
- What you were trying to do
- The exact error message (screenshot is best)
- Whether this is on your local machine or the live site

---

## Available Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start local development server at http://localhost:8787 |
| `npm run deploy` | Deploy to Cloudflare (makes it live on the internet) |
| `npm run db:migrate:local` | Set up database tables locally |
| `npm run db:migrate` | Set up database tables on Cloudflare |

---

## Tech Stack

- **[SonicJS](https://sonicjs.com)** — Headless CMS with admin panel, REST API, and auth
- **[Cloudflare Workers](https://workers.cloudflare.com)** — Serverless hosting (runs in 300+ data centers worldwide)
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** — SQLite database at the edge
- **[Hono](https://hono.dev)** — Fast, lightweight web framework
- **[TypeScript](https://www.typescriptlang.org)** — JavaScript with type safety

---

*Built with SonicJS by Mark McIntosh*
