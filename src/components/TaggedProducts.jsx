import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { FaTag } from "react-icons/fa";
import "../styles/taggedProducts.css";
import { useCurrencyContext } from "../context/CurrencyContext";
import { getDownloadUrl } from "../hooks/productimages";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullhorn } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";

export default function Promotions({ tag = "promotion" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { convert, currency } = useCurrencyContext();

  useEffect(() => {
    const fetchPromotions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("product_tags")
          .select(`
            tag,
            products (
              id,
              name,
              description,
              price,
              product_images (
                image_path,
                is_primary
              )
            )
          `)
          .eq("tag", tag)
          .order("id", { ascending: true });

        if (error) throw error;

        // Map products and fetch image URLs
        const mappedProducts = await Promise.all(
          data
            .map((t) => t.products)
            .filter(Boolean)
            .map(async (product) => {
              const primaryImage =
                product.product_images?.find((img) => img.is_primary) ||
                product.product_images?.[0] ||
                null;
              const image_url = primaryImage
                ? await getDownloadUrl(primaryImage.image_path)
                : null;

              return {
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.price,
                image_url,
              };
            })
        );

        setProducts(mappedProducts);
      } catch (err) {
        setError(err.message || "Failed to fetch promotions");
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, [tag]);

  if (loading) return <div className="promotions-loading">Loading promotions...</div>;
  if (error) return <div className="promotions-error">{error}</div>;
  if (!products.length) return <div className="promotions-empty">No promotions available.</div>;

  return (
    <section className="promotions-section">
      <div className="promotion-cards-container">
         <h2 className="promotions-title">{tag.toUpperCase()} Products <FontAwesomeIcon icon={faBullhorn} style={{ color: "white", fontSize: "24px" }} /></h2>
      <div className="promotions-grid">
        {products.map((product) => (
          <div key={product.id} className="promotion-card">
            <div className="promotion-badge">
              <FaTag className="promotion-icon" />
              {tag.toUpperCase()}
            </div>
            <div className="promotion-image-wrapper">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="promotion-image" />
              ) : (
                <div className="promotion-placeholder">No Image</div>
              )}
            </div>
            <div className="promotion-info">
              <h3 className="promotion-name">{product.name}</h3>
              <p className="promotion-desc">{product.description}</p>
              <span className="promotion-price">{convert(product.price, currency)} {currency}</span>
              <Link to="/ProductDetails/:id/:name"><button className="promotion-view-btn">View Product</button></Link>
            </div>
          </div>
        ))}
        </div>
        <div className="promotion-footer">
          <p>Get awesome offers from <span style={{color:"yellow"}}>TSOGO-BIS </span>at awesome prices.</p>
          <span>We offer awesome promotion prices <FontAwesomeIcon icon={faBullhorn} style={{ color: "orange", fontSize: "24px" }} /></span>
        </div>
      </div>
    </section>
  );
}

