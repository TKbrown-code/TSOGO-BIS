import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import "../styles/checkout.css";
import { useCurrencyContext } from "../context/CurrencyContext";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/useUserContext";
import Modal from "../components/paymodal";

export default function Checkout() {
  const { cartItems, updateQuantity, removeItem, clearCart } = useCart();
  const [selectedItems, setSelectedItems] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [imageUrls, setImageUrls] = useState({});
  const { convert, currency } = useCurrencyContext();
  const { profile } = useUserContext();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [status, setStatus] = useState(null);
  const [shippingMethod, setShippingMethod] = useState("By Air Normal"); // default

  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;
  const X_WEBHOOK_SECRET = import.meta.env.VITE_X_WEBHOOK_SECRET;
  

  // Initialize selected items
  useEffect(() => {
    setSelectedItems(cartItems.map((item) => item.product_id.id));
  }, [cartItems]);

  // Calculate total
  useEffect(() => {
    const totalPrice = cartItems
      .filter((item) => selectedItems.includes(item.product_id.id))
      .reduce((sum, item) => {
        const option = item.selected_option;
        const basePrice = option?.price ?? item.product_id.price ?? 0;
        const optionShipping = option?.shipping_fee ?? 0;
        const weightShipping = (item.product_id.shipping_fee_per_kg || 0) * (item.product_id.weight || 0);
        return sum + basePrice * item.quantity + optionShipping * item.quantity + weightShipping * item.quantity;
      }, 0);
    setTotal(totalPrice);
  }, [cartItems, selectedItems]);

  const toggleItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // --- Function 1: Initialize CamPay Payment ---
  const initializePayment = async () => {
    if (!name || !phone || !address) return alert("Please fill all required fields.");
    if (selectedItems.length === 0) return alert("Please select at least one item.");
    setLoading(true);

    try {
      const itemsToCheckout = cartItems
        .filter((item) => selectedItems.includes(item.product_id.id))
        .map((item) => {
          const option = item.selected_option;
          const basePrice = option?.price ?? item.product_id.price ?? 0;
          const optionShipping = option?.shipping_fee ?? 0;
          const weightShipping = (item.product_id.shipping_fee_per_kg || 0) * (item.product_id.weight || 0);
          return {
            product_id: item.product_id.id,
            quantity: item.quantity,
            price: basePrice * item.quantity + optionShipping * item.quantity + weightShipping * item.quantity,
          };
        });

      const totalAmount = itemsToCheckout.reduce((sum, item) => sum + item.price, 0);

      const res = await fetch(
        "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/create-campay-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            name,
            phone: phone.toString(),
            address,
            total: totalAmount,
            items: itemsToCheckout,
            userId: profile?.user_id ?? "guest",
            status: "pending",
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success || !data.reference) throw new Error(data?.error || "Payment initialization failed");

     setPaymentData({
      url: data.paymentUrl,
      checkoutId: data.checkout_id,
      reference: data.reference  // store the reference returned by Edge Function
      });
      setShowModal(true);

    } catch (err) {
      console.error("Payment init error:", err);
      alert(err.message || "Failed to initialize payment");
    } finally {
      setLoading(false);
    }
  };


  // --- Function 2: Verify Payment after completion ---
  const verifyPayment = async () => {
    if (!paymentData?.checkoutId) return;

    setLoading(true);
    try {
      const res = await fetch(
        "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/verify-campay-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "x-webhook-secret": X_WEBHOOK_SECRET,
          },
          body: JSON.stringify({
              reference: paymentData.reference,
              checkout_id: paymentData.checkoutId
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || "Payment verification failed");
      if(!data.status) return <><div className="spinner"></div></>;
      alert(`Payment ${data.status.toUpperCase()}`);
      clearCart();
      navigate("/orders");
    } catch (err) {
      console.error("Payment verification error:", err);
      alert(err.message || "Failed to verify payment");
    } finally {
      setLoading(false);
      setShowModal(false);
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
        urls[item.product_id.id] = primaryImage ? getCachedImage(primaryImage.image_path) : "/placeholder.png";
      });
      setImageUrls(urls);
    };
    fetchImages();
  }, [cartItems]);

  return (
    <>
      <section className="checkout-container">
        <div className="checkout-left card premium-card">
          <h2 className="section-title">Shipping Information</h2>
          <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input type="text" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />

              <h2 className="section-title">Shipping Method</h2>
      <select value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)}>
          <option value="By See">By See</option>
          <option value="By Air Normal">By Air Normal</option>
          <option value="By Express Air">By Express Air</option>
      </select>

          <h2 className="section-title">Payment Method</h2>
          <p>💰 Mobile Money (CamPay)</p>

          <button className="btn-primary btn-large" onClick={initializePayment} disabled={loading}>
            {loading ? "Processing..." : `Pay ${convert(total, currency)} ${currency}`}
          </button>
        </div>

        <div className="checkout-right card premium-card">
          <h2 className="section-title">Order Summary</h2>
          <ul className="order-summary-list">
            {cartItems.map((item) => {
              const id = item.product_id.id;
              const option = item.selected_option;
              const basePrice = option?.price ?? item.product_id.price ?? 0;
              const optionShipping = option?.shipping_fee ?? 0;
              const weightShipping = (item.product_id.shipping_fee_per_kg || 0) * (item.product_id.weight || 0);
              const totalPrice = basePrice * item.quantity + optionShipping * item.quantity + weightShipping * item.quantity;

              return (
                <li key={id} className="order-item premium-item">
                  <input type="checkbox" checked={selectedItems.includes(id)} onChange={() => toggleItem(id)} />
                  <img src={imageUrls[id] || "/placeholder.png"} alt={item.product_id.name} className="order-img premium-img" />
                  <div className="order-details">
                    <p className="order-name">{item.product_id.name}</p>
                    {option && <p className="order-option">Option: {option.name}</p>}
                    <p className="order-breakdown">Base: {convert(basePrice, currency)} {currency} × {item.quantity}</p>
                    {optionShipping > 0 && <p className="order-breakdown">Option Shipping: {convert(optionShipping, currency)} {currency} × {item.quantity}</p>}
                    {weightShipping > 0 && <p className="order-breakdown">Weight Shipping: {convert(weightShipping, currency)} {currency} × {item.quantity}</p>}
                    <p className="order-price"><strong>Total: {convert(totalPrice, currency)} {currency}</strong></p>
                    <div className="quantity-control premium-qty">
                      <button onClick={() => updateQuantity(id, Math.max(item.quantity - 1, 1))}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(id, item.quantity + 1)}>+</button>
                    </div>
                  </div>
                  <button className="remove-btn" onClick={() => removeItem(id)}>✕</button>
                </li>
              );
            })}
          </ul>
          <div className="order-total premium-total"><strong>Total:</strong> {convert(total, currency)} {currency}</div>
        </div>
      </section>

      {showModal && (
        <Modal
          title="Confirm Payment"
          message="You're about to pay via CamPay. Once confirmed, your cart will be cleared and you'll be redirected."
          onConfirm={verifyPayment}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
