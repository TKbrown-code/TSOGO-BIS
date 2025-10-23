import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Cookies from "js-cookie";
import en from "./en.json";
import fr from "./fr.json";
import zh from "./zh.json";

// Get saved language from cookie or default to 'en'
const savedLanguage = Cookies.get("language") || "en";

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
  Cookies.set("language", lng, { expires: 365 }); // Save for 1 year
});

export default i18n;
