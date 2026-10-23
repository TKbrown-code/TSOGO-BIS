import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText } from "lucide-react";
import { useSiteSettings } from "../context/SiteSettingsContext";
import "../styles/terms-and-policies.css";

export default function TermsAndPolicies() {
  const { t } = useTranslation();
  const { termsAndPolicies, loading } = useSiteSettings();
  const sections = (termsAndPolicies || "").trim().split(/\n\s*\n/).filter(Boolean);

  return (
    <main className="terms-page">
      <article className="terms-document">
        <Link to="/SignUp" className="terms-back"><ArrowLeft size={15} /> {t("terms_page.back")}</Link>
        <div className="terms-heading">
          <span className="terms-icon"><FileText size={19} /></span>
          <span className="terms-eyebrow">{t("terms_page.eyebrow")}</span>
          <h1>{t("terms_page.title")}</h1>
          <p>{t("terms_page.intro")}</p>
        </div>
        <div className="terms-content" aria-live="polite">
          {loading ? <p className="terms-state">{t("terms_page.loading")}</p>
            : sections.length ? sections.map((section, index) => <p key={index}>{section}</p>)
              : <p className="terms-state">{t("terms_page.empty")}</p>}
        </div>
      </article>
    </main>
  );
}
