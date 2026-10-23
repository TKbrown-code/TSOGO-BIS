import React, { useState } from "react";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useModalMessage } from "../context/ModalMessageContext";
import "../styles/contact.css";

export default function Contact() {
  const { t } = useTranslation();
  const { siteEmail, sitePhone } = useSiteSettings();
  const { showAlert } = useModalMessage();
  const [sent, setSent] = useState(false);
  const phoneDigits = (sitePhone || "").replace(/\D/g, "");
  const emailAddress = (siteEmail || "").trim();

  const submitMessage = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!emailAddress) {
      showAlert(t("contact_page.email_unavailable_message"), t("contact_page.email_unavailable_title"), "warning");
      return;
    }
    const subject = String(form.get("subject") || t("contact_page.default_subject")).trim();
    const body = [
      `${t("contact_page.name")}: ${String(form.get("name") || "").trim()}`,
      `${t("contact_page.email")}: ${String(form.get("email") || "").trim()}`,
      "",
      String(form.get("message") || "").trim(),
    ].join("\n");
    window.location.href = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
    event.currentTarget.reset();
  };

  return (
    <main className="contact-page contact-page-redesign">
      <section className="contact-hero contact-hero-redesign">
        <div className="contact-hero-container">
          <span className="contact-kicker">{t("contact_page.help_kicker")}</span>
          <h1 className="contact-hero-title">{t("contact_page.title_line1")}<br /><span>{t("contact_page.title_line2")}</span></h1>
          <p className="contact-hero-subtitle">{t("contact_page.intro")}</p>
          <a className="contact-hero-email" href={emailAddress ? `mailto:${emailAddress}` : "#contact-message"}><Mail size={16} />{emailAddress || t("contact_page.send_message")}<ArrowUpRight size={14} /></a>
        </div>
      </section>

      <section className="contact-main contact-main-redesign">
        <div className="contact-sidebar">
          <span className="contact-kicker">{t("contact_page.options_kicker")}</span>
          <h2>{t("contact_page.options_title")}</h2>
          {emailAddress ? <a className="contact-method-card" href={`mailto:${emailAddress}`}><span className="contact-method-icon"><Mail size={18} /></span><span><small>{t("contact_page.email")}</small><strong>{emailAddress}</strong><em>{t("contact_page.open_email")}</em></span><ArrowUpRight size={15} /></a> : <div className="contact-method-card is-unavailable"><span className="contact-method-icon"><Mail size={18} /></span><span><small>{t("contact_page.email")}</small><strong>{t("contact_page.email_unavailable_title")}</strong><em>{t("contact_page.use_form")}</em></span></div>}
          {phoneDigits && <a className="contact-method-card" href={`tel:${sitePhone}`}><span className="contact-method-icon"><Phone size={18} /></span><span><small>{t("contact_page.phone")}</small><strong>{sitePhone}</strong><em>{t("contact_page.call_store")}</em></span><ArrowUpRight size={15} /></a>}
          {phoneDigits && <a className="contact-method-card" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer"><span className="contact-method-icon"><MessageCircle size={18} /></span><span><small>WhatsApp</small><strong>{t("contact_page.message_team")}</strong><em>{t("whatsapp.chat_label")}</em></span><ArrowUpRight size={15} /></a>}
          <div className="contact-response-note"><MapPin size={16} /><p>{t("contact_page.delivery_note")} <Link to="/logistics">{t("navbar.delivery")}</Link> {t("contact_page.and")} <Link to="/track">{t("nav.track")}</Link>.</p></div>
        </div>

        <section className="contact-form-section contact-form-redesign" id="contact-message" aria-labelledby="contact-form-title">
          <span className="contact-kicker">{t("contact_page.form_kicker")}</span>
          <h2 id="contact-form-title">{t("contact_page.form_title")}</h2>
          <p className="contact-form-intro">{t("contact_page.form_intro")}</p>
          <form className="contact-form contact-form-redesign-fields" onSubmit={submitMessage}>
            <div className="contact-form-row">
              <label className="form-group">{t("contact_page.your_name")}<input name="name" type="text" autoComplete="name" placeholder={t("contact_page.name")} required /></label>
              <label className="form-group">{t("contact_page.email_address")}<input name="email" type="email" autoComplete="email" placeholder={t("contact_page.email_placeholder")} required /></label>
            </div>
            <label className="form-group">{t("contact_page.subject")}<input name="subject" type="text" placeholder={t("contact_page.subject_placeholder")} /></label>
            <label className="form-group">{t("contact_page.your_message")}<textarea name="message" placeholder={t("contact_page.message_placeholder")} rows={5} required /></label>
            {sent && <p className="contact-sent-note" role="status">{t("contact_page.sent_note")}</p>}
            <button type="submit" className="submit-btn"><Send size={15} /> {t("contact_page.prepare_email")}</button>
          </form>
        </section>
      </section>
    </main>
  );
}
