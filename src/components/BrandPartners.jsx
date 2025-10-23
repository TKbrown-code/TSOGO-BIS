import React from "react";
import "../styles/brandPartners.css";

export default function BrandPartners() {
  const brands = [
    { name: "Samsung", logo: "https://via.placeholder.com/150x60?text=Samsung" },
    { name: "Apple", logo: "https://via.placeholder.com/150x60?text=Apple" },
    { name: "Sony", logo: "https://via.placeholder.com/150x60?text=Sony" },
    { name: "LG", logo: "https://via.placeholder.com/150x60?text=LG" },
    { name: "Nike", logo: "https://via.placeholder.com/150x60?text=Nike" },
    { name: "Adidas", logo: "https://via.placeholder.com/150x60?text=Adidas" },
    { name: "HP", logo: "https://via.placeholder.com/150x60?text=HP" },
    { name: "Dell", logo: "https://via.placeholder.com/150x60?text=Dell" }
  ];

  return (
    <section className="brand-partners-section">
      <div className="brand-partners-container">
        <div className="brand-header">
          <h2 className="brand-title">Trusted Brands</h2>
          <p className="brand-subtitle">We partner with the world's leading brands</p>
        </div>

        <div className="brands-grid">
          {brands.map((brand, index) => (
            <div key={index} className="brand-card">
              <img src={brand.logo} alt={brand.name} className="brand-logo" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
