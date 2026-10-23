/**
 * Return the URL already stored with a storefront image record.
 * @param {string} imageUrl - public image URL
 * @returns {string} - public URL
 */
export const getProductImageUrl = (imageUrl) => {
  return imageUrl || "/placeholder.png";
};
