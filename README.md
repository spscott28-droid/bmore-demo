# Family Fun in Bmore

An Airbnb-style venue booking platform for family-friendly event spaces in Baltimore. Built on [SonicJS](https://sonicjs.com) — a headless CMS powered by Cloudflare Workers.

Browse 10 venues near Patterson Park, filter by type, capacity, and amenities, and submit booking requests — all from a responsive, mobile-friendly site.

**Origin**: This project is built on SonicJS CMS. The upstream source is at [github.com/mmcintosh/sonicjs](https://github.com/mmcintosh/sonicjs).

---

## What Is This?

This is a complete web application that lets families in Baltimore find and book community event spaces — church halls, recreation centers, libraries, and more — all near Patterson Park. It includes:

- A public website with venue listings, detail pages, a multi-step booking wizard, and a contact form
- An admin panel where you can manage venues, view bookings, and edit content
- A database that stores everything (venues, bookings, contact submissions)
- A REST API for programmatic access

The whole thing runs on Cloudflare Workers, meaning it's fast, free to host for small traffic, and deploys in seconds.

---

## What You Need

### 1. Node.js (version 18 or newer)

Node.js runs the app. Download and install it:

- **Windows/Mac**: Go to [https://nodejs.org](https://nodejs.org) and click the big green **"LTS"** button. Run the installer.
- **Linux**: Use your package manager (e.g., `sudo apt install nodejs npm`)

**Check if it's installed** — open a terminal (Command Prompt or PowerShell on Windows, Terminal on Mac) and type:
```
node --version
```
You should see something like `v20.11.0` or higher. If you get "command not found", restart your terminal after installing Node.js.

### 2. A Cloudflare Account (free)

Cloudflare hosts the app on the internet. You only need a free account:

1. Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Sign up with your email
3. No credit card required

---

## Getting Started (Local Development)

This runs the app on your own computer for testing. Nothing goes on the internet.

### Step 1: Install dependencies

Open a terminal in the `bmore-demo` folder:
- **Windows**: Open the folder in File Explorer, click the address bar, type `cmd` and press Enter. Or right-click in the folder and choose "Open in Terminal".
- **Mac**: Open Terminal, then drag the folder onto the Terminal icon (or `cd` to it).

Then run:
```bash
npm install
```
This downloads all required packages. It may take a minute. You'll see some warnings — that's normal.

### Step 2: Set up the local database

```bash
npm run db:migrate:local
```
You should see output showing migrations being applied.

### Step 3: Start the development server

```bash
npm run dev
```

You should see:
```
Ready on http://localhost:8787
```

### Step 4: Open the app and seed venue data

Open your browser and visit these URLs in order:

| Step | URL | What happens |
|------|-----|--------------|
| 1 | [http://localhost:8787](http://localhost:8787) | Homepage loads (venue list may be empty) |
| 2 | [http://localhost:8787/seed](http://localhost:8787/seed) | Seeds 10 venues into the database. You'll see `{"success":true,"message":"Seeded 10 venues"}` |
| 3 | [http://localhost:8787](http://localhost:8787) | Refresh — venues now display from the database |
| 4 | [http://localhost:8787/admin](http://localhost:8787/admin) | Admin panel — create your admin account here |

### Step 5: Create an admin account

1. Go to [http://localhost:8787/admin](http://localhost:8787/admin)
2. Click **"Register"**
3. Enter your email, name, and password
4. You'll be logged in and can manage venues and bookings

> **Shortcut**: Visit `http://localhost:8787/auth/seed-admin` to create a default admin with email `admin@sonicjs.com` and password `sonicjs!`

### Stopping the server

Press `Ctrl+C` in the terminal.

---

## Deploying to the Internet (Preview)

This puts your app live on the internet with a free URL like `bmore-demo.your-name.workers.dev`.

### Step 1: Log in to Cloudflare

```bash
npx wrangler login
```
A browser window will open. Click **"Allow"** to authorize.

### Step 2: Create a database on Cloudflare

```bash
npx wrangler d1 create bmore-db
```

You'll see output like:
```
Created D1 database 'bmore-db'
database_id = "abc123-def456-ghi789"
```

**Copy the `database_id` value** (the long string in quotes).

### Step 3: Update wrangler.toml

Open `wrangler.toml` in a text editor. Find this line:

```
database_id = "YOUR_DATABASE_ID_HERE"
```

Replace `YOUR_DATABASE_ID_HERE` with the ID you copied:

```
database_id = "abc123-def456-ghi789"
```

Save the file.

### Step 4: Run database migrations on Cloudflare

```bash
npm run db:migrate
```

### Step 5: Deploy

```bash
npm run deploy
```

You'll see:
```
Published bmore-demo
  https://bmore-demo.your-name.workers.dev
```

### Step 6: Seed and set up

Visit these URLs (replace with your actual URL):

1. `https://bmore-demo.your-name.workers.dev/seed` — seeds the 10 venues
2. `https://bmore-demo.your-name.workers.dev/admin` — create your admin account
3. `https://bmore-demo.your-name.workers.dev` — your live site!

> **Important**: The live site has its own separate database. Content you added locally won't appear on the live site — you need to seed and set up separately.

---

## Adding a Custom Domain

Once you have a domain (like `familyfuninbmore.com`), you can point it at your app.

### If your domain is on Cloudflare (easiest)

1. Open `wrangler.toml`
2. In the `[env.production]` section, uncomment and update the routes line:
   ```toml
   routes = [{ pattern = "familyfuninbmore.com/*", zone_name = "familyfuninbmore.com" }]
   ```
3. Deploy to production:
   ```bash
   npm run deploy:production
   ```

### If your domain is at another registrar (GoDaddy, Namecheap, etc.)

1. Log in to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **"Add a Site"** and enter your domain
3. Select the **Free** plan
4. Cloudflare will give you two **nameservers** (e.g., `anna.ns.cloudflare.com`)
5. Go to your registrar and change the nameservers to the ones Cloudflare gave you
6. Wait for DNS to propagate (usually minutes, can take up to 48 hours)
7. Once active, follow the steps above to update `wrangler.toml` and deploy

You can check DNS propagation at [https://www.whatsmydns.net](https://www.whatsmydns.net).

---

## Using the Admin Panel

The admin panel at `/admin` gives you full control over the site.

### Managing Venues

1. Go to `/admin` and log in
2. Click **"Content"** in the sidebar
3. Filter by **"Venues"**
4. You can add, edit, or change the status of any venue

### Viewing Bookings

1. Go to **Content** > filter by **"Bookings"**
2. Booking and contact form submissions appear here
3. Click any item to see full details

### Adding Your Own Venue Photos

The default venues use Unsplash stock photos. To use your own:

1. Edit a venue in the admin panel
2. Update the **Image URL** and **Hero Image URL** fields
3. For free image hosting, try [Imgur](https://imgur.com), [Cloudinary](https://cloudinary.com), or [imgbb](https://imgbb.com)

---

## Updating SonicJS

The SonicJS engine is bundled as `sonicjs-cms-core-*.tgz` in the project root.

To update when a new version is available:

1. Get the new `.tgz` file
2. Copy it into the project folder, replacing the old one
3. Update the filename in `package.json`:
   ```json
   "@sonicjs-cms/core": "file:./sonicjs-cms-core-NEW_VERSION.tgz"
   ```
4. Run:
   ```bash
   npm install
   npm run db:migrate:local    # locally
   npm run db:migrate           # on Cloudflare
   npm run deploy               # redeploy
   ```

---

## Project Structure

```
bmore-demo/
├── src/
│   ├── index.ts                 ← Main entry point
│   ├── bmore/
│   │   ├── routes.ts            ← Public pages (venues, booking, contact)
│   │   ├── layout.ts            ← HTML layout (header, footer, styles)
│   │   └── venue-data.ts        ← Seed data: 10 Baltimore venues
│   └── collections/
│       ├── venues.collection.ts  ← Venue data model
│       └── bookings.collection.ts← Booking data model
├── wrangler.toml                ← Cloudflare config
├── package.json                 ← Dependencies and scripts
├── tsconfig.json                ← TypeScript config
└── sonicjs-cms-core-*.tgz       ← SonicJS CMS engine (bundled)
```

---

## Available Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start local dev server at http://localhost:8787 |
| `npm run deploy` | Deploy to Cloudflare (default environment) |
| `npm run deploy:preview` | Deploy to preview environment |
| `npm run deploy:production` | Deploy to production (custom domain) |
| `npm run db:migrate:local` | Run database migrations locally |
| `npm run db:migrate` | Run database migrations on Cloudflare |
| `npm run db:migrate:preview` | Run migrations for preview environment |
| `npm run db:migrate:production` | Run migrations for production environment |

---

## Troubleshooting

### "command not found: npm" or "command not found: node"

Node.js isn't installed. Download it from [https://nodejs.org](https://nodejs.org) and restart your terminal.

### "Error: D1_ERROR: no such table"

Database migrations haven't been run:
- Locally: `npm run db:migrate:local`
- On Cloudflare: `npm run db:migrate`

### "Error: database_id is required"

You need to update `wrangler.toml` with your database ID. See [Step 3 of deploying](#step-3-update-wranglertoml).

### The seed route says "Venues collection not found"

The admin panel needs to be visited at least once to initialize collections, or migrations haven't been run. Run `npm run db:migrate:local` (or `npm run db:migrate` for Cloudflare) and try again.

### The admin panel shows "Unauthorized"

Create an account first. Visit `/admin` and click "Register", or visit `/auth/seed-admin` for a default admin.

### Changes I made locally don't appear on the live site

Local and live are separate environments with separate databases:
- Code changes: run `npm run deploy`
- Content changes: make them again in the live admin panel

### Images not loading

The venues use Unsplash stock photos. If they're broken, Unsplash may be down temporarily. Your own photos won't be affected.

### I need help

Contact Mark. Include:
- What you were trying to do
- The exact error message (a screenshot is best)
- Whether this is local or the live site

---

## Tech Stack

- **[SonicJS](https://sonicjs.com)** — Headless CMS ([source](https://github.com/mmcintosh/sonicjs))
- **[Cloudflare Workers](https://workers.cloudflare.com)** — Serverless hosting
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** — SQLite database at the edge
- **[Hono](https://hono.dev)** — Lightweight web framework
- **[TypeScript](https://www.typescriptlang.org)** — Type-safe JavaScript

---

*Built with SonicJS by Mark McIntosh*
