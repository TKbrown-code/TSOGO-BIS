import React from "react";
import { ArrowDownRight, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../../styles/hero.css";

export default function Hero() {
  const { t } = useTranslation();
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-kicker"><span /> {t("home_page.hero_kicker")}</span>
        <h1>{t("home_page.hero_title_line1")}<br /><em>{t("home_page.hero_title_line2")}</em></h1>
        <p>{t("home_page.hero_description")}</p>
        <div className="hero-actions">
          <Link to="/shop" className="hero-btn-primary">{t("home_page.explore_shop")} <ArrowRight size={17} /></Link>
          <Link to="/about" className="hero-btn-secondary">{t("navbar.our_story")} <ArrowDownRight size={17} /></Link>
        </div>
        <div className="hero-note"><span className="hero-note-rule" /> {t("home_page.hero_note")}</div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-art-orbit" />
        <div className="hero-art-caption"><span>TSOGO-BIS</span><span>{t("home_page.curated_for_living")}</span></div>
        <div className="hero-art-monogram">T<span>.</span></div>
        <div className="hero-art-card hero-art-card-top"><span>01</span><i /></div>
        <div className="hero-art-card hero-art-card-bottom"><span>{t("home_page.thoughtfully_selected")}</span><b>{t("home_page.live_well")}<br />{t("home_page.choose_well")}</b></div>
      </div>
    </section>
  );
}
