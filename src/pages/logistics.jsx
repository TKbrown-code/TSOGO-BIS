// src/pages/Logistics.jsx
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faBoxOpen,
  faShippingFast,
  faGlobe,
  faMapMarkedAlt,
  faShieldAlt,
} from "@fortawesome/free-solid-svg-icons";
import "../styles/logistics.css";

export default function Logistics() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingResult, setTrackingResult] = useState(null);

  const handleTrack = () => {
    if (!trackingNumber) {
      setTrackingResult("⚠️ Please enter a valid tracking number.");
    } else {
      // Mocked tracking result (replace with real API later)
      setTrackingResult(
        `📦 Order ${trackingNumber} is currently in transit. Estimated delivery: 3 days.`
      );
    }
  };

  return (
    <div className="logistics-page">
      {/* Hero Section */}
      <header className="logistics-hero">
        <h1>
          <FontAwesomeIcon icon={faTruck} /> Logistics & Shipping
        </h1>
        <p>
          At <b>TSOGO-BIS</b>, we make sure your products arrive{" "}
          <span className="highlight">safely</span> and{" "}
          <span className="highlight">on time</span> — anywhere in the world.
        </p>
      </header>

      {/* Delivery Options */}
      <section className="delivery-options">
        <h2>
          <FontAwesomeIcon icon={faBoxOpen} /> Delivery Options
        </h2>
        <div className="delivery-grid">
          <div className="delivery-card">
            <FontAwesomeIcon icon={faTruck} className="delivery-icon" />
            <h3>Standard Shipping</h3>
            <p>3–7 business days, reliable and affordable.</p>
          </div>
          <div className="delivery-card">
            <FontAwesomeIcon icon={faShippingFast} className="delivery-icon" />
            <h3>Express Shipping</h3>
            <p>1–3 business days, fastest delivery available.</p>
          </div>
          <div className="delivery-card">
            <FontAwesomeIcon icon={faGlobe} className="delivery-icon" />
            <h3>International</h3>
            <p>Worldwide delivery with real-time tracking.</p>
          </div>
        </div>
      </section>

      {/* Tracking Section */}
      <section className="tracking-section">
        <h2>
          <FontAwesomeIcon icon={faMapMarkedAlt} /> Track Your Order
        </h2>
        <p>Enter your tracking number to check the delivery status:</p>
        <div className="tracking-form">
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking number"
          />
          <button onClick={handleTrack}>Track</button>
        </div>
        {trackingResult && <div className="tracking-result">{trackingResult}</div>}
      </section>

      {/* Policy Section */}
      <section className="shipping-policy">
        <h2>
          <FontAwesomeIcon icon={faShieldAlt} /> Shipping Policy
        </h2>
        <p>
          ✅ All orders are <b>processed within 24 hours</b>.  
          ✅ Shipping fees depend on your location and delivery method.  
          ✅ <span className="highlight">Free shipping</span> for orders above{" "}
          <b>$100</b>.  
          ✅ Real-time tracking is available for all deliveries.
        </p>
      </section>
    </div>
  );
}
