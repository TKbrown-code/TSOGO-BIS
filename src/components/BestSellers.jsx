import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrencyContext } from "../context/CurrencyContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faTrophy } from "@fortawesome/free-solid-svg-icons";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";
import "../styles/bestSellers.css";

export default function BestSellers() {
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const { convert, currency } = useCurrencyContext();

  useEffect(() => {
    const fetchBestSellers = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            price,
            new_price,
            avg_rating,
            product_images!inner(image_path, is_primary)
          `)
          .eq("product_images.is_primary", true)
          .order("avg_rating", { ascending: false })
          .limit(4);

        if (error) throw error;

        const mapped = data.map(p => ({
          ...p,
          image_url: p.product_images?.[0]?.image_path || "/placeholder.png"
        }));

        setProducts(mapped);

        // Preload images
        await preloadAllImages(data);
        const urls = {};
        mapped.forEach(p => {
          urls[p.id] = p.image_url ? getCachedImage(p.image_url) : "/placeholder.png";
        });
        setImages(urls);
      } catch (err) {
        console.error("Error fetching best sellers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBestSellers();
  }, []);

  if (loading || !products.length) return null;

  return (
    <section className="best-sellers-section">
      <div className="best-sellers-container">
        <div className="section-header">
          <div className="header-badge">
            <FontAwesomeIcon icon={faTrophy} />
            <span>Best Sellers</span>
          </div>
          <h2 className="section-title">Top Rated Products</h2>
          <p className="section-subtitle">Loved by our customers, trusted by thousands</p>
        </div>

        <div className="best-sellers-grid">
          {products.map((product, index) => (
            <Link key={product.id} to={`/ProductDetails/${product.id}/${product.name}`} className="bestseller-card">
              <div className="rank-badge">#{index + 1}</div>
              <div className="product-image-container">
                <img src={images[product.id] || "/placeholder.png"} alt={product.name} className="product-image" />
              </div>
              <div className="product-details">
                <h3 className="product-name">{product.name}</h3>
                <div className="product-rating">
                  <FontAwesomeIcon icon={faStar} className="star-icon" />
                  <span>{product.avg_rating?.toFixed(1) || "5.0"}</span>
                </div>
                <div className="product-price">
                  {product.new_price && (
                    <span className="old-price">{convert(product.price, currency)} {currency}</span>
                  )}
                  <span className="current-price">
                    {convert(product.new_price || product.price, currency)} {currency}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
