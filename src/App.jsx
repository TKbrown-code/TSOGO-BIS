import React, { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";       // create Home page
import Checkout from "./pages/Checkout"; // create Checkout page
import AdminApp from "./pages/AdminApp";
import Cart from "./components/CartSidebar";
import Logistics from "./pages/logistics";
import  Form  from "./pages/form"
import AppModal from './hooks/AppModal'
import { ModalMessageProvider } from "./context/ModalMessageContext";
import Userdashboard from "./pages/userDashboard";
import UserDashboardComplete from "./pages/UserDashboardComplete";
import UserDashboardNew from "./pages/UserDashboardNew";
import ProtectedRoute from "./components/ProtectedRoute";
import ProductDetails from "./pages/productDetailspage";
import Shop from "./pages/shop";
import Orders from "./pages/Orders";
import About from "./pages/About";
import Contact from "./pages/Contact";
import TrackOrder from "./pages/TrackOrder";
import Languagebtn from "../../TSOGOBIS/src/components/languagebtn";
import WhatsAppButton from "./components/whatsappbtn";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieConsent from "./components/CookieConsent";
import LanguageCurrencySwitcher from "./components/LanguageCurrencySwitcher";
import BackToTop from "./components/BackToTop";
import Fapshi from "./pages/Fapshi";

function AppContent() {
  const location = useLocation();
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false); // move here
  
  // Check if current route is admin or user dashboard
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isSignUpRoute = location.pathname.startsWith('/SignUp');

  const addToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setCartOpen(true); // open modal when added
  };

  // These functions are likely handled by CartContext, so they are not needed here.
  // const updateQuantity = (id, amount) => { /* same as before */ };
  // const removeItem = (id) => { /* same as before */ };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
    <ErrorBoundary>
     <ModalMessageProvider>
      {/* Only show Navbar on non-admin and non-dashboard routes */}
      {!isAdminRoute && !isDashboardRoute && <Navbar cartCount={totalItems} />}
      
      <Routes>
        <Route
          path="/"
          element={
            <Home
            cartItems={cartItems}
            addToCart={addToCart}
            cartOpen={cartOpen}          // pass state
            setCartOpen={setCartOpen}    // pass setter
          />
          }
        />
        <Route path="/checkout" element={<Checkout cartItems={cartItems} />} />
        <Route path="/admin/*" element={
          <ProtectedRoute>
            <AdminApp />
          </ProtectedRoute>
          } />
        <Route path="/logistics" element={<Logistics/>}/>
        {<Route path="/SignUp" element={<Form/>}/>}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <UserDashboardNew />
            </ProtectedRoute>
          }
        />
        <Route path="/ProductDetails/:id/:name" element={<ProductDetails />} />
        <Route path="/shop" element={<Shop/>} />
        <Route path="/orders" element={<Orders/>}/>
        <Route path="/about" element={<About/>}/>
        <Route path="/contact" element={<Contact/>}/>
        <Route path="/track" element={<TrackOrder/>}/>
        <Route path="/track/:trackingId" element={<TrackOrder/>}/>
        <Route path="/fapshi" element={<Fapshi/>}/>
      </Routes>
      
      {/* Only show Cart, Footer, Language button, and WhatsApp on non-admin and non-dashboard routes */}
      {!isAdminRoute && !isDashboardRoute && (
        <>
          <Cart 
            cartItems={cartItems} 
            cartOpen={cartOpen} 
            setCartOpen={setCartOpen} 
          />
          <Footer />
          <WhatsAppButton />
        </>
      )}
      
      {/* Cookie Consent Banner - Shows on all pages */}
      <CookieConsent />
      <Languagebtn/>
      <BackToTop />
      <AppModal />
      </ModalMessageProvider>
    </ErrorBoundary>
    </>
  );
}

export default function App() {
  return <AppContent />;
}
