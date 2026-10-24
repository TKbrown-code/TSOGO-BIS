export function productSlug(product) {
  const source = product?.slug || product?.name || "product";
  return String(source)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "product";
}

export function productDetailPath(product) {
  return `/ProductDetails/${encodeURIComponent(product?.id ?? "")}/${encodeURIComponent(productSlug(product))}`;
}
