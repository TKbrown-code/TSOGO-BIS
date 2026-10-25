import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const env = loadEnv(process.env.MODE || "production", root, "");
const siteUrl = (process.env.SITE_URL || env.VITE_SITE_URL || env.APP_URL || "https://tsogobis.com").replace(/\/$/, "");

const publicPages = [
  { path: "/track", title: "Suivre une commande | TSOGO-BIS", description: "Saisissez votre numero de suivi TSOGO-BIS pour consulter les informations de livraison.", heading: "Suivre une commande", body: "Saisissez votre numero de suivi TSOGO-BIS pour consulter le statut et les informations de livraison de votre commande au Cameroun.", links: [["Livraison", "/logistics"], ["Boutique", "/shop"], ["Nous contacter", "/contact"]], priority: "0.5" },
  { path: "/SignUp", title: "Connexion ou inscription | TSOGO-BIS", description: "Connectez-vous ou creez un compte TSOGO-BIS.", heading: "Connexion ou inscription", body: "Connectez-vous a votre compte TSOGO-BIS ou creez-en un nouveau pour commander et suivre vos achats.", links: [["Accueil", "/"], ["Boutique", "/shop"], ["Nous contacter", "/contact"]], priority: "0.3" },
  { path: "/", title: "TSOGO-BIS | Boutique en ligne au Cameroun", description: "Decouvrez la boutique en ligne TSOGO-BIS au Cameroun. Parcourez notre catalogue, trouvez des produits pour votre quotidien et commandez en ligne.", heading: "Bienvenue chez TSOGO-BIS", body: "TSOGO-BIS vous propose une boutique en ligne pour parcourir une selection de produits, consulter leurs details et passer commande avec livraison au Cameroun.", links: [["Voir la boutique", "/shop"], ["A propos de TSOGO-BIS", "/about"], ["Livraison", "/logistics"], ["Nous contacter", "/contact"]], priority: "1.0" },
  { path: "/shop", title: "Boutique en ligne | TSOGO-BIS", description: "Parcourez le catalogue TSOGO-BIS, decouvrez les produits disponibles et consultez leurs prix et details.", heading: "La boutique TSOGO-BIS", body: "Explorez le catalogue en ligne. Ouvrez une fiche produit pour consulter sa description, son prix, ses options et sa disponibilite.", links: [["Accueil", "/"], ["A propos", "/about"], ["Livraison", "/logistics"]], priority: "0.9" },
  { path: "/about", title: "A propos | TSOGO-BIS", description: "En savoir plus sur TSOGO-BIS, sa boutique en ligne et son service client.", heading: "A propos de TSOGO-BIS", body: "TSOGO-BIS est une boutique en ligne qui permet aux clients de decouvrir le catalogue, commander et suivre la livraison de leurs achats.", links: [["Parcourir la boutique", "/shop"], ["Nous contacter", "/contact"]], priority: "0.6" },
  { path: "/contact", title: "Contact | TSOGO-BIS", description: "Contactez TSOGO-BIS pour une question sur les produits, une commande ou une livraison.", heading: "Contacter TSOGO-BIS", body: "L'equipe TSOGO-BIS peut vous aider pour les questions relatives au catalogue, aux commandes et a la livraison. Consultez les coordonnees disponibles sur la page Contact.", links: [["Boutique", "/shop"], ["Livraison", "/logistics"]], priority: "0.6" },
  { path: "/logistics", title: "Livraison et logistique | TSOGO-BIS", description: "Informations TSOGO-BIS sur l'expedition, la livraison et le suivi des commandes au Cameroun.", heading: "Livraison et logistique", body: "Consultez les informations de livraison TSOGO-BIS et utilisez le suivi de commande pour voir les mises a jour d'expedition lorsqu'un numero de suivi est disponible.", links: [["Suivre une commande", "/track"], ["Boutique", "/shop"], ["Contact", "/contact"]], priority: "0.6" },
  { path: "/terms-and-policies", title: "Conditions et politiques | TSOGO-BIS", description: "Consultez les conditions d'utilisation, les politiques et les informations legales de TSOGO-BIS.", heading: "Conditions et politiques", body: "Cette page regroupe les conditions et politiques applicables a l'utilisation de la boutique en ligne TSOGO-BIS.", links: [["Accueil", "/"], ["Contact", "/contact"]], priority: "0.3" },
];

