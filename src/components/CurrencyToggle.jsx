import React from "react";
import { useCurrencyContext } from "../context/CurrencyContext";
import "../styles/currencyToggle.css";

export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrencyContext();

  return (
    <div className="currency-toggle">
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
        <option value="XAF">XAF</option>
        <option value="NGN">NGN &#8358;</option>
        <option value="USD">USD $</option>
        <option value="EUR">EUR &euro;</option>
        <option value="CNY">CNY &#165;</option>
        <option value="GHS">GHS &#8373;</option>
      </select>
    </div>
  );
}
