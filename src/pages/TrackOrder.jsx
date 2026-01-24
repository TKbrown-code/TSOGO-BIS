import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useCurrencyContext } from "../context/CurrencyContext";
import { MapPin, Package, Truck, TruckIcon, CheckCircle, XCircle, User, DollarSign, Upload, Calendar, FileText } from "lucide-react";
import "../styles/TrackOrder.css";

export default function TrackOrder() {
  const { t } = useTranslation();
  const { trackingId } = useParams(); // Get tracking number from URL
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { convert, currency } = useCurrencyContext();

  // Auto-track if tracking number in URL
  useEffect(() => {
    if (trackingId) {
      setTrackingNumber(trackingId);
      handleTrackWithNumber(trackingId);
    }
  }, [trackingId]);

  const handleTrackWithNumber = async (number) => {
    if (!number.trim()) {
      setError(t('tracking.not_found'));
      return;
    }

    setLoading(true);
    setError("");
    setTrackingData(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("order_tracking")
        .select("*")
        .eq("tracking_number", number.trim())
        .single();

      if (fetchError || !data) {
        setError(t('tracking.not_found'));
        setLoading(false);
        return;
      }

      setTrackingData(data);
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
      case "pending": return "#f59e0b";
      case "in_transit": return "#3b82f6";
      case "out_for_delivery": return "#8b5cf6";
      case "delivered": return "#10b981";
      case "failed": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const formatStatus = (status) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  return (
    <div className="track-order-page">
      <div className="track-container">
        <div className="track-header">
          <h1><MapPin className="inline-block mr-2" size={28} /> {t('tracking.title')}</h1>
          <p>{t('tracking.subtitle')}</p>
        </div>

        <form onSubmit={handleTrack} className="track-form">
          <div className="input-group">
            <input
              type="text"
              placeholder={t('tracking.tracking_number')}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="track-input"
            />
            <button type="submit" className="track-button" disabled={loading}>
              {loading ? t('common.loading') : t('tracking.track_button')}
            </button>
          </div>
        </form>

        {error && (
          <div className="track-error">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {trackingData && (
          <div className="tracking-result">
            <div className="result-header">
              <div className="status-badge" style={{ backgroundColor: getStatusColor(trackingData.status) }}>
                <span className="status-icon">{getStatusIcon(trackingData.status)}</span>
                <span className="status-text">{formatStatus(trackingData.status)}</span>
              </div>
              <div className="tracking-number-display">
                {t('tracking.tracking_number')}: <strong>{trackingData.tracking_number}</strong>
              </div>
            </div>

            <div className="tracking-details">
              <div className="detail-card">
                <div className="detail-icon"><User size={24} /></div>
                <div className="detail-content">
                  <div className="detail-label">{t('tracking.customer')}</div>
                  <div className="detail-value">{trackingData.username}</div>
                </div>
              </div>

              <div className="detail-card">
                <div className="detail-icon"><DollarSign size={24} /></div>
                <div className="detail-content">
                  <div className="detail-label">{t('tracking.amount')}</div>
                  <div className="detail-value">
                    {convert(trackingData.total_amount, currency)} {currency}
                  </div>
                </div>
              </div>

              <div className="detail-card">
                <div className="detail-icon"><Upload size={24} /></div>
                <div className="detail-content">
                  <div className="detail-label">{t('tracking.from')}</div>
                  <div className="detail-value">{trackingData.shipping_from}</div>
                </div>
              </div>

              <div className="detail-card highlight">
                <div className="detail-icon"><MapPin size={24} /></div>
                <div className="detail-content">
                  <div className="detail-label">{t('tracking.location')}</div>
                  <div className="detail-value">{trackingData.present_location}</div>
                </div>
              </div>

              {trackingData.estimated_delivery && (
                <div className="detail-card">
                  <div className="detail-icon"><Calendar size={24} /></div>
                  <div className="detail-content">
                    <div className="detail-label">{t('tracking.estimated_delivery')}</div>
                    <div className="detail-value">
                      {new Date(trackingData.estimated_delivery).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}

              {trackingData.notes && (
                <div className="detail-card full-width">
                  <div className="detail-icon"><FileText size={24} /></div>
                  <div className="detail-content">
                    <div className="detail-label">{t('tracking.notes')}</div>
                    <div className="detail-value">{trackingData.notes}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="tracking-timeline">
              <h3>{t('tracking.status')}</h3>
              <div className="timeline">
                <div className={`timeline-item ${["pending", "in_transit", "out_for_delivery", "delivered"].includes(trackingData.status) ? "completed" : ""}`}>
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">{t('tracking.statuses.pending')}</div>
                    <div className="timeline-time">
                      {new Date(trackingData.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className={`timeline-item ${["in_transit", "out_for_delivery", "delivered"].includes(trackingData.status) ? "completed" : trackingData.status === "pending" ? "active" : ""}`}>
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">{t('tracking.statuses.in_transit')}</div>
                    <div className="timeline-desc">{t('tracking.statuses.in_transit')}</div>
                  </div>
                </div>

                <div className={`timeline-item ${["out_for_delivery", "delivered"].includes(trackingData.status) ? "completed" : trackingData.status === "in_transit" ? "active" : ""}`}>
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">{t('tracking.statuses.out_for_delivery')}</div>
                    <div className="timeline-desc">{t('tracking.statuses.out_for_delivery')}</div>
                  </div>
                </div>

                <div className={`timeline-item ${trackingData.status === "delivered" ? "completed" : trackingData.status === "out_for_delivery" ? "active" : ""}`}>
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">{t('tracking.statuses.delivered')}</div>
                    <div className="timeline-desc">{t('tracking.statuses.delivered')}</div>
                  </div>
                </div>
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
