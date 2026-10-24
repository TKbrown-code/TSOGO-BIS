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
    terms_and_policies_en: "",
    terms_and_policies_fr: "",
    coupon_code: "",
    coupon_discount_type: "percent",
    coupon_discount_value: 0,
    coupon_minimum: 0,
    coupon_active: false,
    ad_popup_enabled: false,
    ad_popup_title_en: "", ad_popup_title_fr: "",
    ad_popup_body_en: "", ad_popup_body_fr: "",
    ad_popup_cta_en: "", ad_popup_cta_fr: "",
    ad_popup_image_url: "", ad_popup_link_url: "",
    ad_popup_starts_at: null, ad_popup_ends_at: null,
    updated_at: null,
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
          terms_and_policies_en: data.terms_and_policies_en || data.terms_and_policies || "",
          terms_and_policies_fr: data.terms_and_policies_fr || "",
          coupon_code: data.coupon_code || "",
          coupon_discount_type: data.coupon_discount_type || "percent",
          coupon_discount_value: Number(data.coupon_discount_value) || 0,
          coupon_minimum: Number(data.coupon_minimum) || 0,
          coupon_active: data.coupon_active === true,
          ad_popup_enabled: data.ad_popup_enabled === true,
          ad_popup_title_en: data.ad_popup_title_en || "", ad_popup_title_fr: data.ad_popup_title_fr || "",
          ad_popup_body_en: data.ad_popup_body_en || "", ad_popup_body_fr: data.ad_popup_body_fr || "",
          ad_popup_cta_en: data.ad_popup_cta_en || "", ad_popup_cta_fr: data.ad_popup_cta_fr || "",
          ad_popup_image_url: data.ad_popup_image_url || "", ad_popup_link_url: data.ad_popup_link_url || "",
          ad_popup_starts_at: data.ad_popup_starts_at || null, ad_popup_ends_at: data.ad_popup_ends_at || null,
          updated_at: data.updated_at || null,
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
    termsAndPoliciesEn: settings.terms_and_policies_en,
    termsAndPoliciesFr: settings.terms_and_policies_fr,
    coupon: { code: settings.coupon_code, type: settings.coupon_discount_type, value: settings.coupon_discount_value, minimum: settings.coupon_minimum, active: settings.coupon_active },
    adPopup: settings,
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
