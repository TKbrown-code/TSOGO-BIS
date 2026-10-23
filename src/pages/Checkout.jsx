import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import "../styles/checkout.css";
import { useCurrencyContext } from "../context/CurrencyContext";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/useUserContext";
import PaymentModal from "../components/checkout/PaymentModal";
import { supabase } from "../lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faUser, 
  faPhone, 
  faMapMarkerAlt, 
  faWallet, 
  faMinus, 
  faPlus, 
  faTimes,
  faShoppingCart,
  faInfoCircle
} from "@fortawesome/free-solid-svg-icons";
import { useModalMessage } from "../context/ModalMessageContext";

export default function Checkout() {
  const { t } = useTranslation();
  const { cartItems, updateQuantity, removeItem, clearCart } = useCart();
  const [selectedItems, setSelectedItems] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [imageUrls, setImageUrls] = useState({});
  const { convert, currency } = useCurrencyContext();
  const { profile, user } = useUserContext();
  const { showAlert } = useModalMessage();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [referralCreditBalance, setReferralCreditBalance] = useState(0);
  const [referralCreditLoading, setReferralCreditLoading] = useState(true);
  const [useReferralCredit, setUseReferralCredit] = useState(true);


  const idempotencyKeyRef = useRef(null);

  // Initialize selected items
  useEffect(() => {
    setSelectedItems(cartItems.map((item) => item.id));
  }, [cartItems]);

  useEffect(() => {
    if (profile?.full_name) setName((current) => current || profile.full_name);
  }, [profile?.full_name]);

  useEffect(() => {
    let active = true;
    async function loadReferralCredit() {
      if (!user?.id) { setReferralCreditBalance(0); setReferralCreditLoading(false); return; }
      const { data, error } = await supabase.from("referral_wallet_ledger").select("entry_type, amount").eq("user_id", user.id);
      if (!active) return;
      if (error) {
        if (error.code !== "42P01") console.error("Could not load store credit:", error);
        setReferralCreditLoading(false);
        return;
      }
      setReferralCreditBalance((data || []).reduce((balance, row) => balance + (row.entry_type === "spent" ? -1 : 1) * Number(row.amount || 0), 0));
      setReferralCreditLoading(false);
    }
    loadReferralCredit();
    return () => { active = false; };
  }, [user?.id]);

  // Calculate total
  useEffect(() => {
    const totalPrice = cartItems
      .filter((item) => selectedItems.includes(item.id))
      .reduce((sum, item) => {
        const product = item.product_id;
        const option = item.selected_option || {};
        
        // Use stored price from selected_option (this is the FINAL price for the option)
        const unitPrice = option?.price 
          ? Number(option.price) 
          : Number(product?.price || 0);
        
        // Get shipping fee per unit
        const shippingFee = Number(option?.shipping_fee || 0);
        const quantity = Number(item.quantity) || 1;
        
        // Total = (unitPrice * quantity) + (shipping * quantity)
        const itemTotal = (unitPrice * quantity) + (shippingFee * quantity);
        
        return sum + itemTotal;
      }, 0);
      
    setTotal(totalPrice);
  }, [cartItems, selectedItems]);

  const toggleItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // The server re-reads prices and stock, then reserves inventory in one DB transaction.
  const initializePayment = async () => {
    if (!user) { showAlert(t("checkout.sign_in_message"), t("checkout.sign_in_title"), "warning"); navigate("/SignUp"); return; }
    if (!name || !phone || !address) return showAlert(t("checkout.missing_fields"), t("checkout.missing_title"), "warning");
    if (selectedItems.length === 0) return showAlert(t("checkout.empty_message"), t("checkout.empty_title"), "warning");
    setLoading(true);

    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke("create-fapshi-order", {
        body: {
          name,
          phone,
          address,
          cartItemIds: cartItems.filter((item) => selectedItems.includes(item.id)).map((item) => item.id),
          idempotencyKey: idempotencyKeyRef.current,
          useReferralCredit,
        },
      });
      if (error) {
        const responseError = error.context && typeof error.context.json === "function"
          ? await error.context.json().catch(() => null)
          : null;
        if (/Fapshi rejected the API credentials|Fapshi could not start this payment/i.test(responseError?.error || "")) {
          // Fapshi explicitly rejected the attempt and the server released its stock reservation.
          // A later retry after fixing secrets must create a new checkout attempt.
          idempotencyKeyRef.current = null;
        }
        throw new Error(responseError?.error || error.message || t("checkout.payment_init_failed"));
      }
      if (!data?.success || !data.checkout_id) throw new Error(data?.error || t("checkout.payment_init_failed"));

      if (data.status === "paid" && !data.paymentUrl) {
        clearCart();
        showAlert(t("checkout.store_credit_paid"), t("common.success"), "success");
        navigate(`/orders?checkout_id=${encodeURIComponent(data.checkout_id)}`);
        return;
      }

      setPaymentData({
        url: data.paymentUrl,
        checkoutId: data.checkout_id,
        checkout_id: data.checkout_id,
        reference: data.reference,
        status: data.status || "pending",
      });
      setShowModal(true);

    } catch (err) {
      console.error("Payment init error:", err);
      showAlert(err.message || t("checkout.payment_init_failed"), t("checkout.payment_error_title"), "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Preload images ---
  useEffect(() => {
    const fetchImages = async () => {
      if (!cartItems.length) return;
      const allImages = cartItems.flatMap((item) => item.product_id.product_images || []);
      await preloadAllImages(allImages);
      const urls = {};
      cartItems.forEach((item) => {
        const primaryImage = item.product_id.product_images.find((img) => img.is_primary);
        urls[item.product_id.id] = primaryImage ? getCachedImage(primaryImage.image_url) : "/placeholder.png";
      });
      setImageUrls(urls);
    };
    fetchImages();
  }, [cartItems]);

  return (
    <>
      <main className="checkout-page">
      {cartItems.length === 0 ? <section className="checkout-empty"><span className="checkout-empty-mark"><FontAwesomeIcon icon={faShoppingCart} /></span><p className="checkout-eyebrow">{t("cart.your_bag")}</p><h1>{t("checkout.empty_bag_title")}</h1><p>{t("checkout.empty_bag_copy")}</p><button type="button" className="checkout-shop-link" onClick={() => navigate("/shop")}>{t("cart.continue_shopping")}</button></section> : <section className="checkout-container">
        <form className="checkout-left checkout-card premium-card" onSubmit={(event) => { event.preventDefault(); if (!loading) initializePayment(); }}>
          <p className="checkout-eyebrow">{t("checkout.secure")}</p>
          <h1 className="section-title">{t('checkout.customer_info')}</h1>
          <label className="checkout-field-label" htmlFor="checkout-name">{t('checkout.name')}</label>
          <div className="input-group">
            <FontAwesomeIcon icon={faUser} className="input-icon" />
            <input id="checkout-name" name="name" type="text" autoComplete="name" placeholder={t('checkout.name')} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <label className="checkout-field-label" htmlFor="checkout-phone">{t('checkout.phone')}</label>
          <div className="input-group">
            <FontAwesomeIcon icon={faPhone} className="input-icon" />
            <input id="checkout-phone" name="tel" type="tel" autoComplete="tel" inputMode="tel" placeholder="+237 6XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <label className="checkout-field-label" htmlFor="checkout-address">{t('checkout.address')}</label>
          <div className="input-group">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" />
            <input id="checkout-address" name="street-address" type="text" autoComplete="street-address" placeholder={t('checkout.address')} value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
          <div className="payment-method-badge">
            <FontAwesomeIcon icon={faWallet} />
            <span>{t("checkout.mobile_money")}</span>
          </div>

          <button type="submit" className="btn-primary btn-large" disabled={loading || selectedItems.length === 0}>
            <FontAwesomeIcon icon={faShoppingCart} style={{ marginRight: '8px' }} />
            {loading ? t('checkout.processing') : t('checkout.place_order')} {convert(Math.max(0, total - (useReferralCredit ? referralCreditBalance : 0)), currency)} {currency}
          </button>

          <div className="info-note">
            <FontAwesomeIcon icon={faInfoCircle} className="info-icon" />
            <span>{t("checkout.phone_hint")}</span>
          </div>
        </form>

        <div className="checkout-right checkout-card premium-card">
          <div className="checkout-summary-heading"><div><p className="checkout-eyebrow">{t("checkout.review_selection")}</p><h2 className="section-title">{t('checkout.order_summary')}</h2></div><span className="checkout-item-count">{t("checkout.item_count", { count: cartItems.length })}</span></div>
          <ul className="order-summary-list">
            {cartItems.map((item) => {
              const id = item.product_id?.id;
              const cartItemId = item.id;
              const product = item.product_id;
              const option = item.selected_option || {};
              
              // Use stored price from selected_option (this is the FINAL price for the option)
              const unitPrice = option?.price 
                ? Number(option.price) 
                : Number(product?.price || 0);
              
              const shippingFee = Number(option?.shipping_fee || 0);
              const quantity = Number(item.quantity) || 1;
              const totalPrice = (unitPrice * quantity) + (shippingFee * quantity);

              return (
                <li key={cartItemId} className={`checkout-order-item premium-item ${selectedItems.includes(cartItemId) ? "is-selected" : ""}`}>
                  <input type="checkbox" aria-label={t("checkout.include_item", { name: product.name })} checked={selectedItems.includes(cartItemId)} onChange={() => toggleItem(cartItemId)} />
                  <img src={imageUrls[id] || "/placeholder.png"} alt={item.product_id.name} className="order-img premium-img" />
                  <div className="checkout-order-details">
                    <div>
                        <p className="order-name">{product.name}</p>
                    <p className="order-option">
                      {option.display || [option.color, option.size].filter(Boolean).join(" · ")}
                    </p>
                    <p className="order-breakdown">{t("checkout.unit_price")}: {convert(unitPrice, currency)} {currency} × {quantity}</p>
                    {shippingFee > 0 && <p className="order-breakdown">{t("checkout.shipping")}: {convert(shippingFee, currency)} {currency} × {quantity}</p>}
                    <p className="order-price"><strong>{t("checkout.total")}: {convert(totalPrice, currency)} {currency}</strong></p>
                    </div>
                    <div className="checkout-quantity-control premium-qty">
                      <button type="button" aria-label={t("checkout.reduce_quantity", { name: product.name })} onClick={() => updateQuantity(cartItemId, Math.max(item.quantity - 1, 1))}>
                        <FontAwesomeIcon icon={faMinus} />
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" aria-label={t("checkout.increase_quantity", { name: product.name })} onClick={() => updateQuantity(cartItemId, item.quantity + 1)}>
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                    </div>
                  </div>
                  <button type="button" aria-label={t("checkout.remove_item", { name: product.name })} className="checkout-remove-btn" onClick={() => removeItem(cartItemId)}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </li>
              );
            })}
          </ul>
          {!referralCreditLoading && referralCreditBalance > 0 && <div className="checkout-referral-credit">
            <label><input type="checkbox" checked={useReferralCredit} onChange={(event) => setUseReferralCredit(event.target.checked)} />{t("checkout.use_referral_credit")}</label>
            <span>{convert(Math.min(total, referralCreditBalance), currency)} {currency}</span>
          </div>}
          <div className="order-total premium-total"><strong>{t("checkout.total")}</strong><span>{convert(total, currency)} {currency}</span></div>
          {useReferralCredit && referralCreditBalance > 0 && <div className="order-total checkout-amount-due"><strong>{t("checkout.amount_due")}</strong><span>{convert(Math.max(0, total - referralCreditBalance), currency)} {currency}</span></div>}
        </div>
      </section>}
      </main>

      {showModal && paymentData && (
        <PaymentModal
          paymentData={paymentData}
          onClose={(status) => {
            if (["failed", "expired"].includes(status)) idempotencyKeyRef.current = null;
            setShowModal(false);
          }}
          onSuccess={clearCart}
        />
      )}
    </>
  );
}



