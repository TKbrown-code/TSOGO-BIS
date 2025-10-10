import { supabase } from "../lib/supabase";

/**
 * Upload a product image to Supabase Storage
 * @param {File} file - the image file to upload (from input)
 * @param {string} folder - optional folder inside the bucket
 * @returns {Promise<{ path: string, error: string | null }>}
 */
export const uploadProductImage = async (file, folder = "") => {
  if (!file) return { path: null, error: "No file provided" };

  // Create a unique filename to avoid collisions
  const timestamp = Date.now();
  const filename = `${timestamp}_${file.name}`;
  const filePath = folder ? `${folder}/${filename}` : filename;

  const { data, error } = await supabase.storage
    .from("products-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false, // set to true to overwrite same name
      contentType: file.type,
    });

  if (error) {
    console.error("Error uploading file:", error.message);
    return { path: null, error: error.message };
  }

  return { path: data.path, error: null };
};
