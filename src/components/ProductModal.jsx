import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/productModal.css";
import { fetchFromSupabase, getCachedImage, cache } from "../utils/imageCache";
import { useCurrencyContext } from "../context/CurrencyContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faUser, faTruck, faTags, faXmark } from "@fortawesome/free-solid-svg-icons";

export default function ProductModal({ product, onClose, addToCart, categoriesMap = {} }) {
  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [imageUrls, setImageUrls] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [subQuantities, setSubQuantities] = useState({});
  const [selectedShipping, setSelectedShipping] = useState(null);
  const navigate = useNavigate();
  const { convert, currency } = useCurrencyContext();
  const { updateQuantity } = useCart();
  const [toast, setToast] = useState("");

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
  let totalWeight = parseFloat(product.weight || 0);

  // Shipping fee
  const shippingFee = selectedShipping
    ? parseFloat(product.shipping_methods?.[selectedShipping] || 0)
    : 0;

  // Loop through selected options
  Object.entries(selectedOptions).forEach(([optType, optValue]) => {
    const opt = product.options[optType][optValue];
    if (!opt) return;

    const addedPrice = parseFloat(opt.added_price || 0);
    const extraWeight = parseFloat((opt.extra_weight || "0").replace("kg", "")) || 0;

    totalWeight += extraWeight;

    const quantities = subQuantities[optType] || {};

    (opt.sizes || []).forEach((sz) => {
      const szName = typeof sz === "string" ? sz : Object.keys(sz)[0];
      const szData = typeof sz === "object" ? sz[szName][0] : {};

      const sizePrice = parseFloat(szData?.price || 0);
      const sizeWeight = parseFloat((szData?.weight || "0").replace("kg", "")) || 0;
      const qty = quantities[szName] || 0;

      const baseWeight = parseFloat(product.weight || 0);

      // --- Formula: (base + extras) + (total weight * shipping fee)
      const productWeight = baseWeight + extraWeight + sizeWeight;
      const productPrice = product.price + addedPrice + sizePrice;
      const shippingCost = productWeight * shippingFee;

      total += (productPrice + shippingCost) * qty;
      totalWeight += productWeight * qty;
    });
  });

  // If no sizes were selected (only base product)
  if (Object.keys(subQuantities).length === 0) {
    const baseWeight = parseFloat(product.weight || 0);
    total =
      product.price +
      baseWeight * shippingFee;
  }

  return { total, totalWeight };
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
          <p className="product-Details">{product.description}</p>
          <p className="price">
          <span style={{color:"black"}}>Base price:</span> {convert(product.price, currency)} {currency}
          </p>
          <p className="base"><span style={{color:"black"}}><strong>Base weight:</strong></span> {product.weight}kg</p>
          <p className="base"><span><FontAwesomeIcon icon={faTruck} /> <strong>Shipped from:</strong> </span> {product.shipped_from}</p>
          <p className="category-label"><span style={{color:"black"}}><FontAwesomeIcon icon={faTags} /> Category:</span> {getCategoryName(product.category_id)}</p>

          {/* --- Dynamic Options --- */}
          {product.options &&
            Object.entries(product.options).map(([optionName, optionValues]) => (
              <div key={optionName} className="modal-product-options">
                <div className="options-btn-container">
                  <h4 className="option-title">
                  {optionName.charAt(0).toUpperCase() + optionName.slice(1)}:
                </h4>

                <div className="option-buttons">
                  {Object.entries(optionValues).map(([optionValue]) => (
                    <button
                      key={optionValue}
                      className={`option-btn ${
                        selectedOptions[optionName] === optionValue ? "activebtn" : ""
                      }`}
                      onClick={() => handleOptionSelect(optionName, optionValue)}
                    >
                      {optionValue}
                    </button>
                  ))}
                </div>
                </div>
                
                <div className="modal-option-sizes">
                {selectedOptions[optionName] &&
                  optionValues[selectedOptions[optionName]]?.sizes?.map((sz, idx) => {
                    const szName = typeof sz === "string" ? sz : Object.keys(sz)[0];
                    const szData = typeof sz === "object" ? sz[szName][0] : {};
                    const addedPrice =
                      parseFloat(
                        optionValues[selectedOptions[optionName]]?.added_price || 0
                      ) || 0;
                    const extraWeight =
                      parseFloat(
                        (
                          optionValues[selectedOptions[optionName]]?.extra_weight || "0"
                        ).replace("kg", "")
                      ) || 0;

                    const sizePrice = parseFloat(szData?.price || 0);
                    const sizeWeight =
                      parseFloat((szData?.weight || "0").replace("kg", "")) || 0;

                    const finalPrice = (product.price || 0) + addedPrice + sizePrice;
                    const finalWeight = (parseFloat(product.weight) || 0) + extraWeight + sizeWeight;

                    return (
                      <div key={idx} className="size-item">
                        <div className="valueSection">
                          <span className="size-name">{szName}</span>
                          <span className="unit-price">
                          {convert(finalPrice, currency)} {currency}
                          </span>
                          <span className="unit-weight">{finalWeight.toFixed(2)} kg</span>
                        </div>
                        <div className="buttonsq">
                          <button onClick={() => handleSubQtyChange(optionName, szName, -1)}>
                            -
                          </button>
                          <span>{subQuantities[optionName]?.[szName] || 0}</span>
                          <button onClick={() => handleSubQtyChange(optionName, szName, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            ))}

          {/* --- Shipping Methods --- */}
{product.shipping_methods && (
  <div className="shipping-methods">
    <h4 className="option-title">Shipping Method:</h4>
    <select
      className="shipping-select"
      value={selectedShipping || ""}
      onChange={(e) => setSelectedShipping(e.target.value)}
    >
      <option value="">
        Select a shipping method
      </option>
      {Object.entries(product.shipping_methods).map(([method, cost]) => (
        <option key={method} value={method}>
          {method} ({convert(cost, currency)} {currency})
        </option>
      ))}
    </select>
  </div>
)}

<div className="total">
 <span><strong>Total:</strong></span> {calculateTotalPrice().total.toFixed(2)} {currency}
</div>

          {/* --- Buttons --- */}
          <div className="product-modal-buttons">
            <button className="modal-add-to-cart" onClick={handleAddToCart}>
              Add to Cart
            </button>
            <button
              className="modal-view-btn"
              onClick={() =>
                navigate(`/ProductDetails/${encodeURIComponent(product.id)}/${product.name}`)
              }
            >
              View Product
            </button>
          </div>

          <button className="modal-checkout-btn" onClick={handleCheckout}>
            Checkout ({calculateTotalPrice().total.toFixed(2)} {currency})
          </button>
        </div>

        {toast && <div className="cart-toast">{toast}</div>}
      </div>
    </div>
  );
}
