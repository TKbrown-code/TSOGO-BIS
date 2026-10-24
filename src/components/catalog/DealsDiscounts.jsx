import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCurrencyContext } from "../../context/CurrencyContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire, faClock, faPercent } from "@fortawesome/free-solid-svg-icons";
import { preloadAllImages, getCachedImage } from "../../utils/imageCache";
import { productDetailPath } from "../../utils/productRoutes";
import "../../styles/dealsDiscounts.css";

export default function DealsDiscounts() {
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const { convert, currency } = useCurrencyContext();

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            price,
            new_price,
            product_images!inner(image_url, is_primary)
          `)
          .eq("product_images.is_primary", true)
          .not("new_price", "is", null)
          .limit(6);

        if (error) throw error;

        const mapped = data.map(p => {
          const discount = Math.round(((p.price - p.new_price) / p.price) * 100);
          return {
            ...p,
            image_url: p.product_images?.[0]?.image_url || "/placeholder.png",
            discount
          };
        });

        setProducts(mapped);

        // Preload images
        await preloadAllImages(data);
        const urls = {};
        mapped.forEach(p => {
          urls[p.id] = p.image_url ? getCachedImage(p.image_url) : "/placeholder.png";
        });
        setImages(urls);
      } catch (err) {
        console.error("Error fetching deals:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  if (loading || !products.length) return null;

  return (
    <section className="deals-section">
      <div className="deals-container">
        <div className="deals-header">
          <div className="header-badge hot">
            <FontAwesomeIcon icon={faFire} />
            <span>Hot Deals</span>
          </div>
          <h2 className="deals-title">Limited Time Offers</h2>
          <p className="deals-subtitle">Don't miss out on these amazing discounts!</p>
        </div>

        <div className="deals-grid">
          {products.map(product => (
            <Link key={product.id} to={productDetailPath(product)} className="deal-card">
              <div className="discount-badge">
                <FontAwesomeIcon icon={faPercent} />
                <span>{product.discount}% OFF</span>
              </div>
              
              <div className="deal-image-container">
                <img src={images[product.id] || "/placeholder.png"} alt={product.name} className="deal-image" />
                <div className="image-overlay"></div>
              </div>

              <div className="deal-details">
                <h3 className="deal-name">{product.name}</h3>
                
                <div className="deal-pricing">
                  <span className="original-price">{convert(product.price, currency)} {currency}</span>
                  <span className="deal-price">{convert(product.new_price, currency)} {currency}</span>
                </div>

                <div className="deal-timer">
                  <FontAwesomeIcon icon={faClock} />
                  <span>Ends Soon</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