const noIndexPages = [
  ["/checkout", "Finaliser une commande", "Connectez-vous et passez en revue votre panier pour finaliser votre commande TSOGO-BIS."],
  ["/orders", "Mes commandes", "Consultez vos commandes TSOGO-BIS."],
  ["/dashboard", "Mon compte", "Gerez votre compte TSOGO-BIS."],
  ["/reset-password", "Reinitialiser le mot de passe", "Reinitialisez le mot de passe de votre compte TSOGO-BIS."],
  ["/referrals", "Programme de parrainage", "Decouvrez TSOGO-BIS depuis un lien de parrainage."],
  ["/fapshi", "Paiement", "Retour de paiement TSOGO-BIS."],
  ["/admin", "Administration", "Espace d'administration TSOGO-BIS."],
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function pageHtml(template, { pagePath, canonicalPath: canonicalPathOverride, title, description, content, robots = "index,follow,max-image-preview:large", structuredData, image = `${siteUrl}/tsogobislogo.jpg` }) {
  const canonicalPath = canonicalPathOverride || (pagePath === "/referrals" ? "/" : pagePath);
  const canonical = `${siteUrl}${canonicalPath === "/" ? "/" : canonicalPath}`;
  const metadata = `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="TSOGO-BIS"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><style>html,body{min-height:100%;margin:0;background:#f3f1eb}.seo-prerender{min-height:100vh;display:grid;place-items:center;box-sizing:border-box;padding:clamp(24px,7vw,88px);background:radial-gradient(ellipse at top,#fffefa 0,#f3f1eb 72%);color:#20372e;font-family:Arial,Helvetica,sans-serif}.seo-prerender main{width:min(100%,780px);box-sizing:border-box;padding:clamp(28px,6vw,64px);border:1px solid #e5dfd3;border-radius:16px;background:rgba(255,254,250,.94);box-shadow:0 18px 60px rgba(30,52,43,.08)}.seo-prerender h1{max-width:720px;margin:0 0 20px;font:500 clamp(34px,7vw,64px)/1.05 Georgia,'Times New Roman',serif;letter-spacing:-.035em}.seo-prerender p{max-width:650px;margin:0 0 14px;color:#626d64;font-size:clamp(15px,2.4vw,18px);line-height:1.7}.seo-prerender nav{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:28px}.seo-prerender a{color:#1e342b;font-size:14px;font-weight:600;text-decoration:none;border-bottom:1px solid #b99d78;padding-bottom:3px}.seo-prerender a:focus-visible{outline:2px solid #a48762;outline-offset:4px}</style>${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>` : ""}`;
  const stripped = template.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta\s+name="description"[^>]*>/i, "").replace(/<meta\s+name="robots"[^>]*>/i, "").replace(/<link\s+rel="canonical"[^>]*>/i, "").replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, "").replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, "").replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  const head = stripped.replace("</head>", `${metadata}</head>`);
  const fallback = `<div id="root"><div class="seo-prerender"><main><h1>${escapeHtml(content.heading)}</h1>${content.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}<nav aria-label="Site links">${content.links.map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join(" · ")}</nav></main></div></div>`;
  return head.replace('<div id="root"></div>', fallback);
}

async function loadPublishedProducts() {
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
  if (!supabaseUrl || !anonKey) {
    console.warn("SEO prerender: Supabase public environment values are unavailable; dynamic product URLs will not be included in this build's sitemap.");
    return [];
  }
  try {
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const url = new URL("/rest/v1/products", supabaseUrl);
      url.search = new URLSearchParams({ select: "id,slug,name,description,price,currency,status,stock_quantity,updated_at,product_images(image_url,is_primary)", status: "eq.published", order: "created_at.desc", limit: String(pageSize), offset: String(offset) }).toString();
      const response = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
      if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Supabase returned an unexpected product response");
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows.filter((product) => product.id && product.name);
  } catch (error) {
    console.warn(`SEO prerender: could not load public products (${error.message}); continuing with static pages.`);
    return [];
  }
}

const template = await readFile(path.join(dist, "index.html"), "utf8");
const assetTags = [...template.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>|<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map((match) => match[0]).join("\n    ");
const siteShell = template.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>|<script[^>]+src="([^"]+)"[^>]*><\/script>/g, "").replace("</head>", `${assetTags}</head>`);
const productRows = await loadPublishedProducts();
const sitemapEntries = [...publicPages.map((page) => ({ path: page.path, priority: page.priority }))];

for (const page of publicPages) {
  const structuredData = page.path === "/" ? { "@context": "https://schema.org", "@graph": [{ "@type": "Organization", name: "TSOGO-BIS", url: `${siteUrl}/`, logo: `${siteUrl}/tsogobislogo.jpg` }, { "@type": "WebSite", name: "TSOGO-BIS", url: `${siteUrl}/` }] } : undefined;
  const html = pageHtml(siteShell, { pagePath: page.path, title: page.title, description: page.description, content: { heading: page.heading, paragraphs: [page.body], links: page.links }, structuredData });
  const output = page.path === "/" ? path.join(dist, "index.html") : path.join(dist, page.path.slice(1), "index.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html);
}

for (const product of productRows) {
  const slug = String(product.slug || product.name).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const productPath = `/ProductDetails/${encodeURIComponent(product.id)}/${encodeURIComponent(slug)}`;
  const description = String(product.description || `Shop ${product.name} at TSOGO-BIS.`).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  const image = product.product_images?.find((entry) => entry.is_primary)?.image_url || product.product_images?.[0]?.image_url;
  const canonical = `${siteUrl}${productPath}`;
  const structuredData = { "@context": "https://schema.org", "@type": "Product", name: product.name, description, sku: String(product.id), url: canonical, ...(image ? { image: [image] } : {}), ...(product.price == null ? {} : { offers: { "@type": "Offer", priceCurrency: product.currency || "XAF", price: String(product.price), availability: Number(product.stock_quantity) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: canonical } }) };
  const html = pageHtml(siteShell, { pagePath: productPath, title: `${product.name} | TSOGO-BIS`, description, image: image || `${siteUrl}/tsogobislogo.jpg`, content: { heading: product.name, paragraphs: [description, `Price: ${product.price ?? ""} ${product.currency || "XAF"}. View product availability and order options on TSOGO-BIS.`], links: [["Shop all products", "/shop"], ["Contact", "/contact"]] }, structuredData });
  const aliases = new Set([slug, String(product.name).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")]);
  for (const alias of aliases) {
    if (!alias) continue;
    const aliasPath = `/ProductDetails/${encodeURIComponent(product.id)}/${encodeURIComponent(alias)}`;
    const aliasHtml = pageHtml(siteShell, { pagePath: aliasPath, canonicalPath: productPath, title: `${product.name} | TSOGO-BIS`, description, image: image || `${siteUrl}/tsogobislogo.jpg`, content: { heading: product.name, paragraphs: [description, `Price: ${product.price ?? ""} ${product.currency || "XAF"}. View product availability and order options on TSOGO-BIS.`], links: [["Shop all products", "/shop"], ["Contact", "/contact"]] }, structuredData });
    const output = path.join(dist, "ProductDetails", String(product.id), alias, "index.html");
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, aliasHtml);
  }
  sitemapEntries.push({ path: productPath, priority: "0.8", lastmod: product.updated_at });
}

for (const [route, heading, description] of noIndexPages) {
  const html = pageHtml(siteShell, { pagePath: route, title: `${heading} | TSOGO-BIS`, description, robots: "noindex,nofollow", content: { heading, paragraphs: [description], links: [["Retour a l'accueil", "/"], ["Boutique", "/shop"]] } });
  const output = path.join(dist, route.slice(1), "index.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((entry) => `  <url><loc>${escapeHtml(`${siteUrl}${entry.path === "/" ? "/" : entry.path}`)}</loc>${entry.lastmod ? `<lastmod>${new Date(entry.lastmod).toISOString().slice(0, 10)}</lastmod>` : ""}<changefreq>${entry.path === "/" || entry.path === "/shop" ? "daily" : "monthly"}</changefreq><priority>${entry.priority}</priority></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(dist, "sitemap.xml"), sitemap);
await writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

const llms = `# TSOGO-BIS\n\n> Official online storefront for discovering products, placing orders, and finding delivery and contact information.\n\n## Public pages\n${publicPages.map((page) => `- [${page.heading}](${siteUrl}${page.path === "/" ? "/" : page.path}): ${page.description}`).join("\n")}\n\n## Product catalog\n- [Browse products](${siteUrl}/shop): Current catalog and product detail pages.\n\n## Sitemap\n- [XML sitemap](${siteUrl}/sitemap.xml)\n`;
await writeFile(path.join(dist, "llms.txt"), llms);
await writeFile(path.join(dist, "404.html"), pageHtml(siteShell, { pagePath: "/404.html", title: "Page introuvable | TSOGO-BIS", description: "Cette page TSOGO-BIS est introuvable.", robots: "noindex,nofollow", content: { heading: "Page introuvable", paragraphs: ["La page demandee n'existe pas ou a ete deplacee."], links: [["Accueil", "/"], ["Boutique", "/shop"]] } }));
console.log(`SEO prerender: wrote ${publicPages.length + noIndexPages.length + productRows.length} route documents, ${sitemapEntries.length} sitemap URLs, sitemap.xml, and llms.txt.`);
