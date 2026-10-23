import React, { useState } from "react";
import { useCart } from "../../context/CartContext";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import "../../styles/CartSidebar.css";
import { useCurrencyContext } from "../../context/CurrencyContext";
import { useTranslation } from "react-i18next";

export default function CartSidebar() {
  const { cartOpen, setCartOpen, cartItems, removeItem, updateQuantity } = useCart();
  const { convert, currency } = useCurrencyContext();
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const { t } = useTranslation();

  // Calculate item price - use stored price from selected_option
  const calculateItemPrice = (item) => {
    // If we have a stored price in selected_option, use it (this is the FINAL price for the option)
    if (Number(item.selected_option?.price) > 0) {
      return Number(item.selected_option.price);
    }
    // Fallback to base price if no option price stored
    return Number(item.product_id?.price || 0);
  };

  // Calculate total for all items
  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const unitPrice = calculateItemPrice(item);
      const shippingFee = Number(item.selected_option?.shipping_fee || item.selected_option?.shippingFee || 0);
      const quantity = Number(item.quantity || 1);
      return sum + (unitPrice * quantity) + (shippingFee * quantity);
    }, 0);
  };

  const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalShipping = cartItems.reduce((sum, item) => {
    const shippingFee = Number(item.selected_option?.shipping_fee || item.selected_option?.shippingFee || 0);
    const quantity = Number(item.quantity || 1);
    return sum + (shippingFee * quantity);
  }, 0);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  };

  const handleAddQuantity = (cartItemId, quantity) => {
    updateQuantity(cartItemId, quantity);
    showToast(t("cart.updated"));
  };

  return (
    <>
      <div
        className={`cart-sidebar-overlay ${cartOpen ? "active" : ""}`}
        onClick={() => setCartOpen(false)}
      />
      <div className={`cart-sidebar ${cartOpen ? "active" : ""}`} role="dialog" aria-modal="true" aria-label={t("cart.title")} aria-hidden={!cartOpen}>
        <div className="cart-header">
          <div className="header-content">
            <h2>{t("cart.your_bag")} <span>({totalItems})</span></h2>
          </div>
          <button className="close-btn" onClick={() => setCartOpen(false)} aria-label={t("common.close")}>
            ✕
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="cart-empty">
            <div className="empty-icon"><ShoppingCart size={48} /></div>
            <p className="empty-text">{t("cart.empty")}</p>
            <p className="empty-subtext">{t("cart.empty_hint")}</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map((item) => {
                const product = item.product_id;
                const quantity = item.quantity || 1;
                const imageUrl = product?.product_images?.find((image) => image.is_primary)?.image_url || product?.product_images?.[0]?.image_url;

                return (
                  <div className="cart-item" key={item.id}>
                    <div className="item-image-wrapper">
                      <img
                        src={imageUrl || "/placeholder.png"}
                        alt={product?.name || t("product.details")}
                        className="cart-thumbnail"
                      />
                    </div>
                    <div className="cart-info">
                      <h4 className="item-name">{product.name}</h4>
                      <div className="item-details">
                        <div className="item-price-row">
                          <div className="price-breakdown">
                            <span className="unit-price">
                              {convert(Number(product?.price || 0), currency)} FCFA × {quantity}
                            </span>
                            {item.selected_option?.added_price > 0 && (
                              <span className="extra-price">
                              + {convert(Number(item.selected_option.added_price), currency)} FCFA ({t("cart.color")})
                              </span>
                            )}
                            <br />
                            {item.selected_option?.size_price > 0 && (
                              <span className="extra-price">
                                + {convert(Number(item.selected_option.size_price), currency)} FCFA ({t("cart.size")})
                              </span>
                            )}
                            {item.selected_option?.shipping_fee > 0 && (
                              <span className="shipping-price">
                                + {convert(Number(item.selected_option.shipping_fee || item.selected_option.shippingFee), currency)} FCFA ({t("cart.shipping")})
                              </span>
                            )}
                          </div>
                          <div className="item-total">
                            {convert(calculateItemPrice(item) * quantity, currency)} FCFA
                          </div>
                        </div>
                        <span className="item-qty">× {quantity}</span>
                      </div>
                      <div className="cart-quantity-controls">
                        <button
                          className="qty-btn"
                          onClick={() => handleAddQuantity(item.id, quantity - 1)}
                          disabled={quantity <= 1}
                          aria-label={t("cart.decrease_quantity")}
                        >
                          −
                        </button>
                        <span className="qty-display">{quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() => handleAddQuantity(item.id, quantity + 1)}
                          disabled={quantity >= 99}
                          aria-label={t("cart.increase_quantity")}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => {
                        removeItem(item.id);
                        showToast(t("cart.removed"));
                      }}
                      aria-label={t("cart.remove")}
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
                  <span className="summary-label">{t("cart.total_items", { count: totalItems })}</span>
                  <span className="summary-value total-amount">
                    {convert(calculateTotal(), currency)} FCFA
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
                {t("cart.proceed_checkout")}
              </button>
            </div>
          </>
        )}

        {toast && <div className="cart-toast">{toast}</div>}
      </div>
    </>
  );
}
