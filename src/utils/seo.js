const publicPageMetadata = {
  "/": {
    title: "TSOGO-BIS | Boutique en ligne au Cameroun",
    description: "Decouvrez la boutique en ligne TSOGO-BIS au Cameroun. Parcourez notre catalogue, trouvez des produits pour votre quotidien et commandez en ligne.",
  },
  "/shop": {
    title: "Boutique en ligne | TSOGO-BIS",
    description: "Parcourez le catalogue TSOGO-BIS, decouvrez les produits disponibles et consultez leurs prix et details.",
  },
  "/about": { title: "A propos | TSOGO-BIS", description: "En savoir plus sur TSOGO-BIS, sa boutique en ligne et son service client." },
  "/contact": { title: "Contact | TSOGO-BIS", description: "Contactez TSOGO-BIS pour une question sur les produits, une commande ou une livraison." },
  "/logistics": { title: "Livraison et logistique | TSOGO-BIS", description: "Informations TSOGO-BIS sur l'expedition, la livraison et le suivi des commandes au Cameroun." },
  "/terms-and-policies": { title: "Conditions et politiques | TSOGO-BIS", description: "Consultez les conditions d'utilisation et les politiques de TSOGO-BIS." },
};

const privatePageMetadata = {
  "/checkout": ["Finaliser une commande | TSOGO-BIS", "Finalisez votre commande TSOGO-BIS."],
  "/orders": ["Mes commandes | TSOGO-BIS", "Consultez vos commandes TSOGO-BIS."],
  "/dashboard": ["Mon compte | TSOGO-BIS", "Gerez votre compte TSOGO-BIS."],
  "/SignUp": ["Connexion ou inscription | TSOGO-BIS", "Connectez-vous ou creez un compte TSOGO-BIS."],
  "/reset-password": ["Reinitialiser le mot de passe | TSOGO-BIS", "Reinitialisez le mot de passe de votre compte TSOGO-BIS."],
  "/track": ["Suivre une commande | TSOGO-BIS", "Saisissez votre numero de suivi TSOGO-BIS pour consulter les informations de livraison."],
  "/fapshi": ["Paiement | TSOGO-BIS", "Retour de paiement TSOGO-BIS."],
};

function setMeta(attribute, key, value) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", value);
}

export function updatePageMetadata(pathname, imageUrl) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, "") : "/";
  const productMatch = normalizedPath.match(/^\/ProductDetails\/([^/]+)\/([^/]+)$/i);
  const isAdmin = normalizedPath.toLowerCase().startsWith("/admin");
  const isReferral = normalizedPath.startsWith("/referrals/");
  const privateMatch = Object.entries(privatePageMetadata).find(([route]) => route.toLowerCase() === normalizedPath.toLowerCase());
  let metadata = publicPageMetadata[normalizedPath] || { title: "TSOGO-BIS | Boutique en ligne au Cameroun", description: publicPageMetadata["/"].description };
  let robots = "index,follow,max-image-preview:large";
  let canonicalPath = normalizedPath;

  if (productMatch) {
    let productName = productMatch[2];
    try {
      productName = decodeURIComponent(productName);
    } catch {
      // Keep the encoded route segment if a malformed percent escape is present.
    }
    productName = productName.replace(/[-_]+/g, " ").trim();
    metadata = { title: `${productName || "Produit"} | TSOGO-BIS`, description: `Decouvrez ${productName || "ce produit"}, consultez ses details et sa disponibilite sur TSOGO-BIS.` };
  } else if (isAdmin || privateMatch || normalizedPath.startsWith("/track/")) {
    const entry = privateMatch?.[1]?.[0] || (isAdmin ? "Administration | TSOGO-BIS" : "Suivi de commande | TSOGO-BIS");
    const description = privateMatch?.[1]?.[1] || "Consultez les informations de commande TSOGO-BIS.";
    metadata = { title: entry, description };
    robots = "noindex,nofollow";
  } else if (isReferral) {
    metadata = { ...publicPageMetadata["/"], title: "TSOGO-BIS | Boutique en ligne au Cameroun" };
    robots = "noindex,follow";
    canonicalPath = "/";
  }

  const baseUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");
  const canonical = `${baseUrl}${canonicalPath === "/" ? "/" : canonicalPath}`;
  document.documentElement.lang = "fr";
  document.title = metadata.title;
  setMeta("name", "description", metadata.description);
  setMeta("name", "robots", robots);
  setMeta("property", "og:title", metadata.title);
  setMeta("property", "og:description", metadata.description);
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", imageUrl || `${baseUrl}/favicon.png`);
  setMeta("name", "twitter:image", imageUrl || `${baseUrl}/favicon.png`);
  setMeta("property", "og:type", imageUrl ? "product" : "website");
  let canonicalLink = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonical;
}
