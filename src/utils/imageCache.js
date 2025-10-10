// src/utils/imageCache.js
import { supabase } from "../lib/supabase";

export let cache = JSON.parse(localStorage.getItem("imageCache") || "{}");

export async function fetchFromSupabase(path) {
  const { data, error } = supabase.storage
    .from("products-images")
    .getPublicUrl(path);

  if (error) {
    console.error("Error fetching image:", error.message);
    return "/placeholder.png";
  }

  return data?.publicUrl || "/placeholder.png";
}

export async function preloadAllImages(products) {
  await Promise.all(
    products.map(async (product) => {
      const primaryImage = product.product_images?.find((img) => img.is_primary);
      if (primaryImage && !cache[primaryImage.image_path]) {
        const url = await fetchFromSupabase(primaryImage.image_path);
        cache[primaryImage.image_path] = url;
      }
    })
  );
  localStorage.setItem("imageCache", JSON.stringify(cache));
}

export function getCachedImage(image_path) {
  return cache[image_path] || "/placeholder.png";
}
