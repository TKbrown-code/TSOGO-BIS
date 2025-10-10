import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserContext } from "./useUserContext";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user } = useUserContext();
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("cart")
      .select("*, product_id(*, product_images(*))")
      .eq("user_id", user.id);
    if (!error) setCartItems(data || []);
  }, [user?.id]);

  const addToCart = async (product) => {
    if (!user?.id) return alert("Please log in first.");
    await supabase.from("cart").upsert({
      user_id: user.id,
      product_id: product.id,
      quantity: 1
    });
    fetchCart();
  };

  const removeItem = async (productId) => {
    if (!user?.id) return;
    await supabase.from("cart").delete().eq("user_id", user.id).eq("product_id", productId);
    setCartItems(prev => prev.filter(item => item.product_id.id !== productId));
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (!user?.id) return;
    if (newQuantity < 1) return;

    await supabase
      .from("cart")
      .update({ quantity: newQuantity })
      .eq("user_id", user.id)
      .eq("product_id", productId);

    setCartItems(prev =>
      prev.map(item =>
        item.product_id.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const clearCart = async () => {
    if (!user?.id) return;
    await supabase.from("cart").delete().eq("user_id", user.id);
    setCartItems([]);
  };

  useEffect(() => {
    fetchCart();
  }, [user, fetchCart]);

  return (
    <CartContext.Provider
      value={{ cartItems, cartOpen, setCartOpen, addToCart, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
