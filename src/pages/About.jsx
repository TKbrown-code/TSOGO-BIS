import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BadgeCheck, Globe2, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import "../styles/about.css";

const principles = [
  { icon: <Sparkles />, title: "about_page.principle_edit_title", copy: "about_page.principle_edit_copy" },
  { icon: <ShieldCheck />, title: "about_page.principle_clarity_title", copy: "about_page.principle_clarity_copy" },
  { icon: <Globe2 />, title: "about_page.principle_delivery_title", copy: "about_page.principle_delivery_copy" },
  { icon: <HeartHandshake />, title: "about_page.principle_people_title", copy: "about_page.principle_people_copy" },
];

export default function About() {
  const { t } = useTranslation();
  return (
    <main className="about-page about-page-redesign">
      <section className="about-hero about-hero-redesign">
        <div className="about-hero-container">
          <span className="about-kicker">{t("about_page.kicker")}</span>
          <h1 className="about-hero-title">{t("about_page.title_line1")}<br /><span className="highlight">{t("about_page.title_line2")}</span></h1>
          <p className="about-hero-subtitle">{t("about_page.intro")}</p>
          <div className="about-hero-actions"><Link to="/shop">{t("about_page.explore_collection")} <ArrowRight size={16} /></Link><span><BadgeCheck size={16} /> {t("about_page.prices_cfa")}</span></div>
        </div>
      </section>
      <section className="about-story-redesign">
        <div className="about-story-art" aria-hidden="true"><span className="about-story-ring">T</span><i /><i /><i /></div>
        <div className="about-story-copy"><span className="about-kicker">{t("about_page.approach")}</span><h2>{t("about_page.story_title")}</h2><p>{t("about_page.story_copy_one")}</p><p>{t("about_page.story_copy_two")}</p><Link to="/logistics">{t("about_page.delivery_link")} <ArrowRight size={15} /></Link></div>
      </section>
      <section className="about-principles">
        <div className="about-section-heading"><span className="about-kicker">{t("about_page.values_kicker")}</span><h2>{t("about_page.values_title")}</h2><p>{t("about_page.values_copy")}</p></div>
        <div className="about-principles-grid">{principles.map((item) => <article className="about-principle-card" key={item.title}><span className="about-principle-icon">{item.icon}</span><h3>{t(item.title)}</h3><p>{t(item.copy)}</p></article>)}</div>
      </section>
      <section className="about-contact-band"><div><span className="about-kicker">{t("about_page.help_kicker")}</span><h2>{t("about_page.help_title")}</h2><p>{t("about_page.help_copy")}</p></div><Link to="/contact">{t("footer.get_in_touch")} <ArrowRight size={16} /></Link></section>
    </main>
  );
}
