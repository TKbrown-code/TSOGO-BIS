// context/CurrencyContext.jsx
import React, { createContext, useContext } from "react";

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const convert = (amount) => {
    const numericAmount = typeof amount === "number" ? amount : Number.parseFloat(amount);
    return Number.isFinite(numericAmount)
      ? new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(numericAmount)
      : amount;
  };

  return (
    <CurrencyContext.Provider value={{ currency: "FCFA", setCurrency: () => {}, rates: { XAF: 1 }, convert, loading: false, error: null }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrencyContext = () => useContext(CurrencyContext);
