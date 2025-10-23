import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import LazyImage from "./LazyImage";
import { getCachedImage } from "../utils/imageCache";
import "../styles/enhanced-product-card-new.css";

export default function EnhancedProductCard({ 
  product, 
  onProductClick,
  showQuickAdd = true 
}) {
  const { addToCart } = useCart();
  const { convert, currency } = useCurrencyContext();
  const [isHovered, setIsHovered] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const {
    id,
    name,
    description,
    price,
    new_price,
    product_images = [],
    avg_rating = 0,
    product_reviews = []
  } = product;

  const primaryImage = product_images.find(img => img.is_primary)?.image_path || product_images[0]?.image_path;
  const imageUrl = primaryImage ? getCachedImage(primaryImage) : "/placeholder.png";

  // Calculate star rating
  const fullStars = Math.floor(avg_rating);
  const hasHalfStar = avg_rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    setIsAddingToCart(true);
    
    try {
      await addToCart(product, 1);
      // Success feedback handled by cart context
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const truncateDescription = (text, maxLength = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getDiscountPercentage = () => {
    if (!new_price || new_price >= price) return 0;
    return Math.round(((price - new_price) / price) * 100);
  };

  const discountPercentage = getDiscountPercentage();

  return (
    <div 
      className="enhanced-product-card"
      onClick={() => onProductClick && onProductClick(product)}
    >
      {/* Product Image */}
      <div className="epc-image-wrapper">
        <LazyImage
          src={imageUrl}
          alt={name}
          className="epc-image"
          placeholder="/placeholder.png"
        />
        
        {/* Discount Badge */}
        {discountPercentage > 0 && (
          <span className="epc-badge discount">
            -{discountPercentage}%
          </span>
        )}
      </div>

      {/* Product Info */}
      <div className="epc-body">
        <h3 className="epc-title" title={name}>
          {name}
        </h3>
        
        <p className="epc-desc">
          {truncateDescription(description)}
        </p>

        {/* Price */}
        <div className="epc-price">
          {new_price ? (
            <>
              <span className="price-current">
                {convert(new_price, currency)} {currency}
              </span>
              <span className="price-old">
                {convert(price, currency)} {currency}
              </span>
            </>
          ) : (
            <span className="price-current">
              {convert(price, currency)} {currency}
            </span>
          )}
        </div>

        {/* Footer with Rating and Stock */}
        <div className="epc-footer">
          {avg_rating > 0 ? (
            <span className="epc-rating">
              ⭐ {avg_rating.toFixed(1)}
            </span>
          ) : (
            <span className="epc-rating">New</span>
          )}
          <span className="epc-stock in-stock">In Stock</span>
        </div>
      </div>
    </div>
  );
}
