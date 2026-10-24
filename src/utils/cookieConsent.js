export function getCookieConsent() {
  try {
    return JSON.parse(localStorage.getItem("tsogo_cookie_consent") || "null");
  } catch {
    return null;
  }
}

export function canStorePreferences() {
  return getCookieConsent()?.preferences === true;
}
