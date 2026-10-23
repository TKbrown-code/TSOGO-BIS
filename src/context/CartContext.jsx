import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useUserContext } from "./useUserContext";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user } = useUserContext();
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user?.id) { setCartItems([]); return; }
    const { data, error } = await supabase.from("cart_items")
      .select("*, product_id:products(id,slug,name,description,price,currency,stock_quantity,product_images(image_url,is_primary,sort_order))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { console.error("Unable to load cart:", error.message); return; }
    setCartItems((data || []).map((item) => ({ ...item, selected_option: item.selected_options || {} })));
  }, [user?.id]);

  const addToCart = async (product, quantity = 1, options = {}) => {
    if (!user?.id) return false;
    const selectedOptions = options.selectedOptions || options.selectedOption || options.selected_options || {};
    const variantKey = selectedOptions.display || JSON.stringify(selectedOptions);
    const increment = Math.min(99, Math.max(1, Number(quantity) || 1));
    const { data: existing, error: lookupError } = await supabase.from("cart_items")
      .select("id,quantity")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .eq("variant_key", variantKey)
      .maybeSingle();
    if (lookupError) { console.error("Unable to check cart:", lookupError.message); return false; }
    const write = existing
      ? supabase.from("cart_items").update({ quantity: Math.min(99, existing.quantity + increment), selected_options: selectedOptions }).eq("id", existing.id).eq("user_id", user.id)
      : supabase.from("cart_items").insert({ user_id: user.id, product_id: product.id, quantity: increment, variant_key: variantKey, selected_options: selectedOptions });
    const { error } = await write;
    if (error) { console.error("Unable to add product to cart:", error.message); return false; }
    await fetchCart();
    return true;
  };

  const removeItem = async (cartItemId) => {
    if (!user?.id) return;
    const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId).eq("user_id", user.id);
    if (!error) setCartItems((items) => items.filter((item) => item.id !== cartItemId));
  };

  const updateQuantity = async (cartItemId, newQuantity) => {
    if (!user?.id) return;
    if (newQuantity < 1) return removeItem(cartItemId);
    const quantity = Math.min(99, Number(newQuantity));
    const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", cartItemId).eq("user_id", user.id);
    if (!error) setCartItems((items) => items.map((item) => item.id === cartItemId ? { ...item, quantity } : item));
  };

  const clearCart = async () => {
    if (!user?.id) return;
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
    if (!error) setCartItems([]);
  };

  useEffect(() => { fetchCart(); }, [fetchCart]);

  return <CartContext.Provider value={{ cartItems, cartOpen, setCartOpen, addToCart, removeItem, updateQuantity, clearCart, refreshCart: fetchCart }}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
