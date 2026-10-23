import React, { useState } from "react";
import { useCurrencyContext } from "../../context/CurrencyContext";
import "../../styles/currencyToggle.css";
import { ArrowDown } from "lucide-react";

export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrencyContext();
  const [isOpen, setIsOpen] = useState(false);

  const currencyLabels = {
    XAF: "FCFA",
    NGN: "NGN ₦", 
    USD: "USD $",
    EUR: "EUR €",
    CNY: "CNY ¥",
    GHS: "GHS ₵"
  };

  return (
    <div className="currency-toggle" onClick={() => setIsOpen(!isOpen)}>
      <div className="currency-display">
        {currencyLabels[currency]}
        <ArrowDown size={16} className={`dropdown-icon ${isOpen ? 'open' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="currency-options">
          {Object.entries(currencyLabels).map(([code, label]) => (
            <div 
              key={code}
              className={`currency-option ${currency === code ? 'active' : ''}`}
              onClick={() => setCurrency(code)}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
