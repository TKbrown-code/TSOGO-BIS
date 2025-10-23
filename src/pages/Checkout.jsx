import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import "../styles/checkout.css";
import { useCurrencyContext } from "../context/CurrencyContext";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../context/useUserContext";
import PaymentModal from "../components/PaymentModal";
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
import { supabase } from "../lib/supabase";

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
  const { profile } = useUserContext();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [paymentData, setPaymentData] = useState(null);


  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;
  const X_WEBHOOK_SECRET = import.meta.env.VITE_X_WEBHOOK_SECRET;
  

  // Initialize selected items
  useEffect(() => {
    setSelectedItems(cartItems.map((item) => item.product_id.id));
  }, [cartItems]);

  // Calculate total
  useEffect(() => {
    const totalPrice = cartItems
      .filter((item) => selectedItems.includes(item.product_id?.id))
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

  // --- Function 1: Initialize CamPay Payment ---
  const initializePayment = async () => {
    if (!name || !phone || !address) return alert("Please fill all required fields.");
    if (selectedItems.length === 0) return alert("Please select at least one item.");
    setLoading(true);

    try {
      const itemsToCheckout = cartItems
        .filter((item) => selectedItems.includes(item.product_id.id))
        .map((item) => {
          const product = item.product_id;
          const option = item.selected_option || {};
          
          // Use stored price from selected_option (this is the FINAL price for the option)
          const unitPrice = option?.price 
            ? Number(option.price) 
            : Number(product?.price || 0);
          
          const shippingFee = Number(option?.shipping_fee || 0);
          const quantity = Number(item.quantity) || 1;
          
          return {
            product_id: product.id,
            quantity: quantity,
            price: (unitPrice * quantity) + (shippingFee * quantity),
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
  phone,
  address,
  email: profile?.email ?? "guest@example.com",
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
      
      // Open payment URL in new window
      console.log("Payment URL:", paymentData?.url);
      if (paymentData?.url) {
        window.open(paymentData.url, "_blank", "width=600,height=700");
      }
      
      setShowModal(true);

    } catch (err) {
      console.error("Payment init error:", err);
      alert(err.message || "Failed to initialize payment");
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  const channel = supabase
    .channel("checkouts")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "checkouts" },
      (payload) => {
        const updatedCheckout = payload.new;
        if (updatedCheckout.status === "paid") {
          alert("✅ Payment confirmed!");
          clearCart();
          navigate("/orders");
        } else if (updatedCheckout.status === "failed") {
          alert("❌ Payment failed. Please try again.");
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

/*
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
*/
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
        <div className="checkout-left checkout-card premium-card">
          <h2 className="section-title">{t('checkout.customer_info')}</h2>
          <div className="input-group">
            <FontAwesomeIcon icon={faUser} className="input-icon" />
            <input type="text" placeholder={t('checkout.name')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="input-group">
            <FontAwesomeIcon icon={faPhone} className="input-icon" />
            <input type="tel" placeholder={t('checkout.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="input-group">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" />
            <input type="text" placeholder={t('checkout.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="payment-method-badge">
            <FontAwesomeIcon icon={faWallet} style={{color:""}} />
            <span>Mobile Money Payment</span>
          </div>

          <button className="btn-primary btn-large" onClick={initializePayment} disabled={loading}>
            <FontAwesomeIcon icon={faShoppingCart} style={{ marginRight: '8px' }} />
            {loading ? t('checkout.processing') : t('checkout.place_order')} {convert(total, currency)} {currency}
          </button>

          <div className="info-note">
            <FontAwesomeIcon icon={faInfoCircle} className="info-icon" />
            <span>Phone number must include country code (+237)</span>
          </div>
        </div>

        <div className="checkout-right checkout-card premium-card">
          <h2 className="section-title">{t('checkout.order_summary')}</h2>
          <ul className="order-summary-list">
            {cartItems.map((item) => {
              const id = item.product_id?.id;
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
                <li key={id} className="checkout-order-item premium-item">
                  <input type="checkbox" checked={selectedItems.includes(id)} onChange={() => toggleItem(id)} />
                  <img src={imageUrls[id] || "/placeholder.png"} alt={item.product_id.name} className="order-img premium-img" />
                  <div className="checkout-order-details">
                    <div>
                        <p className="order-name">{product.name}</p>
                    <p className="order-option">
                      {option.color && <>Color: {option.color} </>}
                      {option.size && <>Size: {option.size}</>}
                    </p>
                    <p className="order-breakdown">Unit Price: {convert(unitPrice, currency)} {currency} × {quantity}</p>
                    {shippingFee > 0 && <p className="order-breakdown">Shipping: {convert(shippingFee, currency)} {currency} × {quantity}</p>}
                    <p className="order-price"><strong>Total: {convert(totalPrice, currency)} {currency}</strong></p>
                    </div>
                    <div className="checkout-quantity-control premium-qty">
                      <button onClick={() => updateQuantity(id, Math.max(item.quantity - 1, 1))}>
                        <FontAwesomeIcon icon={faMinus} />
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(id, item.quantity + 1)}>
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                    </div>
                  </div>
                  <button className="checkout-remove-btn" onClick={() => removeItem(id)}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="order-total premium-total"><strong>Total:</strong> {convert(total, currency)} {currency}</div>
        </div>
      </section>

      {showModal && paymentData && (
        <PaymentModal
          paymentData={paymentData}
          onClose={() => setShowModal(false)}
          onSuccess={async (result) => {
            // Clear cart and redirect
            await clearCart();
            // Navigate is handled by PaymentModal
          }}
        />
      )}
    </>
  );
}



