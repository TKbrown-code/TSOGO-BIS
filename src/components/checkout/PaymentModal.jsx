import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import "../../styles/PaymentModal.css";
import { useTranslation } from "react-i18next";

const terminalStates = new Set(["paid", "failed", "expired"]);

export default function PaymentModal({ paymentData, onClose, onSuccess }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState(paymentData);
  const [message, setMessage] = useState(() => t("payment_modal.waiting"));
  const completedRef = useRef(false);
  const redirectStartedRef = useRef(false);

  useEffect(() => setCheckout((current) => ({ ...current, ...paymentData })), [paymentData]);

  useEffect(() => {
    if (!checkout?.url || redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    setMessage(t("payment_modal.opening"));
    // Navigate the current tab. Opening a popup after the async checkout request
    // is commonly blocked by browsers, especially Firefox.
    window.location.assign(checkout.url);
  }, [checkout?.url]);

  useEffect(() => {
    if (!checkout?.checkout_id || terminalStates.has(checkout.status)) return;
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase.functions.invoke("get-fapshi-checkout-status", {
        body: { checkoutId: checkout.checkout_id },
      });
      if (!active || error || !data?.success) return;
      const next = data.status || "pending";
      setCheckout((current) => ({ ...current, status: next, url: current.url || data.paymentUrl, reference: current.reference || data.reference }));
      if (next === "paid" && !completedRef.current) {
        completedRef.current = true;
        setMessage(t("payment_modal.confirmed"));
        await onSuccess?.();
        navigate("/orders", { replace: true });
      } else if (next === "failed") {
        setMessage(t("payment_modal.failed"));
      } else if (next === "expired") {
        setMessage(t("payment_modal.expired"));
      } else if (next === "processing") {
        setMessage(t("payment_modal.processing"));
      } else if (next === "initiating") {
        setMessage(t("payment_modal.initiating"));
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [checkout?.checkout_id, checkout?.status, navigate, onSuccess, t]);

  const status = checkout?.status || "pending";
  const handleClose = () => onClose?.(status);
  const icon = status === "paid" ? "✓" : terminalStates.has(status) ? "×" : <div className="spinner" />;

  return (
    <div className="payment-modal-overlay" role="presentation" onClick={handleClose}>
      <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={(event) => event.stopPropagation()}>
        <div className="payment-modal-content">
          <div className="payment-status-icon">
            <div className={`payment-icon ${status === "paid" ? "success" : terminalStates.has(status) ? "failed" : "pending"}`}>{icon}</div>
          </div>
          <h2 id="payment-title" className="payment-title">
            {status === "paid" ? t("payment_modal.completed_title") : status === "failed" ? t("payment_modal.failed_title") : status === "expired" ? t("payment_modal.expired_title") : status === "processing" ? t("payment_modal.processing_title") : checkout?.url ? t("payment_modal.redirect_title") : t("payment_modal.preparing_title")}
          </h2>
          <p className="payment-message">{message}</p>
          {checkout?.url && !terminalStates.has(status) && status !== "paid" && (
            <div className="payment-link"><p>{t("payment_modal.continue_link")} <a href={checkout.url}>{t("payment_modal.continue_payment")}</a>.</p></div>
          )}
          <div className="payment-actions">
            {terminalStates.has(status) && <button type="button" onClick={handleClose} className="btn-secondary">{t("payment_modal.close")}</button>}
            {!terminalStates.has(status) && !checkout?.url && <button type="button" onClick={handleClose} className="btn-secondary">{t("payment_modal.continue_later")}</button>}
          </div>
          {checkout?.checkout_id && <p className="payment-reference"><small>{t("payment_modal.order_reference", { id: checkout.checkout_id })}</small></p>}
        </div>
      </section>
    </div>
  );
}
