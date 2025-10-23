import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import "../styles/CartSidebar.css";
import { useCurrencyContext } from "../context/CurrencyContext";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";

export default function CartSidebar() {
  const { cartOpen, setCartOpen, cartItems, removeItem, updateQuantity } = useCart();
  const { convert, currency } = useCurrencyContext();
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const [imageUrls, setImageUrls] = useState({});

  useEffect(() => {
    const fetchImages = async () => {
      if (cartItems.length === 0) return;

      const allImages = cartItems.flatMap(item => item.product_id.product_images || []);
      await preloadAllImages(allImages);

      const urls = {};
      cartItems.forEach(item => {
        const primaryImage = item.product_id.product_images.find(img => img.is_primary);
        urls[item.product_id.id] = primaryImage
          ? getCachedImage(primaryImage.image_path)
          : "/placeholder.png";
      });

      setImageUrls(urls);
    };

    fetchImages();
  }, [cartItems]);

  // Calculate item price - use stored price from selected_option
  const calculateItemPrice = (item) => {
    // If we have a stored price in selected_option, use it (this is the FINAL price for the option)
    if (item.selected_option?.price) {
      return Number(item.selected_option.price);
    }
    // Fallback to base price if no option price stored
    return Number(item.product_id?.price || 0);
  };

  // Calculate total for all items
  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const unitPrice = calculateItemPrice(item);
      const shippingFee = Number(item.selected_option?.shipping_fee || 0);
      const quantity = Number(item.quantity || 1);
      return sum + (unitPrice * quantity) + (shippingFee * quantity);
    }, 0);
  };

  const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalShipping = cartItems.reduce((sum, item) => {
    const shippingFee = Number(item.selected_option?.shipping_fee || 0);
    const quantity = Number(item.quantity || 1);
    return sum + (shippingFee * quantity);
  }, 0);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  };

  const handleAddQuantity = (cartItemId, quantity) => {
    updateQuantity(cartItemId, quantity);
    showToast("Cart updated");
  };

  return (
    <>
      <div
        className={`cart-sidebar-overlay ${cartOpen ? "active" : ""}`}
        onClick={() => setCartOpen(false)}
      />
      <div className={`cart-sidebar ${cartOpen ? "active" : ""}`}>
        <div className="cart-header">
          <div className="header-content">
            <h2>Shopping Cart ({totalItems})</h2>
          </div>
          <button className="close-btn" onClick={() => setCartOpen(false)} aria-label="Close cart">
            ✕
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="cart-empty">
            <div className="empty-icon"><ShoppingCart size={48} /></div>
            <p className="empty-text">Your cart is empty</p>
            <p className="empty-subtext">Add some products to get started!</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map((item) => {
                const product = item.product_id;
                const quantity = item.quantity || 1;

                return (
                  <div className="cart-item" key={item.id}>
                    <div className="item-image-wrapper">
                      <img
                        src={imageUrls[item.product_id.id] || "/placeholder.png"}
                        alt={item.product_id.name}
                        className="cart-thumbnail"
                      />
                    </div>
                    <div className="cart-info">
                      <h4 className="item-name">{product.name}</h4>
                      <div className="item-details">
                        <div className="item-options">
                          {item.selected_option?.display ? (
                            <span>{item.selected_option.display}</span>
                          ) : (
                            <>
                              {Object.entries(item.selected_option || {}).map(([key, value]) => {
                                // Skip internal/metadata fields
                                if (
                                  key === 'shipping_method' || 
                                  key === 'shipping_fee' || 
                                  key === 'added_price' || 
                                  key === 'size_price' ||
                                  key === 'weight' ||
                                  key === 'total_weight' ||
                                  key === 'display' ||
                                  !value
                                ) return null;
                                
                                return (
                                  <span key={key}>
                                    {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                                  </span>
                                );
                              })}
                            </>
                          )}
                          {item.selected_option?.shipping_method && (
                          <><br /> <span>Shipping: {item.selected_option.shipping_method}</span></>
                          )}
                        </div>
                        <div className="item-price-row">
                          <div className="price-breakdown">
                            <span className="unit-price">
                              {convert(Number(product.price.toFixed(0)), currency)} × {quantity}
                            </span>
                            {item.selected_option?.added_price > 0 && (
                              <span className="extra-price">
                                + {convert(Number(item.selected_option.added_price), currency)} (color)
                              </span>
                            )}
                            {item.selected_option?.size_price > 0 && (
                              <span className="extra-price">
                                + {convert(Number(item.selected_option.size_price), currency)} (size)
                              </span>
                            )}
                            {item.selected_option?.shipping_fee > 0 && (
                              <span className="shipping-price">
                                + {convert(Number(item.selected_option.shipping_fee), currency)} (shipping)
                              </span>
                            )}
                          </div>
                          <div className="item-total">
                            {convert(calculateItemPrice(item) * quantity, currency)} {currency}
                          </div>
                        </div>
                        <span className="item-qty">× {quantity}</span>
                      </div>
                      <div className="cart-quantity-controls">
                        <button
                          className="qty-btn"
                          onClick={() => handleAddQuantity(item.id, quantity - 1)}
                          disabled={quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="qty-display">{quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() => handleAddQuantity(item.id, quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => {
                        removeItem(item.id);
                        showToast("Removed from cart");
                      }}
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="cart-summary">
              <div className="summary-details">
                <div className="summary-row total-row">
                  <span className="summary-label">Total ({totalItems} items):</span>
                  <span className="summary-value total-amount">
                    {convert(calculateTotal(), currency)} {currency}
                  </span>
                </div>
              </div>
              <button
                className="checkout-btn"
                onClick={() => {
                  setCartOpen(false);
                  navigate("/checkout");
                }}
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}

        {toast && <div className="cart-toast">{toast}</div>}
      </div>
    </>
  );
}
