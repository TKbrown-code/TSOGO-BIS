import { supabase } from "../lib/supabase";

/**
 * Get a temporary download link for an image in Supabase Storage
 * @param {string} path - the path of the image inside the bucket
 * @param {number} expiresIn - expiration time in seconds (default 1 hour)
 * @returns {string} - signed URL
 */
export const getDownloadUrl = async (path, expiresIn = 3600) => {
  if (!path) return "/placeholder.png";

  const { data, error } = await supabase.storage
    .from("products-images")
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error.message);
    return "/placeholder.png";
  }

  return data.signedUrl;
};
