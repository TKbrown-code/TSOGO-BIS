import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faGlobe, 
  faShippingFast, 
  faMobileAlt, 
  faHandshake,
  faShieldAlt,
  faCheckCircle,
  faMapMarkerAlt,
  faUsers,
  faBolt
} from "@fortawesome/free-solid-svg-icons";
import "../styles/about.css";

export default function About() {
  const { t } = useTranslation();
  
  const features = [
    {
      icon: faGlobe,
      title: "Direct from China",
      description: "We source quality products directly from trusted Chinese manufacturers, cutting out middlemen to bring you the best prices."
    },
    {
      icon: faShippingFast,
      title: "Fast & Reliable Delivery",
      description: "Efficient logistics ensure your orders arrive quickly and safely across Cameroon."
    },
    {
      icon: faMobileAlt,
      title: "Mobile Money Payments",
      description: "Pay conveniently with Mobile Money and Orange Money - no bank account needed!"
    },
    {
      icon: faShieldAlt,
      title: "100% Secure",
      description: "Your transactions are protected with industry-standard security measures."
    }
  ];

  const values = [
    {
      icon: faCheckCircle,
      title: "Quality Guaranteed",
      description: "Every product is carefully inspected before shipping to ensure you receive only the best."
    },
    {
      icon: faHandshake,
      title: "Customer First",
      description: "Your satisfaction is our priority. We're here to support you every step of the way."
    },
    {
      icon: faBolt,
      title: "Innovation",
      description: "We continuously improve our platform to make your shopping experience seamless."
    },
    {
      icon: faUsers,
      title: "Community",
      description: "Building a trusted marketplace that serves Cameroonians with pride."
    }
  ];

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-container">
          <h1 className="about-hero-title">
            {t('about.hero_title').split(' ').slice(0, 3).join(' ')} <span className="highlight">{t('about.hero_title').split(' ').slice(3).join(' ')}</span>
          </h1>
          <p className="about-hero-subtitle">
            {t('about.hero_subtitle')}
          </p>
          <div className="hero-badges">
            <div className="badge">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
              <span>{t('about.based_in')}</span>
            </div>
            <div className="badge">
              <FontAwesomeIcon icon={faGlobe} />
              <span>{t('about.sourced_from')}</span>
            </div>
            <div className="badge">
              <FontAwesomeIcon icon={faUsers} />
              <span>10K+ {t('about.happy_customers')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="our-story">
        <div className="story-container">
          <div className="story-content">
            <h2 className="section-title">{t('about.our_story')}</h2>
            <p className="story-text">
              TSOGO-BIS was born from a simple vision: to make quality products accessible 
              to every Cameroonian. We recognized that many people wanted access to the vast 
              selection and competitive prices available from Chinese manufacturers, but faced 
              barriers like complicated payment systems and unreliable shipping.
            </p>
            <p className="story-text">
              Today, we've built a platform that bridges this gap. By sourcing directly from 
              China and accepting Mobile Money and Orange Money payments, we've made international 
              shopping as easy as buying from your local market.
            </p>
            <p className="story-text">
              Our commitment goes beyond just selling products - we're building trust, creating 
              opportunities, and empowering Cameroonians to access the global marketplace with confidence.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="why-choose-us">
        <div className="why-container">
          <h2 className="section-title">{t('about.why_choose')}</h2>
          <p className="section-subtitle">
            {t('about.why_subtitle')}
          </p>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">
                  <FontAwesomeIcon icon={feature.icon} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="payment-section">
        <div className="payment-container">
          <h2 className="section-title">{t('about.easy_payments')}</h2>
          <p className="payment-subtitle">
            {t('about.payment_subtitle')}
          </p>
          <div className="payment-methods">
            <div className="payment-card">
              <div className="payment-icon mobile-money">
                <FontAwesomeIcon icon={faMobileAlt} />
              </div>
              <h3>{t('about.mobile_money')}</h3>
              <p>Pay instantly with MTN Mobile Money</p>
            </div>
            <div className="payment-card">
              <div className="payment-icon orange-money">
                <FontAwesomeIcon icon={faMobileAlt} />
              </div>
              <h3>{t('about.orange_money')}</h3>
              <p>Quick and secure Orange Money payments</p>
            </div>
          </div>
          <p className="payment-note">
            <FontAwesomeIcon icon={faShieldAlt} />
            {t('about.secure_note')}
          </p>
        </div>
      </section>

      {/* Our Values */}
      <section className="our-values">
        <div className="values-container">
          <h2 className="section-title">{t('about.our_values')}</h2>
          <p className="section-subtitle">
            {t('about.values_subtitle')}
          </p>
          <div className="values-grid">
            {values.map((value, index) => (
              <div key={index} className="value-card">
                <div className="value-icon">
                  <FontAwesomeIcon icon={value.icon} />
                </div>
                <h3 className="value-title">{value.title}</h3>
                <p className="value-description">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="about-cta">
        <div className="cta-container">
          <h2 className="cta-title">{t('about.cta_title')}</h2>
          <p className="cta-text">
            {t('about.cta_text')}
          </p>
          <div className="cta-buttons">
            <Link to="/shop" className="cta-btn primary">
              {t('about.start_shopping')}
              <FontAwesomeIcon icon={faShippingFast} />
            </Link>
            <Link to="/contact" className="cta-btn secondary">
              {t('about.contact_us')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
