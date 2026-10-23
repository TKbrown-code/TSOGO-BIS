import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ClipboardCheck, MapPin, PackageCheck, Truck } from "lucide-react";
import "../styles/logistics.css";

const steps = [
  { icon: <ClipboardCheck />, number: "01", title: "logistics_page.step_order_title", copy: "logistics_page.step_order_copy" },
  { icon: <PackageCheck />, number: "02", title: "logistics_page.step_prepare_title", copy: "logistics_page.step_prepare_copy" },
  { icon: <Truck />, number: "03", title: "logistics_page.step_track_title", copy: "logistics_page.step_track_copy" },
  { icon: <MapPin />, number: "04", title: "logistics_page.step_receive_title", copy: "logistics_page.step_receive_copy" },
];

export default function Logistics() {
  const { t } = useTranslation();
  return (
    <main className="logistics-page logistics-page-redesign">
      <section className="logistics-hero logistics-hero-redesign"><div className="logistics-hero-inner"><span className="logistics-kicker">{t("logistics_page.kicker")}</span><h1 className="hero-title">{t("logistics_page.title_line1")}<br /><em>{t("logistics_page.title_line2")}</em></h1><p className="hero-subtitle">{t("logistics_page.intro")}</p><Link className="logistics-track-link" to="/track">{t("logistics_page.track_order")} <ArrowRight size={16} /></Link></div><div className="logistics-hero-seal" aria-hidden="true"><Truck size={32} /><span>TSOGO-BIS<br />{t("navbar.delivery").toUpperCase()}</span></div></section>
      <section className="delivery-steps-section"><div className="delivery-section-heading"><span className="logistics-kicker">{t("logistics_page.steps_kicker")}</span><h2>{t("logistics_page.steps_title")}</h2><p>{t("logistics_page.steps_intro")}</p></div><div className="delivery-steps-grid">{steps.map((step) => <article className="delivery-step-card" key={step.number}><span className="delivery-step-number">{step.number}</span><span className="delivery-step-icon">{step.icon}</span><h3>{t(step.title)}</h3><p>{t(step.copy)}</p></article>)}</div></section>
      <section className="delivery-info-band"><div className="delivery-info-icon"><MapPin size={22} /></div><div><span className="logistics-kicker">{t("logistics_page.details_kicker")}</span><h2>{t("logistics_page.details_title")}</h2><p>{t("logistics_page.details_copy")}</p></div><Link to="/contact">{t("logistics_page.contact_support")} <ArrowRight size={15} /></Link></section>
    </main>
  );
}
