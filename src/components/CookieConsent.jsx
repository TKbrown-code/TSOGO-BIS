import React, { useState, useEffect } from "react";
import { Cookie } from "lucide-react";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import "../styles/CookieConsent.css";

export default function CookieConsent() {
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const cookieConsent = Cookies.get("cookie_consent");
    if (!cookieConsent) {
      // Show banner after a short delay for better UX
      setTimeout(() => {
        setShowBanner(true);
      }, 1000);
    }
  }, []);

  const handleAccept = () => {
    // Set cookie consent for 1 year
    Cookies.set("cookie_consent", "accepted", { expires: 365 });
    setShowBanner(false);
  };

  const handleDecline = () => {
    // Set cookie consent as declined for 30 days
    Cookies.set("cookie_consent", "declined", { expires: 30 });
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="cookie-consent-overlay">
      <div className="cookie-consent-banner">
        <div className="cookie-icon"><Cookie size={32} /></div>
        
        <div className="cookie-content">
          <h3 className="cookie-title">
            {t ? t('cookie.title') : 'We use cookies'}
          </h3>
          <p className="cookie-text">
            {t ? t('cookie.message') : 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.'}
          </p>
          
          <div className="cookie-details">
            <details>
              <summary>{t ? t('cookie.learn_more') : 'Learn more'}</summary>
              <div className="cookie-info">
                <p><strong>{t ? t('cookie.essential') : 'Essential Cookies'}:</strong> {t ? t('cookie.essential_desc') : 'Required for the website to function properly.'}</p>
                <p><strong>{t ? t('cookie.functional') : 'Functional Cookies'}:</strong> {t ? t('cookie.functional_desc') : 'Remember your preferences (language, currency).'}</p>
                <p><strong>{t ? t('cookie.analytics') : 'Analytics Cookies'}:</strong> {t ? t('cookie.analytics_desc') : 'Help us understand how you use our site.'}</p>
              </div>
            </details>
          </div>
        </div>

        <div className="cookie-actions">
          <button onClick={handleDecline} className="btn-decline">
            {t ? t('cookie.decline') : 'Decline'}
          </button>
          <button onClick={handleAccept} className="btn-accept">
            {t ? t('cookie.accept') : 'Accept All'}
          </button>
        </div>
      </div>
    </div>
  );
}
