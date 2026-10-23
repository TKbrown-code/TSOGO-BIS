# Website pages and search-indexing map

This document describes the customer-facing routes in `src/App.jsx`, their purpose, and how the production build exposes them to crawlers. The static snapshots are created by `scripts/prerender.mjs`; the React application continues to provide interactive route behavior after load.

## Public, indexable pages

| URL | Page | Search purpose |
| --- | --- | --- |
| `/` | Home | Store introduction and links to the catalog and support pages. |
| `/shop` | Shop | Public product catalog entry point. |
| `/ProductDetails/:id/:name` | Product details | Product-specific description, canonical URL, and Product structured data for published products present at build time. |
| `/about` | About | Store information. |
| `/contact` | Contact | Customer support contact information. |
| `/logistics` | Logistics | Delivery and tracking guidance. |
| `/terms-and-policies` | Terms and policies | Store policies. |

Static pages include route-specific titles, descriptions, canonical links, Open Graph metadata, and semantic prerendered content. Product pages also include JSON-LD `Product` and `Offer` data. Product snapshots and sitemap URLs are refreshed on each production build from the public Supabase catalog. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` in the build environment to enable that product lookup.

## Functional pages excluded from search results

| URL | Reason |
| --- | --- |
| `/checkout` | Transaction flow, not a landing page. |
| `/orders` | Customer-specific order data. |
| `/dashboard` | Account-only content. |
| `/SignUp` | Authentication flow. |
| `/reset-password` | Account recovery flow. |
| `/track` and `/track/:trackingId` | Tracking form and order-specific shipment details. |
| `/fapshi` | Payment-provider return route. |
| `/admin/*` | Private administration screens. |
| `/referrals/:encodedUserId/:userIdPrefix` | Referral attribution URL; canonicalized to the home page and excluded from sitemap. |

These route shells use `noindex` metadata. The sitemap does not list them. `robots.txt` allows crawling so search engines can read the `noindex` instruction; it does not replace authentication or authorization.

## Discovery files

- `/robots.txt` allows crawlers and names the current sitemap URL.
- `/sitemap.xml` lists the public storefront pages and published product detail URLs available at build time.
- `/llms.txt` summarizes the site and links to public pages and the sitemap for LLM-oriented discovery.

Set `VITE_SITE_URL` or `SITE_URL` to the production HTTPS origin before building. The default fallback is `https://tsogo-bis.vercel.app` based on the existing payment-return configuration. Deploy the resulting `dist/` output, then submit `/sitemap.xml` in Google Search Console. Search engines decide independently which pages they index and when.

## Route prerendering

`npm run build` runs `vite build` followed by `node scripts/prerender.mjs`. The prerender step writes route-specific HTML shells into `dist/`, including semantic content before JavaScript runs, and keeps the generated Vite asset tags so each snapshot boots the same React application. Vercel rewrites in `vercel.json` map direct public and dynamic route requests to these snapshots.

Product route snapshots require Supabase build credentials and published product rows readable with the anon key. If the lookup is unavailable, the build emits the static public pages and logs a warning; rerun the build after restoring public catalog access to refresh product snapshots and sitemap entries.
