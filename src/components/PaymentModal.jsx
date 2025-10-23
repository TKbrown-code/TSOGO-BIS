import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/PaymentModal.css";

export default function PaymentModal({ paymentData, onClose }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending"); // pending, paid, failed
  const [message, setMessage] = useState("Waiting for payment...");

  // Auto-open Fapshi checkout page when modal mounts
  useEffect(() => {
    if (paymentData?.url) {
      const newWindow = window.open(paymentData.url, "_blank");
      if (!newWindow) {
        setMessage("Popup blocked. Please click the button below to open the payment page.");
      }
    }
  }, [paymentData]);

  // Listen for status updates via webhook / Supabase real-time
  useEffect(() => {
    if (!paymentData?.checkout_id) return;

    const supabase = window.supabase; // assuming you initialized supabase globally
    const channel = supabase
      .channel("checkouts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkouts" },
        (payload) => {
          if (payload.new.checkout_id === paymentData.checkout_id) {
            if (payload.new.status === "paid") {
              setStatus("paid");
              setMessage("Payment successful! Redirecting...");
              setTimeout(() => navigate("/orders"), 2000);
            } else if (payload.new.status === "failed") {
              setStatus("failed");
              setMessage("Payment failed. Please try again.");
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [paymentData, navigate]);

  const handleClose = () => {
    onClose();
  };

  const handleOpenPaymentPage = () => {
    if (paymentData?.url) window.open(paymentData.url, "_blank");
  };

  const getStatusIcon = () => {
    switch (status) {
      case "pending":
        return <div className="spinner"></div>;
      case "paid":
        return <div className="payment-icon success">✓</div>;
      case "failed":
        return <div className="payment-icon failed">✕</div>;
      default:
        return null;
    }
  };

  return (
    <div className="payment-modal-overlay" onClick={handleClose}>
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-content">
          <div className="payment-status-icon">{getStatusIcon()}</div>
          <h2 className="payment-title">
            {status === "pending" && "Processing Payment"}
            {status === "paid" && "Payment Successful!"}
            {status === "failed" && "Payment Failed"}
          </h2>
          <p className="payment-message">{message}</p>

          {status === "pending" && paymentData?.url && (
            <div className="payment-link">
              <p>Payment window didn’t open?</p>
              <button className="btn-primary" onClick={handleOpenPaymentPage}>
                Open Payment Page
              </button>
            </div>
          )}

          <div className="payment-actions">
            {(status === "paid" || status === "failed") && (
              <button onClick={handleClose} className="btn-secondary">
                Close
              </button>
            )}
          </div>

          {paymentData?.reference && (
            <div className="payment-reference">
              <small>Reference: {paymentData.reference}</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
