import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { CartProvider } from "./context/CartContext.jsx"; // import
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./index.css";
import { UserProvider } from "./context/useUserContext.jsx";
import { CurrencyProvider } from "./context/CurrencyContext";
import "./i18n/i18n";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
    <UserProvider>
      <CartProvider>
          <CurrencyProvider>
        <App />
          </CurrencyProvider>
      </CartProvider>
    </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);
