import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Cookies from "js-cookie";
import { useCurrencyContext } from "../context/CurrencyContext";
import "../styles/LanguageCurrencySwitcher.css";

export default function LanguageCurrencySwitcher() {
  const { i18n } = useTranslation();
  const { currency, setCurrency } = useCurrencyContext();
  const [showDropdown, setShowDropdown] = useState(false);

  const languages = [
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "zh", name: "中文", flag: "🇨🇳" }
  ];

  const currencies = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" }
  ];

  // Load saved preferences on mount
  useEffect(() => {
    const savedLanguage = Cookies.get("language");
    const savedCurrency = Cookies.get("currency");

    if (savedLanguage && savedLanguage !== i18n.language) {
      i18n.changeLanguage(savedLanguage);
    }

    if (savedCurrency && savedCurrency !== currency) {
      setCurrency(savedCurrency);
    }
  }, []);

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
    Cookies.set("language", langCode, { expires: 365 });
    setShowDropdown(false);
  };

  const handleCurrencyChange = (currencyCode) => {
    setCurrency(currencyCode);
    Cookies.set("currency", currencyCode, { expires: 365 });
    setShowDropdown(false);
  };

  const getCurrentLanguage = () => {
    return languages.find(lang => lang.code === i18n.language) || languages[0];
  };

  const getCurrentCurrency = () => {
    return currencies.find(curr => curr.code === currency) || currencies[0];
  };

  return (
    <div className="lang-curr-switcher">
      <button
        className="switcher-button"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="Language and Currency Settings"
      >
        <span className="current-lang">{getCurrentLanguage().flag}</span>
        <span className="current-curr">{getCurrentCurrency().symbol}</span>
        <span className="dropdown-arrow">{showDropdown ? "▲" : "▼"}</span>
      </button>

      {showDropdown && (
        <>
          <div 
            className="dropdown-overlay" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="switcher-dropdown">
            <div className="dropdown-section">
              <h4 className="dropdown-title">Language</h4>
              <div className="options-list">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    className={`option-item ${i18n.language === lang.code ? "active" : ""}`}
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    <span className="option-flag">{lang.flag}</span>
                    <span className="option-name">{lang.name}</span>
                    {i18n.language === lang.code && <span className="check-mark">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="dropdown-divider"></div>

            <div className="dropdown-section">
              <h4 className="dropdown-title">Currency</h4>
              <div className="options-list">
                {currencies.map(curr => (
                  <button
                    key={curr.code}
                    className={`option-item ${currency === curr.code ? "active" : ""}`}
                    onClick={() => handleCurrencyChange(curr.code)}
                  >
                    <span className="option-symbol">{curr.symbol}</span>
                    <span className="option-name">{curr.code} - {curr.name}</span>
                    {currency === curr.code && <span className="check-mark">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
