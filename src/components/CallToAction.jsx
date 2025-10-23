import React from "react";
import { useTranslation } from "react-i18next";
import "../styles/callToAction.css";

/**
 * CallToAction
 * - A bold section with a clear headline, description, and action button
 */
export default function CallToAction({
  title,
  subtitle,
  primaryText,
  primaryHref = "/shop",
  secondaryText,
  secondaryHref = "/about"
}) {
  const { t } = useTranslation();

  return (
    <section className="cta-section" aria-labelledby="cta-heading">
      <div className="cta-container">
        <span className="cta-badge">{t('cta.badge')}</span>
        <h2 id="cta-heading" className="cta-title">{title || t('cta.title')}</h2>
        <p className="cta-subtitle">{subtitle || t('cta.subtitle')}</p>
        
        <div className="cta-stats">
          <div className="cta-stat">
            <span className="stat-number">10K+</span>
            <span className="stat-label">{t('cta.stats.happy_customers')}</span>
          </div>
          <div className="cta-stat">
            <span className="stat-number">50K+</span>
            <span className="stat-label">{t('cta.stats.products_sold')}</span>
          </div>
          <div className="cta-stat">
            <span className="stat-number">4.8★</span>
            <span className="stat-label">{t('cta.stats.average_rating')}</span>
          </div>
        </div>

        <div className="cta-actions">
          <a href={primaryHref} className="cta-btn primary" aria-label={primaryText || t('cta.shop_now')}>
            {primaryText || t('cta.shop_now')}
            <span className="btn-arrow">→</span>
          </a>
          {secondaryText && (
            <a href={secondaryHref} className="cta-btn secondary" aria-label={secondaryText}>
              {secondaryText}
            </a>
          )}
        </div>

        <div className="cta-features">
          <div className="cta-feature-item">
            <span className="feature-check">✓</span>
            <span>{t('cta.features.authentic')}</span>
          </div>
          <div className="cta-feature-item">
            <span className="feature-check">✓</span>
            <span>{t('cta.features.quality')}</span>
          </div>
          <div className="cta-feature-item">
            <span className="feature-check">✓</span>
            <span>{t('cta.features.trusted')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
