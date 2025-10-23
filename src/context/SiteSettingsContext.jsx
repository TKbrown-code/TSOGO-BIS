// src/context/SiteSettingsContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SiteSettingsContext = createContext();

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    site_name: "TSOGO-BIS",
    site_email: "admin@tsogo-bis.com",
    site_phone: "+237 XXX XXX XXX",
    currency: "XAF",
    tax_rate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    if (error) {
      console.error("Error loading site settings:", error);
      // Keep default settings
    } else if (data) {
      setSettings({
        site_name: data.site_name || "TSOGO-BIS",
        site_email: data.site_email || "",
        site_phone: data.site_phone || "",
        currency: data.currency || "XAF",
        tax_rate: data.tax_rate || 0
      });
    }
    setLoading(false);
  }

  // Function to refresh settings (call after update)
  const refreshSettings = () => {
    loadSettings();
  };

  const value = {
    settings,
    loading,
    refreshSettings,
    // Convenience getters
    siteName: settings.site_name,
    siteEmail: settings.site_email,
    sitePhone: settings.site_phone,
    currency: settings.currency,
    taxRate: settings.tax_rate
  };

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  }
  return context;
};
