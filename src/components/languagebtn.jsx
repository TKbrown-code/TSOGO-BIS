import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { supabase } from "../lib/supabase";
import '../styles/languagebtn.css';

export default function FloatingLangButton() {
  const { i18n } = useTranslation();
  const [userId, setUserId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize language on mount
  useEffect(() => {
    const initLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Fetch saved language from DB
        const { data: profile } = await supabase
          .from("profiles")
          .select("language")
          .eq("user_id", user.id)
          .single();

        if (profile?.language) {
          i18n.changeLanguage(profile.language);
          localStorage.setItem("appLanguage", profile.language);
        } else {
          // fallback to localStorage or default
          const storedLang = localStorage.getItem("appLanguage") || "en";
          i18n.changeLanguage(storedLang);
        }
      } else {
        // Guest: use localStorage or default
        const storedLang = localStorage.getItem("appLanguage") || "en";
        i18n.changeLanguage(storedLang);
      }
    };

    initLanguage();
  }, [i18n]);

  const handleChange = async (e) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
    localStorage.setItem("appLanguage", newLang);
    setIsOpen(false);

    if (userId) {
      // Save language to DB
      const { error } = await supabase
        .from("profiles")
        .update({ language: newLang })
        .eq("user_id", userId);

      if (error) console.error("Error updating language:", error.message);
    }
  };

  const toggleDropdown = () => setIsOpen(!isOpen);

  return (
    <div className="language-btn-container">
      <button 
        className="language-btn" 
        onClick={toggleDropdown}
        aria-label="Change language"
        aria-expanded={isOpen}
      >
        <Globe size={20} className="globe-icon" />
        <span className="current-lang">
          {i18n.language === 'en' ? 'EN' : i18n.language === 'fr' ? 'FR' : '中文'}
        </span>
      </button>

      {isOpen && (
        <div className="language-dropdown">
          <select
            value={i18n.language}
            onChange={handleChange}
            className="language-select"
            aria-label="Select language"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="zh">中文</option>
          </select>
        </div>
      )}
    </div>
  );
}
