# TSOGO-BIS

TSOGO-BIS is a multilingual online storefront built with React and Vite. It uses Supabase for authentication, catalog and order data, storage, and server-side checkout and payment workflows.

## Project areas

### Customer-facing site

- `src/pages/` contains the homepage, shop, product details, checkout, orders, tracking, account, contact, logistics, and policy pages.
- `src/components/` contains shared storefront elements such as navigation, product cards, cart, footer, and dialogs.
- `src/context/` contains shared session, cart, currency, settings, admin, and modal state.
- `src/styles/` contains page and component styles.
- `src/i18n/` contains English, French, and Chinese translations.

### Administration

- `src/admin/` contains catalog, category, order, user, review, referral, shipment, analytics, and settings screens.
- `src/pages/AdminApp.jsx` assembles the admin workspace.

### Backend and infrastructure

- `supabase/functions/` contains Edge Functions for account operations, payment checkout and verification, email, currency, and admin management.
- `supabase/migrations/` contains incremental database changes. Apply migrations to an existing database in timestamp order.
- `supabase/schema-v2.sql` is a fresh-database schema blueprint; it is not an in-place migration for an existing database.
- `public/` contains static images, icons, `robots.txt`, and the development `llms.txt`.
- `scripts/prerender.mjs` writes crawlable route HTML, product snapshots, the XML sitemap, and the deployed `llms.txt` after the Vite build.
- `docs/website-pages.md` documents the routes, indexing rules, and SEO deployment workflow.

## Requirements

- Node.js compatible with Vite 7
- npm
- Supabase project credentials for local development and product-page prerendering

Create a local `.env` file with the public client settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY
VITE_SITE_URL=https://your-production-domain.example
```

`VITE_SITE_URL` should be the preferred HTTPS origin without a trailing slash. The build also accepts `SITE_URL`. The prerender step uses the public Supabase key only to read published products; it does not require or use a service-role key. If public Supabase settings are missing, the build still creates static public route snapshots, but it cannot enumerate live product URLs for the sitemap.

## Local development

```bash
npm install
npm run dev
```

The customer storefront runs at the Vite development URL. Admin features and Supabase-backed customer flows require the corresponding Supabase schema, policies, functions, and project secrets.

## Production build

```bash
npm run build
npm run preview
```

The build first produces the Vite bundle, then prerenders route HTML into `dist/`. It emits `sitemap.xml`, a deployment-specific `robots.txt` and `llms.txt`, and one HTML snapshot for each published product returned by Supabase. Set `VITE_SITE_URL` (or `SITE_URL`) in the deployment environment so canonical URLs and discovery files use the production domain.

Vercel route rewrites are in `vercel.json`. Static route snapshots support direct visits and crawlers; the React application still starts on each route for normal interactive behavior.

## SEO and indexing

- Public editorial and catalog pages have route-specific titles, descriptions, canonicals, Open Graph tags, and prerendered semantic content.
- Published products are fetched from the public catalog at build time and receive product-specific snapshots and Product structured data.
- Account, checkout, order, payment-return, tracking, referral, and admin pages are excluded from the sitemap and marked `noindex` where appropriate.
- `robots.txt` points crawlers to the generated sitemap. `llms.txt` summarizes the public storefront and links to public pages.
- Build and deploy the site, then submit `https://YOUR_DOMAIN/sitemap.xml` in Google Search Console and inspect key URLs. Sitemap submission and prerendering help discovery; neither guarantees that a search engine will index a URL.

## Supabase setup

See `supabase/FAPSHI_SETUP.md` for payment deployment and secrets. For a new database, review `supabase/schema-v2.sql` first. For the existing project, apply the relevant timestamped migrations and deploy the matching Edge Functions. Keep service-role and payment-provider credentials in Supabase secrets, never in Vite client variables.

## Available scripts

- `npm run dev` — start Vite development server.
- `npm run build` — build the app and prerender SEO pages and discovery files.
- `npm run preview` — serve the built output locally.
- `npm run lint` — run ESLint.
