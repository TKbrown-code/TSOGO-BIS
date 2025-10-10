import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
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

  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.product_id.price) * (item.quantity || 1),
    0
  );

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  };

  const handleAddQuantity = (productId, quantity) => {
    updateQuantity(productId, quantity);
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
          <h2>Your Cart ({cartItems.length})</h2>
          <button className="close-btn" onClick={() => setCartOpen(false)}>✕</button>
        </div>

        {cartItems.length === 0 ? (
          <p className="cart-empty">Your cart is empty.</p>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map((item) => {
                const product = item.product_id;
                const quantity = item.quantity || 1;
                // const image = imageUrls[product.id] || "/placeholder.png"; // 'image' is not used

                return (
                  <div className="cart-item" key={product.id}>
                    <img
                      src={imageUrls[item.product_id.id] || "/placeholder.png"}
                      alt={item.product_id.name}
                      className="order-img premium-img"
                    />
                    <div className="cart-info">
                      <h4>{product.name}</h4>
                      <p>
                        {convert(Number(product.price) * quantity, currency)} {currency} 
                        <span className="cart-qty">({quantity})</span>
                      </p>
                      <div className="cart-quantity-controls">
                        <button
                          onClick={() => handleAddQuantity(product.id, quantity - 1)}
                          disabled={quantity <= 1}
                        >−</button>
                        <input
                          type="number"
                          value={quantity}
                          min="1"
                          onChange={(e) =>
                            handleAddQuantity(product.id, Math.max(1, Number(e.target.value)))
                          }
                        />
                        <button onClick={() => handleAddQuantity(product.id, quantity + 1)}>+</button>
                      </div>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => {
                        removeItem(product.id);
                        showToast("Removed from cart");
                      }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
            <div className="cart-summary">
              <div className="cart-total">
                <strong>Total:</strong> {convert(total, currency)} {currency}
              </div>
              <button
                className="btn checkout-btn"
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
