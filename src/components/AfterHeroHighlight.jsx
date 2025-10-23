// components/AfterHeroHighlight.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FaShippingFast, FaShieldAlt, FaGem } from "react-icons/fa";
import "../styles/afterHeroHighlight.css";
// 'motion' is used in the JSX, so it's not unused. The linter might be confused.
// No changes needed for 'motion' as it's correctly used.

export default function AfterHeroHighlight({
  title,
  subtitle,
  features
}) {
  const { t } = useTranslation();

  const defaultFeatures = [
    { icon: <FaShippingFast />, heading: t('after_hero.features.fast_delivery.heading'), text: t('after_hero.features.fast_delivery.text') },
    { icon: <FaGem />, heading: t('after_hero.features.premium_quality.heading'), text: t('after_hero.features.premium_quality.text') },
    { icon: <FaShieldAlt />, heading: t('after_hero.features.secure_payments.heading'), text: t('after_hero.features.secure_payments.text') }
  ];
  return (
    <section className="after-hero">
      <div className="after-hero-overlay" />

      <motion.div 
        className="after-hero-container"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        {/* Heading */}
        <motion.h2 
          className="after-hero-title"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {title || t('after_hero.title')}
        </motion.h2>
        
        <motion.p 
          className="after-hero-subtitle"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
        >
          {subtitle || t('after_hero.subtitle')}
        </motion.p>

        {/* Features */}
        <div className="after-hero-features">
          {(features || defaultFeatures).map((f, i) => (
            <motion.div
              key={i}
              className="after-hero-card"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 * i }}
              viewport={{ once: true }}
            >
              <div className="after-hero-icon">{f.icon}</div>
              <h3>{f.heading}</h3>
              <p>{f.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
