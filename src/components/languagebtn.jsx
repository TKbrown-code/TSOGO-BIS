import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function FloatingLangButton() {
  const { i18n } = useTranslation();
  const [userId, setUserId] = useState(null);

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

    if (userId) {
      // Save language to DB
      const { error } = await supabase
        .from("profiles")
        .update({ language: newLang })
        .eq("user_id", userId);

      if (error) console.error("Error updating language:", error.message);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "20px",
        background: "#202020ff",
        borderRadius: "50px",
        padding: "5px 10px",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
        zIndex: 1000,
      }}
    >
      <Globe size={24} color="white" />
      <select
        value={i18n.language}
        onChange={handleChange}
        style={{
          background: "transparent",
          color: "white",
          border: "none",
          outline: "none",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="zh">中文</option>
      </select>
    </div>
  );
}
