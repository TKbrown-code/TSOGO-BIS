import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/productModal.css";
import { fetchFromSupabase, getCachedImage, cache } from "../utils/imageCache";
import { useCurrencyContext } from "../context/CurrencyContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTruck, faTags } from "@fortawesome/free-solid-svg-icons";

export default function ProductModal({ product, onClose, addToCart, categoriesMap = {} }) {
  const [currentImage, setCurrentImage] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [subQuantities, setSubQuantities] = useState({});
  const [selectedShipping, setSelectedShipping] = useState(null);
  const navigate = useNavigate();
  const { convert, currency } = useCurrencyContext();


  // --- Load images ---
  useEffect(() => {
    if (!product?.product_images?.length) return;
    const fetchImages = async () => {
      const urls = await Promise.all(
        product.product_images.map(async (img) => {
          let cached = getCachedImage(img.image_path);
          if (cached === "/placeholder.png") {
            const fetched = await fetchFromSupabase(img.image_path);
            cache[img.image_path] = fetched;
            localStorage.setItem("imageCache", JSON.stringify(cache));
            cached = fetched;
          }
          return cached;
        })
      );
      setImageUrls(urls);
    };
    fetchImages();
  }, [product]);

  const totalImages = imageUrls.length;
  const handleNext = () => setCurrentImage((prev) => (prev + 1) % totalImages);
  const handlePrev = () => setCurrentImage((prev) => (prev - 1 + totalImages) % totalImages);

  // --- Handle option selection dynamically ---
  const handleOptionSelect = (optionType, optionValue) => {
    setSelectedOptions((prev) => ({ ...prev, [optionType]: optionValue }));

    // Reset quantities for sub-options if available
    const sizes =
      product.options[optionType][optionValue]?.sizes?.map((s) =>
        typeof s === "string" ? s : Object.keys(s)[0]
      ) || [];
    const initQty = {};
    sizes.forEach((sz) => {
      initQty[sz] = 0;
    });
    setSubQuantities((prev) => ({ ...prev, [optionType]: initQty }));
  };

  const handleSubQtyChange = (optionType, size, delta) => {
    setSubQuantities((prev) => ({
      ...prev,
      [optionType]: {
        ...prev[optionType],
        [size]: Math.max(0, (prev[optionType]?.[size] || 0) + delta),
      },
    }));
  };

  const calculateTotalPrice = () => {
    let total = 0;
    let totalWeight = 0;
    let totalQuantity = 0;

    // Shipping fee per kg
    const shippingFeePerKg = selectedShipping
      ? parseFloat(product.shipping_methods?.[selectedShipping] || 0)
      : 0;

    const basePrice = parseFloat(product.price || 0);
    const baseWeight = parseFloat(product.weight || 0);

    // Check if any sizes are selected
    let hasSizeSelections = false;

    Object.entries(selectedOptions).forEach(([optType, optValue]) => {
      const opt = product.options?.[optType]?.[optValue];
      if (!opt) return;

      const addedPrice = parseFloat(opt.added_price || 0);
      const extraWeight = parseFloat((opt.extra_weight || "0").replace("kg", "")) || 0;

      const quantities = subQuantities[optType] || {};

      (opt.sizes || []).forEach((sz) => {
        const szName = typeof sz === "string" ? sz : Object.keys(sz)[0];
        const szData = typeof sz === "object" ? sz[szName]?.[0] : {};

        const sizePrice = parseFloat(szData?.price || 0);
        const sizeWeight = parseFloat((szData?.weight || "0").replace("kg", "")) || 0;
        const qty = quantities[szName] || 0;

        if (qty > 0) {
          hasSizeSelections = true;
          totalQuantity += qty;

          // Calculate per-item values
          const itemPrice = basePrice + addedPrice + sizePrice;
          const itemWeight = baseWeight + extraWeight + sizeWeight;
          const itemShippingCost = itemWeight * shippingFeePerKg;

          // Add to totals
          total += (itemPrice + itemShippingCost) * qty;
          totalWeight += itemWeight * qty;
        }
      });
    });

    // If no sizes were selected, calculate for base product only
    if (!hasSizeSelections) {
      totalQuantity = 1;
      const itemShippingCost = baseWeight * shippingFeePerKg;
      total = basePrice + itemShippingCost;
      totalWeight = baseWeight;
    }

    return { 
      total: Math.max(0, total), 
      totalWeight: Math.max(0, totalWeight),
      totalQuantity 
    };
  };


  const handleAddToCart = () => {
    addToCart({
      ...product,
      selectedOptions,
      subQuantities,
      selectedShipping,
      totalPrice: calculateTotalPrice().total,
    });
    onClose();
  };

  const handleCheckout = () => {
    addToCart({
      ...product,
      selectedOptions,
      subQuantities,
      selectedShipping,
      totalPrice: calculateTotalPrice().total,
    });
    navigate("/checkout");
    onClose();
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId) return "Uncategorized";
    const cat = categoriesMap[categoryId];
    if (!cat) return "Unknown";
    if (cat.parent_id && categoriesMap[cat.parent_id]) {
      return `${categoriesMap[cat.parent_id].name} > ${cat.name}`;
    }
    return cat.name;
  };

  return (
    <div className="product-modal-overlay" onClick={onClose}>
      <div className="product-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        {/* --- Images --- */}
        <div className="modal-left">
          {totalImages > 0 ? (
            <>
              <div className="image-carousel">
                <img src={imageUrls[currentImage]} alt={product.name} className="modal-image" />
                {totalImages > 1 && (
                  <>
                    <button className="carousel-btn prev" onClick={handlePrev}>
                      &#8249;
                    </button>
                    <button className="carousel-btn next" onClick={handleNext}>
                      &#8250;
                    </button>
                  </>
                )}
              </div>
              <div className="thumbnail-wrapper">
                {imageUrls.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`${product.name}-${index}`}
                    className={`thumbnail ${index === currentImage ? "active-thumb" : ""}`}
                    onClick={() => setCurrentImage(index)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="product-placeholder">No Image</div>
          )}
        </div>

        {/* --- Product Info --- */}
        <div className="modal-right">
          <h2>{product.name}</h2>
          <p className="product-description">{product.description}</p>
          
          <div className="product-meta">
            <div className="meta-item">
              <span className="meta-label">Base Price:</span>
              <span className="meta-value price-value">{convert(product.price, currency)} {currency}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Base Weight:</span>
              <span className="meta-value">{product.weight} kg</span>
            </div>
            <div className="meta-item">
              <FontAwesomeIcon icon={faTruck} className="meta-icon" />
              <span className="meta-label">Shipped From:</span>
              <span className="meta-value">{product.shipped_from}</span>
            </div>
            <div className="meta-item">
              <FontAwesomeIcon icon={faTags} className="meta-icon" />
              <span className="meta-label">Category:</span>
              <span className="meta-value">{getCategoryName(product.category_id)}</span>
            </div>
          </div>

          {/* --- Dynamic Options --- */}
          {product.options &&
            Object.entries(product.options).map(([optionName, optionValues]) => (
              <div key={optionName} className="modal-product-options">
                <h4 className="option-title">
                  {optionName.charAt(0).toUpperCase() + optionName.slice(1)}
                </h4>

                <div className="option-buttons">
                  {Object.entries(optionValues).map(([optionValue]) => (
                    <button
                      key={optionValue}
                      className={`option-btn ${
                        selectedOptions[optionName] === optionValue ? "active" : ""
                      }`}
                      onClick={() => handleOptionSelect(optionName, optionValue)}
                    >
                      {optionValue}
                    </button>
                  ))}
                </div>
                
                {selectedOptions[optionName] && (
                  <div className="modal-option-sizes">
                    {optionValues[selectedOptions[optionName]]?.sizes?.map((sz, idx) => {
                      const szName = typeof sz === "string" ? sz : Object.keys(sz)[0];
                      const szData = typeof sz === "object" ? sz[szName]?.[0] : {};
                      const addedPrice = parseFloat(
                        optionValues[selectedOptions[optionName]]?.added_price || 0
                      );
                      const extraWeight = parseFloat(
                        (optionValues[selectedOptions[optionName]]?.extra_weight || "0").replace("kg", "")
                      );

                      const sizePrice = parseFloat(szData?.price || 0);
                      const sizeWeight = parseFloat((szData?.weight || "0").replace("kg", ""));

                      const finalPrice = (product.price || 0) + addedPrice + sizePrice;
                      const finalWeight = (parseFloat(product.weight) || 0) + extraWeight + sizeWeight;

                      return (
                        <div key={idx} className="size-item">
                          <div className="size-info">
                            <span className="size-name">{szName}</span>
                            <div className="size-details">
                              <span className="size-price">
                                {convert(finalPrice, currency)} {currency}
                              </span>
                              <span className="size-weight">{finalWeight.toFixed(2)} kg</span>
                            </div>
                          </div>
                          <div className="quantity-controls">
                            <button 
                              className="qty-btn"
                              onClick={() => handleSubQtyChange(optionName, szName, -1)}
                              disabled={(subQuantities[optionName]?.[szName] || 0) === 0}
                            >
                              −
                            </button>
                            <span className="qty-display">{subQuantities[optionName]?.[szName] || 0}</span>
                            <button 
                              className="qty-btn"
                              onClick={() => handleSubQtyChange(optionName, szName, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
            ))}

          {/* --- Shipping Methods --- */}
          {product.shipping_methods && (
            <div className="shipping-section">
              <h4 className="option-title">Shipping Method</h4>
              <select
                className="shipping-select"
                value={selectedShipping || ""}
                onChange={(e) => setSelectedShipping(e.target.value)}
              >
                <option value="">Select shipping method</option>
                {Object.entries(product.shipping_methods).map(([method, cost]) => (
                  <option key={method} value={method}>
                    {method} - {convert(cost, currency)} {currency}/kg
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* --- Total Summary --- */}
          <div className="order-summary">
            <div className="summary-row">
              <span className="summary-label">Total Quantity:</span>
              <span className="summary-value">{calculateTotalPrice().totalQuantity}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Weight:</span>
              <span className="summary-value">{calculateTotalPrice().totalWeight.toFixed(2)} kg</span>
            </div>
            <div className="summary-row total-row">
              <span className="summary-label">Total Price:</span>
              <span className="summary-value total-price">
                {convert(calculateTotalPrice().total, currency)} {currency}
              </span>
            </div>
          </div>

          {/* --- Action Buttons --- */}
          <div className="modal-actions">
            <div className="action-buttons">
              <button className="btn-add-cart" onClick={handleAddToCart}>
                Add to Cart
              </button>
              <button
                className="btn-view-details"
                onClick={() =>
                  navigate(`/ProductDetails/${encodeURIComponent(product.id)}/${product.name}`)
                }
              >
                View Details
              </button>
            </div>

            <button className="btn-checkout" onClick={handleCheckout}>
              Checkout - {convert(calculateTotalPrice().total, currency)} {currency}
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}
