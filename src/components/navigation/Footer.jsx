import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandMonogram from "../../assets/nav-monogram.png";
import "../../styles/footer.css";

const linkGroups = [
  { title: "footer.explore", links: [["nav.home", "/"], ["nav.shop", "/shop"], ["navbar.our_story", "/about"], ["navbar.delivery", "/logistics"], ["footer.terms", "/terms-and-policies"]] },
  { title: "footer.orders", links: [["footer.track_order", "/track"], ["navbar.my_orders", "/orders"], ["footer.get_in_touch", "/contact"]] },
];

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <Link to="/" className="footer-brand-lockup" aria-label={t("navbar.home_aria")}>
            <span className="footer-brand-mark" aria-hidden="true"><img src={BrandMonogram} alt="" /></span>
            <span className="footer-brand-wordmark">TSOGO<span className="footer-brand-dash">-</span>BIS<small>{t("navbar.tagline")}</small></span>
          </Link>
          <p>{t("footer.brand_copy")}</p>
          <Link className="footer-story-link" to="/about">{t("footer.about_short")} <ArrowUpRight size={14} /></Link>
        </div>

        {linkGroups.map((group) => (
          <nav className="site-footer-links" aria-label={t(group.title)} key={group.title}>
            <h2>{t(group.title)}</h2>
            {group.links.map(([label, to]) => <Link to={to} key={to}>{t(label)}</Link>)}
          </nav>
        ))}

        <div className="site-footer-note">
          <span className="footer-note-kicker">{t("footer.simple_kicker")}</span>
          <h2>{t("footer.note_title")}</h2>
          <p>{t("footer.note_copy")}</p>
          <Link to="/shop">{t("footer.browse_shop")} <ArrowUpRight size={14} /></Link>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} TSOGO-BIS</span>
        <span>{t("footer.made_for_cameroon")}</span>
        <span>{t("footer.prices_fcfa")}</span>
      </div>
    </footer>
  );
}
