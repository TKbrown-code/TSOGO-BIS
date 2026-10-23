const CHECKOUT_CART_KEY_PREFIX = "tsogo-bis:checkout-cart:";

export function rememberCheckoutCartItems(checkoutId, cartItemIds) {
  if (!checkoutId || !Array.isArray(cartItemIds) || !cartItemIds.length) return;
  try {
    window.sessionStorage.setItem(`${CHECKOUT_CART_KEY_PREFIX}${checkoutId}`, JSON.stringify(cartItemIds));
  } catch (error) {
    console.warn("Could not persist checkout cart items for payment return:", error);
  }
}

export async function removePaidCheckoutCartItems(checkoutId, removeItems) {
  if (!checkoutId || typeof removeItems !== "function") return false;
  const key = `${CHECKOUT_CART_KEY_PREFIX}${checkoutId}`;
  let ids;
  try {
    ids = JSON.parse(window.sessionStorage.getItem(key) || "[]");
  } catch {
    return false;
  }
  if (!Array.isArray(ids) || ids.length === 0) return false;
  const removed = await removeItems(ids);
  if (removed) window.sessionStorage.removeItem(key);
  return Boolean(removed);
}
