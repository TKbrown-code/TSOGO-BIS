import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { MapPin, Package, Truck, TruckIcon, CheckCircle, XCircle, Upload, Calendar, Search, UserRound, CreditCard, BadgeCheck } from "lucide-react";
import "../styles/TrackOrder.css";

export default function TrackOrder() {
  const { t, i18n } = useTranslation();
  const { trackingId } = useParams(); // Get tracking number from URL
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-track if tracking number in URL
  useEffect(() => {
    if (trackingId) {
      setTrackingNumber(trackingId);
      handleTrackWithNumber(trackingId);
    }
  }, [trackingId]);

  // Subscribe to the public, status-only delivery broadcast. The page then
  // reloads full tracking details through the existing tracking RPC.
  useEffect(() => {
    const number = trackingData?.tracking_number;
    if (!number) return undefined;
    const refreshStatus = async () => {
      const { data, error: refreshError } = await supabase.rpc("track_shipment", {
        p_tracking_number: number,
      });
      if (!refreshError && data?.length) setTrackingData(data[0]);
    };
    const channel = supabase
      .channel(`delivery:${number}`)
      .on("broadcast", { event: "delivery_status_updated" }, refreshStatus)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refreshStatus();
      });
    // Recover from transient socket disconnects; normal updates arrive over
    // Realtime immediately.
    const intervalId = window.setInterval(refreshStatus, 60000);
    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [trackingData?.tracking_number]);

  const handleTrackWithNumber = async (number) => {
    if (!number.trim()) {
      setError(t('tracking.not_found'));
      return;
    }

    setLoading(true);
    setError("");
    setTrackingData(null);

    try {
      const { data, error: fetchError } = await supabase.rpc("track_shipment", {
        p_tracking_number: number.trim(),
      });

      if (fetchError || !data?.length) {
        setError(t('tracking.not_found'));
        setLoading(false);
        return;
      }

      setTrackingData(data[0]);
    } catch (err) {
      setError(t('common.error'));
      console.error(err);
    }

    setLoading(false);
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    handleTrackWithNumber(trackingNumber);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending": return <Package size={20} />;
      case "in_transit": return <Truck size={20} />;
      case "out_for_delivery": return <TruckIcon size={20} />;
      case "delivered": return <CheckCircle size={20} />;
      case "failed": return <XCircle size={20} />;
      default: return <Package size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "var(--brand-bronze)";
      case "processing": return "#8c7555";
      case "in_transit": return "#63766b";
      case "out_for_delivery": return "#735e44";
      case "delivered": return "var(--brand-forest)";
      case "failed": return "#966454";
      default: return "#737970";
    }
  };

  const formatStatus = (status) => {
    const normalized = (status || "pending").toLowerCase();
    return t(`tracking.statuses.${normalized}`, { defaultValue: normalized.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") });
  };
  const locale = { en: "en-US", fr: "fr-FR", zh: "zh-CN" }[i18n.resolvedLanguage?.slice(0, 2)] || "en-US";

  const formatXaf = (amount) => new Intl.NumberFormat("fr-CM", {
    style: "currency", currency: "XAF", maximumFractionDigits: 0,
  }).format(Number(amount || 0));
  const isPaid = ["paid", "succeeded", "successful"].includes(String(trackingData?.payment_status).toLowerCase());
  const shippingAmount = Number(trackingData?.shipping_amount || 0);
  const shippingState = shippingAmount <= 0 ? t('tracking.no_shipping_fee')
    : trackingData?.shipping_paid ? t('tracking.shipping_paid') : t('tracking.shipping_unpaid');
  const deliverySteps = ["pending", "processing", "in_transit", "out_for_delivery", "delivered"];
  const rawDeliveryStatus = String(trackingData?.status || "pending").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const deliveryStatusAliases = { shipped: "in_transit", on_the_way: "in_transit", outfordelivery: "out_for_delivery" };
  const currentDeliveryStatus = deliveryStatusAliases[rawDeliveryStatus] || rawDeliveryStatus;
  const currentDeliveryStep = Math.max(0, deliverySteps.indexOf(currentDeliveryStatus));
  const timelineProgress = `${(currentDeliveryStep / (deliverySteps.length - 1)) * 100}%`;

  return (
    <div className="track-order-page">
      <div className="track-container">
        <div className="track-header">
          <span className="track-kicker">{t("tracking.eyebrow")}</span>
          <h1><MapPin className="inline-block mr-2" size={28} /> {t('tracking.title')}</h1>
          <p>{t('tracking.subtitle')}</p>
        </div>

        <form onSubmit={handleTrack} className="track-form">
          <div className="input-group">
            <input
              type="text"
              aria-label={t('tracking.tracking_number')}
              placeholder={t('tracking.tracking_number')}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="track-input"
            />
            <button type="submit" className="track-button" disabled={loading}>
              {loading ? t('common.loading') : <><Search size={17} /> {t('tracking.track_button')}</>}
            </button>
          </div>
        </form>

        {error && (
          <div className="track-error" role="alert">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {trackingData && (
          <div className="tracking-result">
            <div className="tracking-result-main">
              <div className="result-header">
                <div className="tracking-status-group">
                  <div className="status-badge" style={{ backgroundColor: getStatusColor(trackingData.status) }}>
                    <span className="status-icon">{getStatusIcon(trackingData.status)}</span>
                    <span className="status-text">{formatStatus(trackingData.status)}</span>
                  </div>
                  <div className="tracking-number-display">
                    <span>{t('tracking.tracking_number')}</span>
                    <strong>{trackingData.tracking_number}</strong>
                  </div>
                </div>
                <div className="tracking-customer">
                  <span className="tracking-customer-icon"><UserRound size={18} /></span>
                  <span><small>{t('tracking.customer')}</small><strong>{trackingData.customer_name || t('tracking.customer')}</strong></span>
                </div>
              </div>

              <section className="tracking-payment" aria-label={t("tracking.payment_details_aria")}>
                <div className="tracking-section-heading">
                  <span className="section-icon"><CreditCard size={17} /></span>
                  <div><span>{t('tracking.payment')}</span><small>{t('tracking.payment_summary')}</small></div>
                  <span className={`payment-state ${isPaid ? "is-paid" : "is-pending"}`}>
                    {isPaid ? <BadgeCheck size={15} /> : <span className="payment-state-dot" />}
                    {isPaid ? t('tracking.paid') : t('tracking.unpaid')}
                  </span>
                </div>
                <div className="payment-amounts">
                  <div><small>{t('tracking.amount_paid')}</small><strong>{formatXaf(trackingData.amount_paid)}</strong></div>
                  <div><small>{t('tracking.order_total')}</small><strong>{formatXaf(trackingData.total_amount)}</strong></div>
                  <div><small>{t('tracking.payment_method')}</small><strong>{trackingData.payment_method || "—"}</strong></div>
                  <div><small>{t('tracking.shipping_fee')}</small><strong>{formatXaf(shippingAmount)} · {shippingState}</strong></div>
                </div>
              </section>

              <div className="tracking-details">
                <div className="detail-card">
                  <div className="detail-icon"><Upload size={21} /></div>
                  <div className="detail-content">
                    <div className="detail-label">{t('tracking.from')}</div>
                    <div className="detail-value">{trackingData.shipping_from}</div>
                  </div>
                </div>
                <div className="detail-card highlight">
                  <div className="detail-icon"><MapPin size={21} /></div>
                  <div className="detail-content">
                    <div className="detail-label">{t('tracking.location')}</div>
                    <div className="detail-value">{trackingData.present_location}</div>
                  </div>
                </div>

                {trackingData.estimated_delivery && (
                  <div className="detail-card">
                    <div className="detail-icon"><Calendar size={21} /></div>
                    <div className="detail-content">
                      <div className="detail-label">{t('tracking.estimated_delivery')}</div>
                  <div className="detail-value">{new Date(trackingData.estimated_delivery).toLocaleDateString(locale)}</div>
                    </div>
                  </div>
                )}
              </div>

              <section className="tracking-products">
                <div className="tracking-section-heading">
                  <span className="section-icon"><Package size={17} /></span>
                  <div><span>{t('tracking.products')}</span><small>{trackingData.items?.length || 0} {(trackingData.items?.length || 0) === 1 ? t('tracking.item') : t('tracking.items')}</small></div>
                </div>
                <div className="tracking-product-list">
                  {(trackingData.items || []).map((item, index) => (
                    <article className="tracking-product" key={`${item.name}-${index}`}>
                      <div className="tracking-product-image">
                        {item.image_url ? <img src={item.image_url} alt={item.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <Package size={20} aria-hidden="true" />}
                      </div>
                      <div className="tracking-product-info">
                        <strong>{item.name}</strong>
                        <span>{t('tracking.quantity')} {item.quantity}{item.options?.size ? ` · ${item.options.size}` : ""}{item.options?.color ? ` · ${item.options.color}` : ""}</span>
                      </div>
                      <strong className="tracking-product-price">{formatXaf(item.line_total)}</strong>
                    </article>
                  ))}
                  {!trackingData.items?.length && <p className="tracking-no-products">{t("tracking.products_unavailable")}</p>}
                </div>
              </section>
            </div>

            <div className="tracking-timeline">
              <h3>{t('tracking.status')}</h3>
              <div className="timeline" style={{ "--timeline-progress": timelineProgress }}>
                {deliverySteps.map((step, index) => {
                  const stepState = index < currentDeliveryStep ? "completed" : index === currentDeliveryStep ? "active" : "";
                  return <div className={`timeline-item ${stepState}`} key={step}>
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-title">{t(`tracking.statuses.${step}`, { defaultValue: formatStatus(step) })}</div>
                      {index === 0 && trackingData.created_at && <div className="timeline-time">{new Date(trackingData.created_at).toLocaleString(locale)}</div>}
                      {index > 0 && <div className="timeline-desc">{t(`tracking.statuses.${step}`, { defaultValue: formatStatus(step) })}</div>}
                    </div>
                  </div>;
                })}
              </div>
            </div>

            <div className="track-another">
              <button 
                onClick={() => {
                  setTrackingNumber("");
                  setTrackingData(null);
                  setError("");
                }}
                className="track-another-btn"
              >
                {t('tracking.track_another')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
