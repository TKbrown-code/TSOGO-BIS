import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faShoppingCart, faTruck, faSmile } from "@fortawesome/free-solid-svg-icons";
import "../../styles/howItWorks.css";

export default function HowItWorks() {
  const steps = [
    {
      icon: faSearch,
      title: "Browse Products",
      description: "Explore our wide range of quality products across multiple categories",
      step: "01"
    },
    {
      icon: faShoppingCart,
      title: "Add to Cart",
      description: "Select your favorite items and add them to your shopping cart",
      step: "02"
    },
    {
      icon: faTruck,
      title: "Fast Delivery",
      description: "We process and deliver your order quickly to your doorstep",
      step: "03"
    },
    {
      icon: faSmile,
      title: "Enjoy Shopping",
      description: "Receive your products and enjoy a seamless shopping experience",
      step: "04"
    }
  ];

  return (
    <section className="how-it-works-section">
      <div className="how-it-works-container">
        <div className="hiw-header">
          <h2 className="hiw-title">How It Works</h2>
          <p className="hiw-subtitle">Shopping made simple in 4 easy steps</p>
        </div>

        <div className="steps-container">
          {steps.map((step, index) => (
            <div key={index} className="step-card">
              <div className="step-number">{step.step}</div>
              <div className="step-icon-wrapper">
                <FontAwesomeIcon icon={step.icon} className="step-icon-h" />
              </div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
              {index < steps.length - 1 && <div className="step-connector"></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
