import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronUp, Globe } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Cookies from "js-cookie";
import { canStorePreferences } from "../../utils/cookieConsent";
import "../../styles/languagebtn.css";

const languages = [
  { code: "en", nativeName: "English", localNameKey: "english", mark: "EN" },
  { code: "fr", nativeName: "Français", localNameKey: "french", mark: "FR" },
  { code: "zh", nativeName: "中文", localNameKey: "chinese", mark: "中" },
];

export default function FloatingLangButton() {
  const { i18n, t } = useTranslation();
  const [userId, setUserId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  // Restore the signed-in user's database preference and save guest choices
  // to the profile as soon as an account session becomes available.
  useEffect(() => {
    let active = true;
    const restorePreference = async (user) => {
      if (!active) return;
      const storedLanguage = localStorage.getItem("language") || Cookies.get("language") || "fr";
      const isSupported = (value) => languages.some(({ code }) => code === value);
      if (!user) {
        setUserId(null);
        if (isSupported(storedLanguage)) await i18n.changeLanguage(storedLanguage);
        return;
      }

      setUserId(user.id);
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) console.error("Could not load saved language preference:", error.message);
      const preferred = profile?.preferred_language;
      if (isSupported(preferred)) {
        await i18n.changeLanguage(preferred);
        if (canStorePreferences()) localStorage.setItem("language", preferred);
        Cookies.remove("language");
      } else {
        const language = isSupported(storedLanguage) ? storedLanguage : "fr";
        await i18n.changeLanguage(language);
        await supabase.from("profiles").update({ preferred_language: language }).eq("user_id", user.id);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      // The callback holds the auth lock. Defer profile queries until it returns.
      window.setTimeout(() => restorePreference(user), 0);
    });
    supabase.auth.getSession().then(({ data }) => restorePreference(data.session?.user ?? null));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [i18n]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const handleChange = async (newLang) => {
    await i18n.changeLanguage(newLang);
    if (canStorePreferences()) localStorage.setItem("language", newLang);
    Cookies.remove("language");
    setIsOpen(false);

    let activeUserId = userId;
    if (!activeUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      activeUserId = user?.id ?? null;
      if (activeUserId) setUserId(activeUserId);
    }
    if (activeUserId) {
      // Save language to DB
      const { data, error } = await supabase
        .from("profiles")
        .update({ preferred_language: newLang })
        .eq("user_id", activeUserId)
        .select("user_id")
        .maybeSingle();

      if (error || !data) console.error("Could not save language preference to the profile:", error?.message || "Profile row was not updated");
    }
  };

  const currentLanguage = languages.find(({ code }) => code === i18n.resolvedLanguage?.slice(0, 2)) || languages[0];

  return (
    <div className="language-btn-container" ref={rootRef}>
      <button 
        className="language-btn" 
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t("language.change")}
        aria-expanded={isOpen}
        aria-controls="language-options"
        title={t("language.label")}
      >
        <Globe size={20} className="globe-icon" />
        <span className="current-lang">{currentLanguage.mark}</span>
        <ChevronUp size={14} className={`language-chevron ${isOpen ? "is-open" : ""}`} />
      </button>

      {isOpen && (
        <div className="language-dropdown" id="language-options" role="group" aria-label={t("language.label")}>
          <div className="language-dropdown-heading"><Globe size={16} /><span>{t("language.label")}</span></div>
          {languages.map((language) => {
            const active = currentLanguage.code === language.code;
            return <button key={language.code} type="button" className={`language-option ${active ? "is-active" : ""}`}
              onClick={() => handleChange(language.code)} aria-pressed={active}>
              <span className="language-option-mark">{language.mark}</span>
              <span>{t(`language.${language.localNameKey}`)}<small>{language.nativeName}</small></span>
              {active && <Check size={16} aria-hidden="true" />}
            </button>;
          })}
        </div>
      )}
    </div>
  );
}
