import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { rememberCheckoutCartItems, removePaidCheckoutCartItems } from "../utils/checkoutCartCleanup";
import { useSiteSettings } from "../context/SiteSettingsContext";

export default function Checkout() {
  const { t, i18n } = useTranslation();
  const { whatsappPhone } = useSiteSettings();
  const { cartItems, updateQuantity, removeItem, removeItems } = useCart();
  const [selectedItems, setSelectedItems] = useState([]);
  const previousCartItemIdsRef = useRef([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country] = useState("Cameroon");
  const [shippingPaymentMode, setShippingPaymentMode] = useState("arrival");
  const [loading, setLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState({});
  const { convert, currency } = useCurrencyContext();
  const { profile, user } = useUserContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleCheckFailed, setRoleCheckFailed] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const { showAlert } = useModalMessage();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [referralCreditBalance, setReferralCreditBalance] = useState(0);
  const [referralCreditLoading, setReferralCreditLoading] = useState(true);
  const [useReferralCredit, setUseReferralCredit] = useState(true);
  const [serviceFeeAgreed, setServiceFeeAgreed] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkCheckoutRole() {
      if (!user?.id) {
        if (active) { setIsAdmin(false); setRoleCheckFailed(false); setRoleLoading(false); }
        return;
      }
      setRoleLoading(true);
      const { data, error } = await supabase.rpc("is_admin_role");
      if (!active) return;
      if (error) {
        console.error("Could not verify checkout role:", error);
        setRoleCheckFailed(true);
      } else {
        setRoleCheckFailed(false);
        setIsAdmin(data === true);
      }
      setRoleLoading(false);
    }
    checkCheckoutRole();
    return () => { active = false; };
  }, [user?.id]);


  const idempotencyKeyRef = useRef(null);
  const removePurchasedItems = useCallback(async () => {
    if (!paymentData?.checkout_id) return;
    const removed = await removePaidCheckoutCartItems(paymentData.checkout_id, removeItems);
    if (!removed && paymentData.cartItemIds?.length) await removeItems(paymentData.cartItemIds);
  }, [paymentData, removeItems]);

  // Initialize selected items
  useEffect(() => {
    const currentIds = cartItems.map((item) => item.id);
    const previousIds = previousCartItemIdsRef.current;
    setSelectedItems((selected) => [
      ...selected.filter((id) => currentIds.includes(id)),
      ...currentIds.filter((id) => !previousIds.includes(id)),
    ]);
    previousCartItemIdsRef.current = currentIds;
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

  // Derive totals directly from the checked cart rows so changes are reflected
  // in the summary and payment buttons in the same render.
  const { merchandise: merchandiseTotal, shipping: shippingTotal } = useMemo(() => cartItems
      .filter((item) => selectedItems.includes(item.id))
      .reduce((summary, item) => {
        const product = item.product_id;
        const option = item.selected_option || {};
        
        // Use stored price from selected_option (this is the FINAL price for the option)
        const unitPrice = option?.price 
          ? Number(option.price) 
          : Number(product?.price || 0);
        
        // Get shipping fee per unit
        const shippingFee = Number(option?.shipping_fee || item.shipping_fee || 0);
        const quantity = Number(item.quantity) || 1;
        summary.merchandise += unitPrice * quantity;
        summary.shipping += shippingFee * quantity;
        return summary;
      }, { merchandise: 0, shipping: 0 }), [cartItems, selectedItems]);
  const total = merchandiseTotal + (shippingPaymentMode === "online" ? shippingTotal : 0);

  const toggleItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // The server re-reads prices and stock; inventory changes only after payment completes.
  const serviceFee = merchandiseTotal > 100000 ? Math.round(merchandiseTotal * 0.03) : 0;
  const referralCreditApplied = useReferralCredit ? Math.min(total, referralCreditBalance) : 0;
  const onlineAmountDue = Math.max(0, total - referralCreditApplied) + serviceFee;
  const whatsappAmountDue = Math.max(0, total - referralCreditApplied);
  const deliveryDueOnArrival = shippingPaymentMode === "arrival" ? shippingTotal : 0;
  useEffect(() => { setServiceFeeAgreed(false); }, [serviceFee, onlineAmountDue, deliveryDueOnArrival]);
  const initializePayment = async (paymentMode = "online") => {
    if (roleLoading || roleCheckFailed || isAdmin) return;
    if (!user) { showAlert(t("checkout.sign_in_message"), t("checkout.sign_in_title"), "warning"); navigate("/SignUp"); return; }
    if (paymentMode === "online" && serviceFee > 0 && !serviceFeeAgreed) {
      showAlert(t("checkout.service_fee_agreement_required"), t("checkout.service_fee_agreement_title"), "warning");
      return;
    }
    if (!name || !phone || !city) return showAlert(t("checkout.missing_fields"), t("checkout.missing_title"), "warning");
    const unavailableItems = cartItems
      .filter((item) => selectedItems.includes(item.id))
      .filter((item) => Number(item.product_id?.stock_quantity ?? 0) < Number(item.quantity || 1))
      .map((item) => t("checkout.stock_item_available", { name: item.product_id?.name || t("checkout.product"), count: Number(item.product_id?.stock_quantity ?? 0) }));
    if (unavailableItems.length) {
      showAlert(t("checkout.stock_unavailable", { items: unavailableItems.join(", ") }), t("checkout.stock_unavailable_title"), "warning");
      return;
    }
    const fullPhone = `+237${phone.replace(/\D/g, "")}`;
    if (selectedItems.length === 0) return showAlert(t("checkout.empty_message"), t("checkout.empty_title"), "warning");
    setLoading(true);
    const whatsappWindow = paymentMode === "whatsapp" ? window.open("about:blank", "_blank") : null;

    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const customerAddress = [city.trim(), country].filter(Boolean).join(", ");
      const { data, error } = await supabase.functions.invoke("create-fapshi-order", {
        body: {
          name,
          phone: fullPhone,
          address: customerAddress,
          cartItemIds: cartItems.filter((item) => selectedItems.includes(item.id)).map((item) => item.id),
          idempotencyKey: idempotencyKeyRef.current,
          emailLanguage: i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "fr",
          useReferralCredit,
          paymentMode,
          shippingPaymentMode,
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
        if (error.context?.status === 409) {
          throw new Error(t("checkout.stock_changed_message"));
        }
        throw new Error(responseError?.error || error.message || t("checkout.payment_init_failed"));
      }
      if (!data?.success || !data.checkout_id) throw new Error(data?.error || t("checkout.payment_init_failed"));

      const purchasedCartItemIds = cartItems.filter((item) => selectedItems.includes(item.id)).map((item) => item.id);

      if (paymentMode === "whatsapp") {
        await removeItems(purchasedCartItemIds);
        const whatsappNumber = (whatsappPhone).replace(/\D/g, "");
        const amountDue = Number(data.amountDue ?? whatsappAmountDue);
        const deliveryNote = shippingPaymentMode === "arrival" && Number(data.deliveryDueOnArrival) > 0 ? `\n${t("checkout.whatsapp_delivery_note", { amount: `${convert(data.deliveryDueOnArrival, "XAF")} XAF` })}` : "";
        const selectedOrderItems = cartItems.filter((item) => selectedItems.includes(item.id)).map((item) => {
          const option = item.selected_option || {};
          const unitPrice = Number(option.price) || Number(item.product_id?.price) || 0;
          const quantity = Number(item.quantity) || 1;
          const details = option.display || [option.color, option.size].filter(Boolean).join(" / ");
          const shippingMethod = option.shipping_method || item.shipping_method || t("checkout.method_not_specified");
          const fee = Number(option.shipping_fee || item.shipping_fee || 0) * quantity;
          return `• ${item.product_id?.name || t("checkout.product")}${details ? ` (${details})` : ""} × ${quantity} — ${convert(unitPrice * quantity, "XAF")} XAF; ${shippingMethod}${fee ? `, ${t("checkout.delivery_fee")}: ${convert(fee, "XAF")} XAF` : ""}`;
        }).join("\n");
        const orderMessage = `${t("checkout.whatsapp_message_intro")}\n\n${t("checkout.order_number", { id: data.checkout_id })}\n${t("checkout.name")}: ${name.trim()}\n${t("checkout.phone")}: ${fullPhone}\n${t("checkout.email")}: ${user.email || t("checkout.not_provided")}\n${t("checkout.city")}: ${city.trim()}\n${t("checkout.country")}: ${t("checkout.cameroon")}\n\n${t("checkout.items_heading")}\n${selectedOrderItems}\n\n${t("checkout.amount_due_now")}: ${convert(amountDue, "XAF")} XAF${deliveryNote}`;
        if (whatsappWindow) whatsappWindow.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(orderMessage)}`;
        showAlert(t("checkout.whatsapp_order_saved"), t("checkout.order_saved_title"), "success");
        navigate(`/orders?checkout_id=${encodeURIComponent(data.checkout_id)}`);
        return;
      }

      rememberCheckoutCartItems(data.checkout_id, purchasedCartItemIds);

      if (data.status === "paid" && !data.paymentUrl) {
        await removeItems(purchasedCartItemIds);
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
        cartItemIds: purchasedCartItemIds,
      });
      setShowModal(true);

    } catch (err) {
      whatsappWindow?.close();
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
      {roleLoading ? <section className="checkout-empty" aria-live="polite"><p>{t("checkout.checking_access")}</p></section> : roleCheckFailed ? <section className="checkout-empty" role="alert"><h1>{t("checkout.access_check_failed_title")}</h1><p>{t("checkout.access_check_failed_copy")}</p></section> : isAdmin ? <section className="checkout-empty" role="status"><h1>{t("checkout.admin_restricted_title")}</h1><p>{t("checkout.admin_restricted_copy")}</p><button type="button" className="checkout-shop-link" onClick={() => navigate("/admin")}>{t("checkout.admin_dashboard")}</button></section> : cartItems.length === 0 ? <section className="checkout-empty"><span className="checkout-empty-mark"><FontAwesomeIcon icon={faShoppingCart} /></span><p className="checkout-eyebrow">{t("cart.your_bag")}</p><h1>{t("checkout.empty_bag_title")}</h1><p>{t("checkout.empty_bag_copy")}</p><button type="button" className="checkout-shop-link" onClick={() => navigate("/shop")}>{t("cart.continue_shopping")}</button></section> : <section className="checkout-container">
        <form className="checkout-left checkout-card premium-card" onSubmit={(event) => { event.preventDefault(); if (!loading) initializePayment(); }}>
          <p className="checkout-eyebrow">{t("checkout.secure")}</p>
          <h1 className="section-title">{t('checkout.customer_info')}</h1>
          <label className="checkout-field-label" htmlFor="checkout-name">{t('checkout.name')}</label>
          <div className="input-group">
            <FontAwesomeIcon icon={faUser} className="input-icon" />
            <input id="checkout-name" name="name" type="text" autoComplete="name" placeholder={t('checkout.name')} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="checkout-location-fields">
            <div className="checkout-location-field"><label className="checkout-field-label" htmlFor="checkout-country">{t("checkout.country")}</label><div className="input-group"><FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" /><input id="checkout-country" name="country" type="text" value={t("checkout.cameroon")} readOnly /></div></div>
            <div className="checkout-location-field"><label className="checkout-field-label" htmlFor="checkout-city">{t("checkout.city")}</label><div className="input-group"><FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" /><input id="checkout-city" name="city" type="text" autoComplete="address-level2" placeholder={t("checkout.city_placeholder")} value={city} onChange={(e) => setCity(e.target.value)} required /></div></div>
          </div>
          <label className="checkout-field-label" htmlFor="checkout-phone">{t('checkout.phone')}</label>
          <div className="input-group checkout-phone-group">
            <FontAwesomeIcon icon={faPhone} className="input-icon" />
            <span className="checkout-phone-prefix" aria-hidden="true">+237</span>
            <input id="checkout-phone" name="tel-national" type="tel" autoComplete="tel-national" inputMode="numeric" maxLength={9} placeholder="6XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").replace(/^237/, "").slice(0, 9))} required />
          </div>
          <div className="payment-method-badge">
            <FontAwesomeIcon icon={faWallet} />
            <span>{t("checkout.mobile_money")}</span>
          </div>

          <fieldset className="checkout-delivery-payment"><legend>{t("checkout.delivery_fee_payment")}</legend><label><input type="radio" name="shipping-payment-mode" value="arrival" checked={shippingPaymentMode === "arrival"} onChange={() => setShippingPaymentMode("arrival")} />{t("checkout.pay_delivery_on_arrival")} <span>{convert(shippingTotal, currency)} {currency}</span></label><label><input type="radio" name="shipping-payment-mode" value="online" checked={shippingPaymentMode === "online"} onChange={() => setShippingPaymentMode("online")} />{t("checkout.include_delivery_online")}</label></fieldset>
          {serviceFee > 0 && <section className="checkout-service-fee-consent" aria-labelledby="checkout-service-fee-heading">
            <h2 id="checkout-service-fee-heading">{t("checkout.service_fee_heading")}</h2>
            <p>{t("checkout.service_fee_explanation", { amount: `${convert(serviceFee, "XAF")} FCFA`, onlineAmount: `${convert(onlineAmountDue, currency)} ${currency}`, whatsappAmount: `${convert(whatsappAmountDue, currency)} ${currency}`, deliveryNote: deliveryDueOnArrival > 0 ? t("checkout.delivery_due_note", { amount: `${convert(deliveryDueOnArrival, currency)} ${currency}` }) : t("checkout.delivery_included_note") })}</p>
            <label><input type="checkbox" checked={serviceFeeAgreed} onChange={(event) => setServiceFeeAgreed(event.target.checked)} />{t("checkout.service_fee_agreement", { amount: `${convert(serviceFee, "XAF")} FCFA`, onlineAmount: `${convert(onlineAmountDue, currency)} ${currency}`, deliveryNote: deliveryDueOnArrival > 0 ? t("checkout.delivery_due_note", { amount: `${convert(deliveryDueOnArrival, currency)} ${currency}` }) : t("checkout.delivery_included_note") })}</label>
          </section>}
          <button type="submit" className="btn-primary btn-large" disabled={loading || selectedItems.length === 0 || (serviceFee > 0 && !serviceFeeAgreed)}>
            <FontAwesomeIcon icon={faShoppingCart} style={{ marginRight: '8px' }} />
            {loading ? t('checkout.processing') : t('checkout.place_order')} {convert(onlineAmountDue, currency)} {currency}
          </button>
          <button type="button" className="checkout-whatsapp-button" disabled={loading || selectedItems.length === 0} onClick={() => initializePayment("whatsapp")}>{t("checkout.continue_whatsapp")} · {convert(whatsappAmountDue, currency)} {currency}</button>

          <div className="info-note">
            <FontAwesomeIcon icon={faInfoCircle} className="info-icon" />
            <span>{t("checkout.phone_hint")}</span>
          </div>
        </form>

        <div className="checkout-right checkout-card premium-card">
          <div className="checkout-summary-heading"><div><p className="checkout-eyebrow">{t("checkout.review_selection")}</p><h2 className="section-title">{t('checkout.order_summary')}</h2></div><span className="checkout-item-count">{t("checkout.item_count", { count: selectedItems.length })}</span></div>
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
              
              const shippingFee = Number(option?.shipping_fee || item.shipping_fee || 0);
              const quantity = Number(item.quantity) || 1;
              const totalPrice = unitPrice * quantity;

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
                    {shippingFee > 0 && <p className="order-breakdown">{t("checkout.delivery_fee")}: {convert(shippingFee * quantity, currency)} {currency} · {option.shipping_method || item.shipping_method || t("checkout.selected_method")}</p>}
                    <p className="order-price"><strong>{t("checkout.line_subtotal")}: {convert(totalPrice, currency)} {currency}</strong></p>
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
          <table className="checkout-prices-table">
            <tbody>
              <tr><th scope="row">{t("checkout.merchandise_subtotal")}</th><td>{convert(merchandiseTotal, currency)} {currency}</td></tr>
              <tr><th scope="row">{t("checkout.delivery_fee")} · {shippingPaymentMode === "arrival" ? t("checkout.pay_on_arrival_short") : t("checkout.included_online_short")}</th><td>{convert(shippingTotal, currency)} {currency}</td></tr>
              {serviceFee > 0 && <tr><th scope="row">{t("checkout.service_fee_online_label")}</th><td>{convert(serviceFee, currency)} {currency}</td></tr>}
              {useReferralCredit && referralCreditApplied > 0 && <tr><th scope="row">{t("checkout.referral_credit_applied")}</th><td>−{convert(referralCreditApplied, currency)} {currency}</td></tr>}
            </tbody>
          </table>
          <div className="checkout-payment-totals">
            <div className="order-total checkout-amount-due"><strong>{t(serviceFee > 0 ? "checkout.online_due_now_with_fee" : "checkout.online_due_now")}</strong><span>{convert(onlineAmountDue, currency)} {currency}</span></div>
            {serviceFee > 0 && <div className="order-total checkout-whatsapp-total"><strong>{t("checkout.whatsapp_due_now")}</strong><span>{convert(whatsappAmountDue, currency)} {currency}</span></div>}
          </div>
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
          onSuccess={removePurchasedItems}
        />
      )}
    </>
  );
}



