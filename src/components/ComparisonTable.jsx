import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes, faBalanceScale } from "@fortawesome/free-solid-svg-icons";
import { useCurrencyContext } from "../context/CurrencyContext";
import "../styles/comparisonTable.css";

export default function ComparisonTable() {
  const { convert, currency } = useCurrencyContext();
  
  const features = [
    { name: "Free Delivery", basic: false, premium: true, vip: true },
    { name: "24/7 Support", basic: false, premium: true, vip: true },
    { name: "Priority Processing", basic: false, premium: false, vip: true },
    { name: "Exclusive Deals", basic: false, premium: true, vip: true },
    { name: "Extended Warranty", basic: false, premium: false, vip: true },
    { name: "Personal Shopper", basic: false, premium: false, vip: true }
  ];

  return (
    <section className="comparison-section">
      <div className="comparison-container">
        <div className="comparison-header">
          <div className="comparison-icon">
            <FontAwesomeIcon icon={faBalanceScale} />
          </div>
          <h2 className="comparison-title">Membership Plans</h2>
          <p className="comparison-subtitle">Choose the perfect plan for your shopping needs</p>
        </div>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="feature-column">Features</th>
                <th className="plan-column">
                  <div className="plan-header">
                    <h3>Basic</h3>
                    <p className="plan-price">Free</p>
                  </div>
                </th>
                <th className="plan-column premium">
                  <div className="plan-header">
                    <h3>Premium</h3>
                    <p className="plan-price">{convert(9.99, currency)} {currency}/mo</p>
                  </div>
                </th>
                <th className="plan-column vip">
                  <div className="plan-header">
                    <h3>VIP</h3>
                    <p className="plan-price">{convert(19.99, currency)} {currency}/mo</p>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={index}>
                  <td className="feature-name">{feature.name}</td>
                  <td className="feature-value">
                    {feature.basic ? (
                      <FontAwesomeIcon icon={faCheck} className="check-icon" />
                    ) : (
                      <FontAwesomeIcon icon={faTimes} className="times-icon" />
                    )}
                  </td>
                  <td className="feature-value">
                    {feature.premium ? (
                      <FontAwesomeIcon icon={faCheck} className="check-icon" />
                    ) : (
                      <FontAwesomeIcon icon={faTimes} className="times-icon" />
                    )}
                  </td>
                  <td className="feature-value">
                    {feature.vip ? (
                      <FontAwesomeIcon icon={faCheck} className="check-icon" />
                    ) : (
                      <FontAwesomeIcon icon={faTimes} className="times-icon" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
