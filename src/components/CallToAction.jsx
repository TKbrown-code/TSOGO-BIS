import React from "react";
import "../styles/callToAction.css";

/**
 * CallToAction
 * - A bold section with a clear headline, description, and action button
 */
export default function CallToAction({
  title = "Don’t Miss Out on Our Latest Deals",
  subtitle = "Discover fresh arrivals, exclusive discounts, and handpicked collections tailored for you.",
  primaryText = "Shop Now",
  primaryHref = "/shop",
  secondaryText = "Learn More",
  secondaryHref = "/about"
}) {
  return (
    <section className="cta-section" aria-labelledby="cta-heading">
      <div className="cta-container">
        <h2 id="cta-heading" className="cta-title">{title}</h2>
        <p className="cta-subtitle">{subtitle}</p>
        <div className="cta-actions">
          <a href={primaryHref} className="cta-btn primary" aria-label={primaryText}>
            {primaryText}
          </a>
          {secondaryText && (
            <a href={secondaryHref} className="cta-btn secondary" aria-label={secondaryText}>
              {secondaryText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
