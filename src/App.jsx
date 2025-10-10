import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";       // create Home page
import Checkout from "./pages/Checkout"; // create Checkout page
import AdminApp from "./pages/AdminApp";
import Cart from "./components/CartSidebar";
import Logistics from "./pages/logistics";
import  Form  from "./pages/form";
import AppModal from './hooks/AppModal'
import { ModalMessageProvider } from "./context/ModalMessageContext";
import Userdashboard from "./pages/userDashboard";
import ProductDetails from "./pages/productDetailspage";
import Shop from "./pages/shop";
import Orders from "./pages/Orders";
import Languagebtn from "./components/languagebtn";
import WhatsAppButton from "./components/whatsappbtn";

export default function App() {
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false); // move here

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
     <ModalMessageProvider>
      <Navbar cartCount={totalItems} />
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
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/logistics" element={<Logistics/>}/>
        <Route path="/SignUp" element={<Form/>}/>
        <Route path="/dashboard" element={<Userdashboard/>}/>
        <Route path="/ProductDetails/:tag/:id/:name" element={<ProductDetails />} />
        <Route path="/shop" element={<Shop/>} />
        <Route path="/orders" element={<Orders/>}/>
      </Routes>
      <Cart 
        cartItems={cartItems} 
        cartOpen={cartOpen} 
        setCartOpen={setCartOpen} 
      />

      <Footer />
       <AppModal />
      </ModalMessageProvider>
      <Languagebtn/>
      <WhatsAppButton />
    </>
  );
}
