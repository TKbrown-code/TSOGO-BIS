import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import Navbar from "./components/navigation/Navbar";
import Footer from "./components/navigation/Footer";
import Home from "./pages/Home";       // create Home page
import Checkout from "./pages/Checkout"; // create Checkout page
import AdminApp from "./admin/app/AdminApp";
import Cart from "./components/checkout/CartSidebar";
import Logistics from "./pages/logistics";
import  Form  from "./pages/form"
import AppModal from './hooks/AppModal'
import { ModalMessageProvider } from "./context/ModalMessageContext";
import Userdashboard from "./pages/userDashboard";
import UserDashboardComplete from "./pages/UserDashboardComplete";
import UserDashboardNew from "./pages/UserDashboardNew";
import ProtectedRoute from "./admin/auth/ProtectedRoute";
import ProductDetails from "./pages/productDetailspage";
import Shop from "./pages/shop";
import Orders from "./pages/Orders";
import About from "./pages/About";
import Contact from "./pages/Contact";
import TrackOrder from "./pages/TrackOrder";
import Languagebtn from "./components/navigation/languagebtn";
import WhatsAppButton from "./components/navigation/whatsappbtn";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import CookieConsent from "./components/shared/CookieConsent";
import StoreAdPopup from "./components/content/StoreAdPopup";
import BackToTop from "./components/navigation/BackToTop";
import Fapshi from "./pages/Fapshi";
import TermsAndPolicies from "./pages/TermsAndPolicies";
import ResetPassword from "./pages/ResetPassword";
import { updatePageMetadata } from "./utils/seo";
import "./styles/route-errors.css";

function AppContent() {
  const location = useLocation();
  const [productReadyPath, setProductReadyPath] = useState(null);
  const isProductRoute = location.pathname.startsWith("/ProductDetails/");
  const productContentReady = productReadyPath === location.pathname;
  const handleProductReady = useCallback(() => setProductReadyPath(location.pathname), [location.pathname]);
  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return () => { window.history.scrollRestoration = previousRestoration; };
  }, [location.pathname, location.search]);
  useEffect(() => {
    updatePageMetadata(location.pathname);
    if (!isProductRoute) setProductReadyPath(null);
    const match = location.pathname.match(/^\/referrals\/([A-Za-z0-9_-]+)\/([A-Fa-f0-9]{7})\/?$/);
    if (match) {
      localStorage.setItem("tsogo_referral_code", `${match[1]}.${match[2].toUpperCase()}`);
    }
  }, [location.pathname, isProductRoute]);
  // Check if current route is admin or user dashboard
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');

  return (
    <>
    <ErrorBoundary>
     <ModalMessageProvider>
      {!isAdminRoute && !isDashboardRoute && <Navbar />}
      
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />
        <Route path="/referrals/:encodedUserId/:userIdPrefix" element={<Home />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/admin/*" element={
          <ProtectedRoute>
            <AdminApp />
          </ProtectedRoute>
          } />
        <Route path="/logistics" element={<Logistics/>}/>
        {<Route path="/SignUp" element={<Form/>}/>}
        <Route path="/reset-password" element={<ResetPassword/>}/>
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <UserDashboardNew />
            </ProtectedRoute>
          }
        />
        <Route path="/ProductDetails/:id/:name" element={<ProductDetails onReady={handleProductReady} />} />
        <Route path="/shop" element={<Shop/>} />
        <Route path="/orders" element={<Orders/>}/>
        <Route path="/about" element={<About/>}/>
        <Route path="/terms-and-policies" element={<TermsAndPolicies/>}/>
        <Route path="/contact" element={<Contact/>}/>
        <Route path="/track" element={<TrackOrder/>}/>
        <Route path="/track/:trackingId" element={<TrackOrder/>}/>
        <Route path="/fapshi" element={<Fapshi/>}/>
        <Route path="*" element={<main className="route-not-found"><span>TSOGO-BIS</span><h1>We can’t find that page</h1><p>The page may have moved, or the address may be incorrect.</p><Link to="/">Return to the home page</Link></main>} />
      </Routes>
      
      {!isAdminRoute && !isDashboardRoute && (!isProductRoute || productContentReady) && (
        <>
          <Cart />
          <Footer />
          <WhatsAppButton />
        </>
      )}
      
      {!isAdminRoute && <CookieConsent />}
      {!isAdminRoute && !isDashboardRoute && <StoreAdPopup />}
      {!isAdminRoute && <Languagebtn/>}
      {!isAdminRoute && <BackToTop />}
      <AppModal />
      </ModalMessageProvider>
    </ErrorBoundary>
    </>
  );
}

export default function App() {
  return <AppContent />;
}
