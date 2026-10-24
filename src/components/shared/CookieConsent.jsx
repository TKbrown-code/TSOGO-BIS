import React, { useEffect, useRef, useState } from "react";
import { Cookie, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import "../../styles/CookieConsent.css";

const CONSENT_KEY = "tsogo_cookie_consent";

function readConsent() {
  try {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.expiresAt || Date.parse(parsed.expiresAt) > Date.now()) return parsed;
      localStorage.removeItem(CONSENT_KEY);
    }
  } catch {
    // Fall back to the legacy consent cookie if stored data is malformed.
  }

  const legacy = Cookies.get("cookie_consent");
  if (legacy === "accepted") return { necessary: true, preferences: true, analytics: true };
  if (legacy === "declined") return { necessary: true, preferences: false, analytics: false };
  return null;
}

function storeConsent(consent) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({
    necessary: true,
    preferences: Boolean(consent.preferences),
    analytics: Boolean(consent.analytics),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  }));
  Cookies.remove("cookie_consent");
  if (!consent.analytics) {
    localStorage.removeItem("tsogo_analytics");
    localStorage.removeItem("tsogo_user_id");
  }
  if (!consent.preferences) {
    localStorage.removeItem("language");
    localStorage.removeItem("currency");
    Cookies.remove("language");
    Cookies.remove("currency");
  }
  window.dispatchEvent(new CustomEvent("tsogo:cookie-consent-changed", { detail: consent }));
}

export default function CookieConsent() {
  const { t, i18n } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);
  const [preferences, setPreferences] = useState({ preferences: false, analytics: false });
  const dialogRef = useRef(null);

  useEffect(() => {
    const existing = readConsent();
    if (existing) {
      setPreferences({ preferences: existing.preferences, analytics: existing.analytics });
      // Migrate the old consent cookie format to the current preference record.
      if (!localStorage.getItem(CONSENT_KEY)) storeConsent(existing);
      return;
    }

    const timer = window.setTimeout(() => setShowBanner(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const openSettings = () => {
      const existing = readConsent();
      setPreferences({ preferences: Boolean(existing?.preferences), analytics: Boolean(existing?.analytics) });
      setShowBanner(true);
    };
    window.addEventListener("tsogo:open-cookie-settings", openSettings);
    return () => window.removeEventListener("tsogo:open-cookie-settings", openSettings);
  }, []);

  useEffect(() => {
    if (!showBanner) return undefined;
    const dialog = dialogRef.current;
    const getFocusable = () => [...(dialog?.querySelectorAll("button:not(:disabled), input:not(:disabled), summary") ?? [])]
      .filter((element) => element.getClientRects().length > 0);
    getFocusable()[0]?.focus();

    const keepFocusInside = (event) => {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", keepFocusInside);
    return () => document.removeEventListener("keydown", keepFocusInside);
  }, [showBanner]);

  const save = (choice) => {
    const next = { necessary: true, ...choice };
    storeConsent(next);
    if (next.preferences && i18n.resolvedLanguage) localStorage.setItem("language", i18n.resolvedLanguage);
    setShowBanner(false);
  };

  const acceptAll = () => save({ preferences: true, analytics: true });
  const rejectOptional = () => save({ preferences: false, analytics: false });
  const saveSelection = () => save(preferences);

  if (!showBanner) return null;

  return (
    <div className="cookie-consent-overlay">
      <section ref={dialogRef} className="cookie-consent-banner" role="dialog" aria-modal="true" aria-labelledby="cookie-title" aria-describedby="cookie-message">
        <div className="cookie-icon" aria-hidden="true"><Cookie size={28} strokeWidth={1.8} /></div>
        <div className="cookie-content">
          <div className="cookie-heading-row">
            <div>
              <h2 className="cookie-title" id="cookie-title">{t("cookie.title")}</h2>
              <p className="cookie-text" id="cookie-message">{t("cookie.message")}</p>
            </div>
            <div className="cookie-actions">
              <button type="button" onClick={rejectOptional} className="btn-decline">{t("cookie.decline")}</button>
              <button type="button" onClick={acceptAll} className="btn-accept">{t("cookie.accept")}</button>
            </div>
          </div>

          <details className="cookie-details">
            <summary>{t("cookie.learn_more")}</summary>
            <div className="cookie-info">
              <div className="cookie-essential"><ShieldCheck size={17} /><p><strong>{t("cookie.essential")}</strong><span>{t("cookie.essential_desc")}</span></p><span className="cookie-always-on">{t("cookie.always_on")}</span></div>
              <label className="cookie-choice"><span><strong>{t("cookie.functional")}</strong><small>{t("cookie.functional_desc")}</small></span><input type="checkbox" checked={preferences.preferences} onChange={(event) => setPreferences((current) => ({ ...current, preferences: event.target.checked }))} /></label>
              <label className="cookie-choice"><span><strong>{t("cookie.analytics")}</strong><small>{t("cookie.analytics_desc")}</small></span><input type="checkbox" checked={preferences.analytics} onChange={(event) => setPreferences((current) => ({ ...current, analytics: event.target.checked }))} /></label>
              <button type="button" className="cookie-save-selection" onClick={saveSelection}>{t("cookie.save_selection")}</button>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
