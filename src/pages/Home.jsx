import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Globe2, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import Header from "../components/content/Hero";
import FeaturedProducts from "../components/catalog/FeaturedProducts";
import ReferralAwarenessPopup from "../components/content/ReferralAwarenessPopup";
import "../styles/homepage.css";

const assurances = [
  { icon: BadgeCheck, title: "home_page.assurance_care_title", detail: "home_page.assurance_care_copy" },
  { icon: PackageCheck, title: "home_page.assurance_confidence_title", detail: "home_page.assurance_confidence_copy" },
  { icon: Globe2, title: "home_page.assurance_world_title", detail: "home_page.assurance_world_copy" },
];

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="home-page">
      <Header />
      <ReferralAwarenessPopup />
      <FeaturedProducts />
      <section className="home-intro" aria-label={t("home_page.approach_aria")}>
        <div className="home-intro-heading">
          <span className="home-eyebrow">{t("home_page.intro_kicker")}</span>
          <h2>{t("home_page.intro_title")}</h2>
        </div>
        <p>{t("home_page.intro_copy")}</p>
      </section>
      <section className="home-assurances" aria-label={t("home_page.assurances_aria")}>
        {assurances.map(({ icon: Icon, title, detail }, index) => (
          <article className="assurance-card" key={title}>
            <span className="assurance-number">0{index + 1}</span>
            <Icon className="assurance-icon" size={22} strokeWidth={1.6} />
            <h3>{t(title)}</h3>
            <p>{t(detail)}</p>
          </article>
        ))}
      </section>
      <section className="home-discover">
        <div>
          <span className="home-eyebrow">{t("home_page.discover_kicker")}</span>
          <h2>{t("home_page.discover_title")}</h2>
        </div>
        <Link to="/shop" className="discover-link">{t("home_page.explore_shop")} <ArrowRight size={17} /></Link>
      </section>
    </main>
  );
}
