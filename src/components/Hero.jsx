import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SVG from "../assets/shop-svgrepo-com.svg";
import SVG1 from "../assets/bell-svgrepo-com.svg";
import SVG2 from "../assets/camera-svgrepo-com.svg";
import SVG3 from "../assets/bag-1-svgrepo-com.svg";

export default function Hero() {
  const svgs = [SVG, SVG1, SVG2, SVG3];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % svgs.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const { t } = useTranslation();

  return (
    <section className="hero">
      <div className="hero-content">
        <span className="hero-badge">{t('hero.badge')}</span>
        <h1>{t('hero.title')}</h1>
        <p>{t('hero.subtitle')}</p>
        
        <div className="hero-buttons">
          <Link to="/shop">
            <button className="hero-btn-primary">{t('hero.shop_now')}</button>
          </Link>
          <Link to="/about">
            <button className="hero-btn-secondary">{t('hero.learn_more')}</button>
          </Link>
        </div>
      </div>
      <div className="hero-svg">
        <img 
          key={currentIndex}
          src={svgs[currentIndex]} 
          alt={`Hero Illustration ${currentIndex + 1}`} 
        />
      </div>
    </section>
  );
}
