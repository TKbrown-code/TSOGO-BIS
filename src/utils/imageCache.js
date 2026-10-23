export async function preloadAllImages(products) {
  // The URL is already stored on product_images; no client-side Storage lookup is needed.
  return products;
}

export function getCachedImage(imageUrl) {
  return imageUrl || "/placeholder.png";
}
