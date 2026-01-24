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
  faCheckCircle,
  faClock,
  faBox,
  faPlane
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
        <div className="hero-icon">
          <FontAwesomeIcon icon={faTruck} />
        </div>
        <h1 className="hero-title">Fast & Reliable Delivery Across Cameroon</h1>
        <p className="hero-subtitle">
          From China to your doorstep - we handle every step of the journey with care and precision
        </p>
        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-number">2-5</span>
            <span className="stat-label">Days Delivery</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">10+</span>
            <span className="stat-label">Cities Covered</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">99%</span>
            <span className="stat-label">On-Time Rate</span>
          </div>
        </div>
      </header>

      {/* How It Works */}
      <section className="how-it-works">
        <h2 className="section-title">How Our Delivery Works</h2>
        <p className="section-subtitle">From order to delivery in 4 simple steps</p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon">
              <FontAwesomeIcon icon={faBox} />
            </div>
            <h3>Order Placed</h3>
            <p>You place your order and make payment via Mobile Money or Orange Money</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon">
              <FontAwesomeIcon icon={faPlane} />
            </div>
            <h3>Shipped from China</h3>
            <p>Your order is carefully packaged and shipped directly from our Chinese partners</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon">
              <FontAwesomeIcon icon={faMapMarkedAlt} />
            </div>
            <h3>Arrives in Cameroon</h3>
            <p>Package clears customs and enters our local distribution network</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <div className="step-icon">
              <FontAwesomeIcon icon={faTruck} />
            </div>
            <h3>Delivered to You</h3>
            <p>Final delivery to your address anywhere in Cameroon</p>
          </div>
        </div>
      </section>

      {/* Delivery Options */}
      <section className="delivery-options">
        <h2 className="section-title">Delivery Coverage</h2>
        <p className="section-subtitle">We deliver to major cities across Cameroon</p>
        <div className="delivery-grid">
          <div className="delivery-card">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="delivery-icon" />
            <h3>Douala</h3>
            <p>2-3 business days</p>
            <span className="delivery-badge">Most Popular</span>
          </div>
          <div className="delivery-card">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="delivery-icon" />
            <h3>Yaoundé</h3>
            <p>2-3 business days</p>
            <span className="delivery-badge">Capital City</span>
          </div>
          <div className="delivery-card">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="delivery-icon" />
            <h3>Bamenda</h3>
            <p>3-4 business days</p>
          </div>
          <div className="delivery-card">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="delivery-icon" />
            <h3>Bafoussam</h3>
            <p>3-4 business days</p>
          </div>
          <div className="delivery-card">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="delivery-icon" />
            <h3>Garoua</h3>
            <p>4-5 business days</p>
          </div>
          <div className="delivery-card">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="delivery-icon" />
            <h3>Other Cities</h3>
            <p>4-7 business days</p>
          </div>
        </div>
      </section>

      {/* Policy Section */}
      <section className="shipping-policy">
        <h2 className="section-title">Shipping Information</h2>
        <div className="policy-grid">
          <div className="policy-card">
            <div className="policy-icon">
              <FontAwesomeIcon icon={faClock} />
            </div>
            <h3>Processing Time</h3>
            <p>All orders are processed within <strong>24-48 hours</strong> after payment confirmation</p>
          </div>
          <div className="policy-card">
            <div className="policy-icon">
              <FontAwesomeIcon icon={faShieldAlt} />
            </div>
            <h3>Secure Packaging</h3>
            <p>Every item is carefully inspected and securely packaged to prevent damage during transit</p>
          </div>
          <div className="policy-card">
            <div className="policy-icon">
              <FontAwesomeIcon icon={faMapMarkedAlt} />
            </div>
            <h3>Real-Time Tracking</h3>
            <p>Track your order from China to Cameroon with our advanced tracking system</p>
          </div>
          <div className="policy-card">
            <div className="policy-icon">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <h3>Delivery Guarantee</h3>
            <p>We guarantee safe delivery or full refund - your satisfaction is our priority</p>
          </div>
        </div>
        
        <div className="policy-note">
          <FontAwesomeIcon icon={faShieldAlt} />
          <p><strong>Note:</strong> Shipping fees are calculated based on your location and package weight. Contact us for exact rates.</p>
        </div>
      </section>
    </div>
  );
}
