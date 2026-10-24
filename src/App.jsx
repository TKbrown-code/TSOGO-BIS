import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Routes, Route, useLocation, Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "./components/navigation/Navbar";
import Footer from "./components/navigation/Footer";
import Cart from "./components/checkout/CartSidebar";
import AppModal from './hooks/AppModal'
import { ModalMessageProvider } from "./context/ModalMessageContext";
import ProtectedRoute from "./admin/auth/ProtectedRoute";
import Languagebtn from "./components/navigation/languagebtn";
import WhatsAppButton from "./components/navigation/whatsappbtn";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import CookieConsent from "./components/shared/CookieConsent";
import StoreAdPopup from "./components/content/StoreAdPopup";
import BackToTop from "./components/navigation/BackToTop";
import { updatePageMetadata } from "./utils/seo";
import { supabase } from "./lib/supabase";
import "./styles/route-errors.css";

const Home = lazy(() => import("./pages/Home"));
const Checkout = lazy(() => import("./pages/Checkout"));
const AdminApp = lazy(() => import("./admin/app/AdminApp"));
const Logistics = lazy(() => import("./pages/logistics"));
const Form = lazy(() => import("./pages/form"));
const UserDashboardNew = lazy(() => import("./pages/UserDashboardNew"));
const ProductDetails = lazy(() => import("./pages/productDetailspage"));
const Shop = lazy(() => import("./pages/shop"));
const Orders = lazy(() => import("./pages/Orders"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Fapshi = lazy(() => import("./pages/Fapshi"));
const TermsAndPolicies = lazy(() => import("./pages/TermsAndPolicies"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

function ReferralSignupRedirect() {
  const { encodedUserId, userIdPrefix } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const continueReferral = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (!error && data.session?.user) {
        // A referral link is for new-account attribution. Never carry its
        // token through an already signed-in session.
        localStorage.removeItem("tsogo_referral_code");
        navigate("/dashboard", { replace: true });
        return;
      }
      if (/^[A-Za-z0-9_-]+$/.test(encodedUserId || "") && /^[A-Fa-f0-9]{7}$/.test(userIdPrefix || "")) {
        localStorage.setItem("tsogo_referral_code", `${encodedUserId}.${userIdPrefix.toUpperCase()}`);
      } else {
        localStorage.removeItem("tsogo_referral_code");
      }
      navigate("/SignUp", { replace: true });
    };
    continueReferral();
    return () => { active = false; };
  }, [encodedUserId, userIdPrefix, navigate]);

  return <main className="app-route-loading" role="status" aria-live="polite"><span className="app-route-loading-mark">TS</span><span>Opening account signup…</span></main>;
}

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
  }, [location.pathname, isProductRoute]);
  // Check if current route is admin or user dashboard
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');

  return (
    <>
    <ErrorBoundary>
     <ModalMessageProvider>
      {!isAdminRoute && !isDashboardRoute && <Navbar />}
      
      <Suspense fallback={<main className="app-route-loading" role="status" aria-live="polite"><span className="app-route-loading-mark">TS</span><span>Loading TSOGO-BIS…</span></main>}>
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />
        <Route path="/referrals/:encodedUserId/:userIdPrefix" element={<ReferralSignupRedirect />} />
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
      </Suspense>
      
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
