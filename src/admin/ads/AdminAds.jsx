import React, { useEffect, useRef, useState } from "react";
import { Megaphone, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useModalMessage } from "../../context/ModalMessageContext";
import "./AdminAds.css";

const defaults = { ad_popup_enabled: false, ad_popup_title_en: "", ad_popup_title_fr: "", ad_popup_body_en: "", ad_popup_body_fr: "", ad_popup_cta_en: "", ad_popup_cta_fr: "", ad_popup_image_url: "", ad_popup_link_url: "", ad_popup_starts_at: "", ad_popup_ends_at: "" };
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";

export default function AdminAds() {
  const { showAlert } = useModalMessage();
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageFileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("site_settings").select("*").maybeSingle();
      if (error) showAlert(error.message, "Ad settings could not be loaded", "error");
      else if (data) setForm({ ...defaults, ...Object.fromEntries(Object.keys(defaults).map((key) => [key, key.endsWith("_at") ? dateInput(data[key]) : data[key] ?? defaults[key]])) });
      setLoading(false);
    })();
  }, [showAlert]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function uploadImage(file) {
    if (!file) return;
    const imageExtensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
    if (!imageExtensions[file.type]) {
      showAlert("Choose a JPG, PNG, WebP, GIF, or AVIF image for the campaign.", "Unsupported file", "error");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showAlert("Choose an image smaller than 12 MB.", "Image is too large", "error");
      return;
    }

    setUploading(true);
    try {
      const path = `store-ads/campaign-${crypto.randomUUID()}.${imageExtensions[file.type]}`;
      const { data, error } = await supabase.storage.from("products-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data: publicUrl } = supabase.storage.from("products-images").getPublicUrl(data.path);
      update("ad_popup_image_url", publicUrl.publicUrl);
      showAlert("The campaign image is uploaded. Save the campaign to publish it.", "Image uploaded", "success");
    } catch (error) {
      showAlert(error.message || "The image could not be uploaded.", "Image upload failed", "error");
    } finally {
      setUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = "";
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form, ad_popup_starts_at: form.ad_popup_starts_at ? new Date(form.ad_popup_starts_at).toISOString() : null, ad_popup_ends_at: form.ad_popup_ends_at ? new Date(form.ad_popup_ends_at).toISOString() : null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("site_settings").upsert({ id: true, ...payload });
    setSaving(false);
    showAlert(error?.message || "Your storefront popup campaign has been saved.", error ? "Could not save campaign" : "Campaign saved", error ? "error" : "success");
  }

  return <main className="admin-ads">
    <header><span>STOREFRONT PROMOTION</span><h1><Megaphone size={25}/> Ads &amp; popups</h1><p>Publish a timed promotional popup to storefront visitors. Store ads and coupon offers can appear at most once every 15 minutes in a browser.</p></header>
    <form onSubmit={save} aria-busy={loading || saving || uploading}>
      <label className="admin-ad-enabled"><input type="checkbox" checked={Boolean(form.ad_popup_enabled)} onChange={(event) => update("ad_popup_enabled", event.target.checked)}/><span><b>Campaign is live</b><small>Show this promotion outside the admin and account dashboards.</small></span></label>
      <div className="admin-ad-languages">{["en", "fr"].map((lang) => <fieldset key={lang}><legend>{lang === "en" ? "English" : "Français"}</legend><label>Headline<input value={form[`ad_popup_title_${lang}`]} onChange={(event) => update(`ad_popup_title_${lang}`, event.target.value)} maxLength={100}/></label><label>Message<textarea value={form[`ad_popup_body_${lang}`]} onChange={(event) => update(`ad_popup_body_${lang}`, event.target.value)} rows={4} maxLength={500}/></label><label>Button label<input value={form[`ad_popup_cta_${lang}`]} onChange={(event) => update(`ad_popup_cta_${lang}`, event.target.value)} maxLength={40}/></label></fieldset>)}</div>
      <div className="admin-ad-grid">
        <label>Image URL<input type="url" value={form.ad_popup_image_url} onChange={(event) => update("ad_popup_image_url", event.target.value)} placeholder="https://…"/></label>
        <label className="admin-ad-image-upload">Upload image<input ref={imageFileRef} type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0])}/><small>{uploading ? "Uploading image…" : "Choose an image (up to 12 MB)"}</small></label>
        <label>Button destination<input type="url" value={form.ad_popup_link_url} onChange={(event) => update("ad_popup_link_url", event.target.value)} placeholder="https://… or /shop"/></label>
        <label>Start time<input type="datetime-local" value={form.ad_popup_starts_at} onChange={(event) => update("ad_popup_starts_at", event.target.value)}/></label>
        <label>End time<input type="datetime-local" value={form.ad_popup_ends_at} onChange={(event) => update("ad_popup_ends_at", event.target.value)}/></label>
      </div>
      {form.ad_popup_image_url && <img className="admin-ad-preview" src={form.ad_popup_image_url} alt="Campaign preview"/>}
      <button disabled={saving || loading || uploading}><Save size={16}/>{saving ? "Saving…" : uploading ? "Uploading…" : "Save campaign"}</button>
    </form>
  </main>;
}
