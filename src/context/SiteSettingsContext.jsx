// src/context/SiteSettingsContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SiteSettingsContext = createContext();

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    site_name: "TSOGO-BIS",
    site_email: "",
    site_phone: "",
    whatsapp_phone: "237680633832",
    terms_and_policies: "",
    currency: "XAF",
    tax_rate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Error loading site settings:", error);
      } else if (data) {
        setSettings({
          site_name: data.site_name || "TSOGO-BIS",
          site_email: data.contact_email || "",
          site_phone: data.contact_phone || "",
          whatsapp_phone: data.whatsapp_phone || "237680633832",
          terms_and_policies: data.terms_and_policies || "",
          currency: data.base_currency || "XAF",
          tax_rate: data.tax_rate || 0
        });
      }
    } catch (error) {
      console.error("Error loading site settings:", error);
    } finally {
      setLoading(false);
    }
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
    whatsappPhone: settings.whatsapp_phone,
    termsAndPolicies: settings.terms_and_policies,
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
