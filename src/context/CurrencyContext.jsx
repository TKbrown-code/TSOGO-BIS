// context/CurrencyContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { SUPABASE_ANON_KEY } from "../lib/constants";

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children, defaultCurrency = "XAF" }) => {
  const [currency, setCurrency] = useState(defaultCurrency);
  const [rates, setRates] = useState(() => {
    // load cached rates from localStorage on init
    const saved = localStorage.getItem("currencyRates");
    return saved ? JSON.parse(saved) : {};
  });
  const [loading, setLoading] = useState(Object.keys(rates).length === 0);
  const [error, setError] = useState(null);

  // Fetch rates from Supabase Edge Function
  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
       "https://bompysyuamyalbzmubzo.supabase.co/functions/v1/currency-rate",
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );
      if (response.data?.rates) {
        setRates(response.data.rates);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching currency rates:', err);
      setError('Failed to fetch currency rates');
      // Set fallback rates to prevent app from breaking
      setRates({
        USD: 1,
        EUR: 0.85,
        GBP: 0.73,
        XAF: 555, // Fallback rate
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + interval every 30 minutes
  useEffect(() => {
    fetchRates(); // initial fetch
    const interval = setInterval(fetchRates, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(interval);
  }, [fetchRates]);

  // Convert amount from base to target currency
 const convert = (amount, targetCurrency) => {
  if (!rates || !rates[targetCurrency]) {
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    return isNaN(numAmount) ? amount : numAmount.toFixed(2);
  }
  const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  return isNaN(numAmount) ? amount : (numAmount * rates[targetCurrency]).toFixed(2);
};

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, convert, loading, error }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrencyContext = () => useContext(CurrencyContext);
