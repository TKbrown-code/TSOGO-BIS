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

const addToCart = async (product, quantity = 1, options = {}) => {
  if (!user?.id) {
    alert("Please log in first.");
    return false;
  }
  
  try {
    // Build the selected option - store the entire selectedOption object
    const selectedOption = options.selectedOption || {
      color: options.selectedColor || '',
      size: options.selectedSize || '',
      price: Number(options.price || 0),  // ✅ Store the FINAL price
      shipping_method: options.shippingMethod || '',
      shipping_fee: Number(options.shippingFee || 0),
      added_price: Number(options.added_price || 0),
      size_price: Number(options.size_price || 0),
      weight: Number(options.weight || 0),
      total_weight: Number(options.total_weight || 0),
    };

    console.log('Adding to cart:', {
      product: product.name,
      quantity,
      selectedOption
    });

    // Create a unique key from the display field or combination of options
    const optionKey = selectedOption.display || JSON.stringify(selectedOption);

    // Check if item already exists with the same options
    const { data: existingItems } = await supabase
      .from('cart')
      .select('id, quantity, selected_option')
      .eq('user_id', user.id)
      .eq('product_id', product.id);

    // Find matching item by comparing the entire selected_option
    const existingItem = existingItems?.find(item => {
      const itemKey = item.selected_option?.display || JSON.stringify(item.selected_option);
      return itemKey === optionKey;
    });

    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    if (existingItem) {
      // Update existing item
      console.log('Updating existing cart item:', existingItem.id);
      const { error } = await supabase
        .from('cart')
        .update({
          quantity: newQuantity,
          selected_option: selectedOption,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id);

      if (error) throw error;
    } else {
      // Insert new item
      console.log('Inserting new cart item');
      const { error } = await supabase
        .from('cart')
        .insert([{
          user_id: user.id,
          product_id: product.id,
          quantity: newQuantity,
          selected_option: selectedOption,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (error) throw error;
    }
    
    // Refresh the cart
    await fetchCart();
    console.log('Cart refreshed successfully');
    return true;
  } catch (error) {
    console.error('Error adding to cart:', error);
    alert(`Failed to add item to cart: ${error.message}`);
    return false;
  }
};

  const removeItem = async (cartItemId) => {
    if (!user?.id) return;
    
    // Delete by cart item ID (unique identifier)
    await supabase
      .from("cart")
      .delete()
      .eq("id", cartItemId)
      .eq("user_id", user.id);
    
    setCartItems(prev => prev.filter(item => item.id !== cartItemId));
  };

  const updateQuantity = async (cartItemId, newQuantity) => {
    if (!user?.id) return;
    if (newQuantity < 1) {
      // If quantity is 0, remove the item
      await removeItem(cartItemId);
      return;
    }

    // Update by cart item ID (unique identifier)
    await supabase
      .from("cart")
      .update({ quantity: newQuantity })
      .eq("id", cartItemId)
      .eq("user_id", user.id);

    setCartItems(prev =>
      prev.map(item =>
        item.id === cartItemId
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
