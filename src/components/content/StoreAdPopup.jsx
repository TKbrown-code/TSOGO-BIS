import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSiteSettings } from "../../context/SiteSettingsContext";
import "../../styles/store-ad-popup.css";

export default function StoreAdPopup() {
  const { adPopup } = useSiteSettings();
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [coupon, setCoupon] = useState(null);
  const [cycle, setCycle] = useState(0);
  const campaignId = `${adPopup.updated_at || "campaign"}:${adPopup.ad_popup_title_en || adPopup.ad_popup_title_fr}:${coupon?.code || ""}`;
  const language = String(i18n.resolvedLanguage || i18n.language || "en").slice(0, 2) === "fr" ? "fr" : "en";
  const title = adPopup[`ad_popup_title_${language}`] || adPopup.ad_popup_title_en || adPopup.ad_popup_title_fr;
  const body = adPopup[`ad_popup_body_${language}`] || adPopup.ad_popup_body_en || adPopup.ad_popup_body_fr;
  const cta = adPopup[`ad_popup_cta_${language}`] || adPopup.ad_popup_cta_en || adPopup.ad_popup_cta_fr;
  const adIsActive = Boolean(adPopup.ad_popup_enabled && title && (!adPopup.ad_popup_starts_at || new Date(adPopup.ad_popup_starts_at).getTime() <= Date.now()) && (!adPopup.ad_popup_ends_at || new Date(adPopup.ad_popup_ends_at).getTime() > Date.now()));
  useEffect(() => {
    let active = true;
    supabase.from("coupons").select("code,discount_type,discount_value,product_id,category_id,subcategory_id,products(name),categories(name),subcategories(name)").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => { if (active) setCoupon(data || null); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const now = Date.now();
    const started = !adPopup.ad_popup_starts_at || new Date(adPopup.ad_popup_starts_at).getTime() <= now;
    const notEnded = !adPopup.ad_popup_ends_at || new Date(adPopup.ad_popup_ends_at).getTime() > now;
    const adInWindow = adPopup.ad_popup_enabled && title && started && notEnded;
    if (!adInWindow && !coupon) return undefined;
    const previous = Number(localStorage.getItem("tsogo_offer_popup_last_shown") || 0);
    const delay = Math.max(9000, 15 * 60 * 1000 - (now - previous));
    const timer = window.setTimeout(() => { setOpen(true); localStorage.setItem("tsogo_offer_popup_last_shown", String(Date.now())); }, delay);
    return () => window.clearTimeout(timer);
  }, [adPopup, campaignId, title, coupon, cycle]);
  if (!open) return null;
  const close = () => { setOpen(false); setCycle((value) => value + 1); };
  const couponScope = coupon?.products?.name || coupon?.subcategories?.name || coupon?.categories?.name;
  const couponValue = coupon?.discount_type === "percent" ? `${coupon.discount_value}%` : `${Number(coupon?.discount_value || 0).toLocaleString()} FCFA`;
  return <div className="store-ad-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className={`store-ad-dialog ${adIsActive && adPopup.ad_popup_image_url ? "has-image" : "no-image"}`} role="dialog" aria-modal="true" aria-labelledby={adIsActive ? "store-ad-title" : undefined} aria-label={adIsActive ? undefined : (language === "fr" ? "Offre promotionnelle" : "Promotion offer")}><button className="store-ad-close" type="button" aria-label="Close promotion" onClick={close}><X size={19}/></button>{adIsActive&&adPopup.ad_popup_image_url&&<img src={adPopup.ad_popup_image_url} alt=""/>}<div className="store-ad-copy"><span>TSOGO-BIS · {language === "fr" ? "OFFRE SPÉCIALE" : "SPECIAL OFFER"}</span>{adIsActive&&title&&<h2 id="store-ad-title">{title}</h2>}{adIsActive&&body&&<p>{body}</p>}{adIsActive&&cta&&adPopup.ad_popup_link_url&&<a href={adPopup.ad_popup_link_url}>{cta}</a>}{coupon&&<aside className="store-ad-coupon"><small>{language === "fr" ? "CODE PROMOTIONNEL" : "PROMOTION CODE"}</small><strong>{coupon.code}</strong><p>{language === "fr" ? `${couponValue} de remise${couponScope ? ` sur ${couponScope}` : " sur votre commande"}` : `${couponValue} off${couponScope ? ` ${couponScope}` : " your order"}`}</p><a href="/shop">{language === "fr" ? "Découvrir la boutique" : "Shop the collection"}</a></aside>}</div></section></div>;
}
