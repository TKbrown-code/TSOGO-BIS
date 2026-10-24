import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Cookies from "js-cookie";
import { canStorePreferences } from "../utils/cookieConsent";
import en from "./en.json";
import fr from "./fr.json";
import zh from "./zh.json";

// Respect an existing choice; use French for first-time visitors.
const savedLanguage = (typeof localStorage !== "undefined" ? localStorage.getItem("language") : null)
  || Cookies.get("language")
  || "fr";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    zh: { translation: zh }
  },
  lng: savedLanguage, // Use saved language
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

// Save language to cookie whenever it changes
i18n.on("languageChanged", (lng) => {
  if (typeof localStorage !== "undefined" && canStorePreferences()) localStorage.setItem("language", lng);
  Cookies.remove("language");
});

export default i18n;
