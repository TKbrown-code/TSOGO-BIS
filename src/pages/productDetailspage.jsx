import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useUserContext } from "../context/useUserContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import "../styles/productDetails.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faTruck, faTags } from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";
import FallBackImage from "../assets/imagefallback.jpg";
import { useModalMessage } from "../context/ModalMessageContext";
import { MessageSquareText, Star } from "lucide-react";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;
const productDataCache = new Map();
const productRequestCache = new Map();
const PRODUCT_CACHE_TTL_MS = 30_000;

export default function ProductDetailsPage({ onReady }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, clearCart, setCartOpen } = useCart();
  const { profile, user } = useUserContext();
  const { showAlert, confirmDialog } = useModalMessage();
  const { currency, convert } = useCurrencyContext();
  const { t } = useTranslation();

  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [imageStates, setImageStates] = useState({});
  const [currentImage, setCurrentImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [quantities, setQuantities] = useState({});
  const [selectedShipping, setSelectedShipping] = useState("");
  const [shippingMethods, setShippingMethods] = useState({});
  const [shippingFee, setShippingFee] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [reviewUpdate, setReviewUpdates] = useState({});
  const [reviewClock, setReviewClock] = useState(Date.now());
  const [rating, setRating] = useState(0);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewOrderItemId, setReviewOrderItemId] = useState(null);
  const [reviewSecondsLeft, setReviewSecondsLeft] = useState(0);
  const [productError, setProductError] = useState(false);

  // Load product data
  useEffect(() => {
    if (!id) return;
    let active = true;
    const productKey = String(id);
    setProductError(false);
    setProduct((current) => current && String(current.id) !== productKey ? null : current);

    async function fetchProduct() {
      let data = null;
      let error = null;
      const cachedProduct = productDataCache.get(productKey);

      if (cachedProduct && Date.now() - cachedProduct.savedAt < PRODUCT_CACHE_TTL_MS) {
        data = cachedProduct.data;
      } else {
        let request = productRequestCache.get(productKey);
        if (!request) {
          request = supabase.from("products")
            .select("*, product_images(image_url,alt_text,is_primary,sort_order), category_id(name)")
            .eq("id", id)
            .single()
            .then((result) => {
              if (result.data && !result.error) productDataCache.set(productKey, { data: result.data, savedAt: Date.now() });
              return result;
            })
            .finally(() => productRequestCache.delete(productKey));
          productRequestCache.set(productKey, request);
        }
        ({ data, error } = await request);
      }

      if (!active) return;

      if (error || !data) {
        console.error("Error fetching product:", error);
        setProductError(true);
        return;
      }

      if (data) {
        setRating(data.avg_rating);
      }

      let parsedOptions = {};
      try {
        parsedOptions = typeof data.options === "string" ? 
          JSON.parse(data.options) : 
          (data.options || {});
      } catch (err) {
        console.error("Invalid product options JSON:", err);
        parsedOptions = {};
      }
      if (!parsedOptions || !Object.keys(parsedOptions).length) parsedOptions = { Item: { Standard: {} } };

      const imgs = [...(data.product_images || [])]
        .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map(img => {
        return {
          url: img.image_url || img.path || img.image_url,
          path: img.image_url || img.path || img.image_url,
          alt: img.alt_text || data.name,
        };
      });
      setImages(imgs);

      setProduct({
        ...data,
        options: parsedOptions,
        shipped_from: data.origin_country || data.shipped_from || "Unknown",
      });
      

      // Set default selection - get first option type and first option value
      const firstOptionType = Object.keys(parsedOptions)[0];
      const firstOptionValue = firstOptionType ? Object.keys(parsedOptions[firstOptionType])[0] : "";
      setSelectedColor(firstOptionValue);

      // Initialize quantities (empty - will be populated as user selects)
      setQuantities({});

      // Set shipping methods
      let shippingData = {};
      try {
        shippingData = typeof data.shipping_methods === "string" ? JSON.parse(data.shipping_methods) : (data.shipping_methods || {});
        if (Array.isArray(shippingData)) {
          shippingData = Object.fromEntries(shippingData.map((method) => [
            method.name || method.method || method.label,
            method.price ?? method.pricePerKg ?? method.fee ?? method.rate ?? 0,
          ]).filter(([name]) => name));
        }
      } catch (err) {
        console.error("Invalid shipping methods JSON:", err);
      }
      setShippingMethods(shippingData);
      setSelectedShipping(Object.keys(shippingData)[0] || "");
    }

    fetchProduct().catch((fetchError) => {
      if (!active) return;
      console.error("Unexpected product loading error:", fetchError);
      setProductError(true);
    });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (product || productError) onReady?.();
  }, [product, productError, onReady]);

  // Fetch reviews
  useEffect(() => {
    if (!id) return;

    async function fetchReviews() {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching reviews:", error);
      } else {
        setAllReviews(data || []);
        setReviews((data || []).slice(0, 5)); // Show first 5
        const publicRatings = (data || []).filter((review) => review.status === "published").map((review) => Number(review.rating)).filter(Number.isFinite);
        setRating(publicRatings.length ? publicRatings.reduce((sum, value) => sum + value, 0) / publicRatings.length : 0);
      }
    }

    fetchReviews();
  }, [id]);

  // Check if user has purchased this product
  useEffect(() => {
    if (!id || !user?.id) {
      setCheckingPurchase(false);
      setHasPurchased(false);
      setHasReviewed(false);
      setReviewOrderItemId(null);
      return;
    }

    async function checkPurchaseHistory() {
      setCheckingPurchase(true);
      setHasPurchased(false);
      setHasReviewed(false);
      setReviewOrderItemId(null);
      try {
        const { data: checkouts, error } = await supabase
          .from("checkouts")
          .select("checkout_id,order_id,delivered_at,delivery_status,payment_status")
          .eq("user_id", user.id)
          .eq("payment_status", "paid")
          .eq("delivery_status", "delivered")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error checking purchase history:", error);
          setHasPurchased(false);
          return;
        }

        const eligibleCheckouts = (checkouts || []).filter((checkout) => checkout.order_id && checkout.delivered_at &&
          Date.now() < new Date(checkout.delivered_at).getTime() + 60_000);
        const orderIds = eligibleCheckouts.map((checkout) => checkout.order_id);
        if (orderIds.length) {
          const { data: orderItems, error: itemsError } = await supabase
            .from("order_items")
            .select("id,order_id")
            .in("order_id", orderIds)
            .eq("product_id", Number(id));
          if (itemsError) throw itemsError;
          const matchingItem = (orderItems || []).find((item) => eligibleCheckouts.some((checkout) => checkout.order_id === item.order_id));
          if (matchingItem) {
            setReviewOrderItemId(matchingItem.id);
            setHasPurchased(true);
            const matchingCheckout = eligibleCheckouts.find((checkout) => checkout.order_id === matchingItem.order_id);
            setReviewSecondsLeft(Math.max(0, Math.ceil((new Date(matchingCheckout.delivered_at).getTime() + 60_000 - Date.now()) / 1000)));
          }
        }

        const { data: existingReviews, error: reviewError } = await supabase
          .from("product_reviews")
          .select("id")
          .eq("product_id", id)
          .eq("user_id", user.id)
          .limit(1);
        if (reviewError) console.error("Error checking existing product review:", reviewError);
        setHasReviewed(Boolean(existingReviews?.length));
      } catch (err) {
        console.error("Error checking purchase:", err);
        setHasPurchased(false);
      } finally {
        setCheckingPurchase(false);
      }
    }

    checkPurchaseHistory();
  }, [id, user?.id]);


  // Toggle show all reviews
  const toggleReviews = () => {
    if (showAllReviews) {
      setReviews(allReviews.slice(0, 5));
    } else {
      setReviews(allReviews);
    }
    setShowAllReviews(!showAllReviews);
  };

  // Calculate totals when quantities, color, or shipping method changes
  useEffect(() => {
    if (!product) return;

    let grandTotal = 0;
    let totalW = 0;
    const basePrice = parseFloat(product.price || 0);
    const baseWeight = parseFloat(product.weight || 0);

    // Calculate totals across all options dynamically
    Object.entries(product.options || {}).forEach(([optionType, optionValues]) => {
      Object.entries(optionValues).forEach(([optionValue, optionData]) => {
        
        // Extract extra price/weight (supports multiple naming conventions)
        const extraPrice = parseFloat(optionData?.extraPrice || optionData?.added_price || 0);
        const extraWeight = parseFloat(optionData?.extraWeight || optionData?.extra_weight || 0);
        
        // Find any array property in optionData
        let subOptionsArray = null;
        for (const value of Object.values(optionData)) {
          if (Array.isArray(value)) {
            subOptionsArray = value;
            break;
          }
        }
        
        // If we found a sub-options array
        if (subOptionsArray && subOptionsArray.length > 0) {
          subOptionsArray.forEach(item => {
            const itemName = typeof item === "string" ? item : Object.keys(item)[0];
            const itemData = typeof item === "object" ? item[itemName]?.[0] : null;
            
            const itemPrice = itemData?.price ? parseFloat(itemData.price) : 0;
            const itemWeight = itemData?.weight ? parseFloat(itemData.weight) : 0;
            
            const qty = quantities[`${optionValue}-${itemName}`] || 0;
            
            if (qty > 0) {
              const unitPrice = basePrice + extraPrice + itemPrice;
              const unitWeight = baseWeight + extraWeight + itemWeight;
              
              grandTotal += unitPrice * qty;
              totalW += unitWeight * qty;
            }
          });
        } else {
          // No sub-options, treat as single item
          const qty = quantities[`${optionValue}-default`] || 0;
          
          if (qty > 0) {
            const unitPrice = basePrice + extraPrice;
            const unitWeight = baseWeight + extraWeight;
            
            grandTotal += unitPrice * qty;
            totalW += unitWeight * qty;
          }
        }
      });
    });

    setTotalPrice(grandTotal);
    setTotalWeight(totalW);

    const methodPrice = parseFloat(shippingMethods[selectedShipping] || 0);
    setShippingFee(methodPrice * totalW);
  }, [quantities, selectedShipping, product, shippingMethods]);

  // Handle quantity changes
  const handleQtyChange = (size, delta) => {
    setQuantities(prev => {
      const currentQty = prev[`${selectedColor}-${size}`] || 0;
      const newQty = Math.max(0, currentQty + delta);
      
      if (newQty === 0) {
        const { [`${selectedColor}-${size}`]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [`${selectedColor}-${size}`]: newQty };
    });
  };

  // Handle color change
  const handleColorChange = (color) => {
    setSelectedColor(color);
    // Keep all quantities, just update the selected color
    // The UI will filter quantities for the current color
  };

  // Carousel navigation
  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
  };

  // Add to cart handler
  const handleAddToCart = async () => {
    if (!user) { showAlert("Sign in to add this item to your bag and continue to checkout.", "Sign in to continue", "warning"); navigate("/SignUp"); return; }

    const cartItems = [];
    const methodPrice = parseFloat(shippingMethods[selectedShipping] || 0);
    const basePrice = parseFloat(product.price || 0);
    const baseWeight = parseFloat(product.weight || 0);
    
    // Loop through ALL options dynamically
    Object.entries(product.options || {}).forEach(([optionType, optionValues]) => {
      Object.entries(optionValues).forEach(([optionValue, optionData]) => {
        
        // Extract extra price/weight
        const extraPrice = parseFloat(optionData?.extraPrice || optionData?.added_price || 0);
        const extraWeight = parseFloat(optionData?.extraWeight || optionData?.extra_weight || 0);
        
        // Find any array property in optionData
        let subOptionsArray = null;
        let subOptionsKey = null;
        for (const [key, value] of Object.entries(optionData)) {
          if (Array.isArray(value)) {
            subOptionsArray = value;
            subOptionsKey = key;
            break;
          }
        }
        
        // If we found a sub-options array
        if (subOptionsArray && subOptionsArray.length > 0) {
          subOptionsArray.forEach(item => {
            const itemName = typeof item === "string" ? item : Object.keys(item)[0];
            const itemData = typeof item === "object" ? item[itemName]?.[0] : null;
            const qty = quantities[`${optionValue}-${itemName}`] || 0;
            
            if (qty > 0) {
              const itemPrice = itemData?.price ? parseFloat(itemData.price) : 0;
              const itemWeight = itemData?.weight ? parseFloat(itemData.weight) : 0;
              
              const unitPrice = basePrice + extraPrice + itemPrice;
              const unitWeight = baseWeight + extraWeight + itemWeight;
              const totalWeight = unitWeight * qty;
              const shippingFee = methodPrice * totalWeight;
              
              cartItems.push({
                product,
                quantity: qty,
                selectedColor: optionValue,
                selectedSize: itemName,
                shippingMethod: selectedShipping,
                shippingFee: shippingFee / qty,
                selectedOption: {
                  [optionType]: optionValue,
                  [subOptionsKey]: itemName,
                  display: `${optionValue} - ${itemName}`,
                  price: unitPrice,  // ✅ Store the FINAL price for this option
                  shipping_method: selectedShipping,
                  shipping_fee: shippingFee / qty,
                  weight: unitWeight,
                  total_weight: totalWeight
                }
              });
            }
          });
        } else {
          // No sub-options, treat as single item
          const qty = quantities[`${optionValue}-default`] || 0;
          
          if (qty > 0) {
            const unitPrice = basePrice + extraPrice;
            const unitWeight = baseWeight + extraWeight;
            const totalWeight = unitWeight * qty;
            const shippingFee = methodPrice * totalWeight;
            
            cartItems.push({
              product,
              quantity: qty,
              selectedColor: optionValue,
              selectedSize: null,
              shippingMethod: selectedShipping,
              shippingFee: shippingFee / qty,
              selectedOption: {
                [optionType]: optionValue,
                display: optionValue,
                price: unitPrice,  // ✅ Store the FINAL price for this option
                shipping_method: selectedShipping,
                shipping_fee: shippingFee / qty,
                weight: unitWeight,
                total_weight: totalWeight
              }
            });
          }
        }
      });
    });

    if (cartItems.length === 0) {
      return showAlert("Please select at least one option and quantity.", "Choose your options", "warning");
    }

    
    // Add all items to cart
    let allAdded = true;
    for (const item of cartItems) {
      const success = await addToCart(item.product, item.quantity, {
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        shippingMethod: item.shippingMethod,
        shippingFee: item.shippingFee,
        selectedOption: item.selectedOption
      });
      
      if (!success) {
        console.error('Failed to add item:', item);
        allAdded = false;
      }
    }
    if (allAdded) setCartOpen(true);
  };

  // Checkout handler
  const handleCheckout = async (name, phone, address) => {
    try {
      const itemsToCheckout = [];
      const methodPrice = parseFloat(shippingMethods[selectedShipping] || 0);
      let totalShippingFee = 0;
      const basePrice = parseFloat(product.price || 0);
      const baseWeight = parseFloat(product.weight || 0);
      
      // Loop through ALL options dynamically
      Object.entries(product.options || {}).forEach(([optionType, optionValues]) => {
        Object.entries(optionValues).forEach(([optionValue, optionData]) => {
          
          // Extract extra price/weight
          const extraPrice = parseFloat(optionData?.extraPrice || optionData?.added_price || 0);
          const extraWeight = parseFloat(optionData?.extraWeight || optionData?.extra_weight || 0);
          
          // Find any array property in optionData
          let subOptionsArray = null;
          let subOptionsKey = null;
          for (const [key, value] of Object.entries(optionData)) {
            if (Array.isArray(value)) {
              subOptionsArray = value;
              subOptionsKey = key;
              break;
            }
          }
          
          // If we found a sub-options array
          if (subOptionsArray && subOptionsArray.length > 0) {
            subOptionsArray.forEach(item => {
              const itemName = typeof item === "string" ? item : Object.keys(item)[0];
              const itemData = typeof item === "object" ? item[itemName]?.[0] : null;
              const qty = quantities[`${optionValue}-${itemName}`] || 0;
              
              if (qty > 0) {
                const itemPrice = itemData?.price ? parseFloat(itemData.price) : 0;
                const itemWeight = itemData?.weight ? parseFloat(itemData.weight) : 0;
                
                const unitPrice = basePrice + extraPrice + itemPrice;
                const unitWeight = baseWeight + extraWeight + itemWeight;
                const totalWeight = unitWeight * qty;
                const itemShippingFee = methodPrice * totalWeight;
                totalShippingFee += itemShippingFee;

                itemsToCheckout.push({
                  product_id: product.id,
                  name: product.name,
                  quantity: qty,
                  size: itemName,
                  color: optionValue,
                  option: `${optionValue} - ${itemName}`,
                  unitPrice: unitPrice,
                  price: unitPrice,
                  totalPrice: unitPrice * qty,
                  shipping_method: selectedShipping,
                  shipping_fee: itemShippingFee,
                });
              }
            });
          } else {
            // No sub-options, treat as single item
            const qty = quantities[`${optionValue}-default`] || 0;
            
            if (qty > 0) {
              const unitPrice = basePrice + extraPrice;
              const unitWeight = baseWeight + extraWeight;
              const totalWeight = unitWeight * qty;
              const itemShippingFee = methodPrice * totalWeight;
              totalShippingFee += itemShippingFee;

              itemsToCheckout.push({
                product_id: product.id,
                name: product.name,
                quantity: qty,
                option: optionValue,
                unitPrice: unitPrice,
                price: unitPrice,
                totalPrice: unitPrice * qty,
                shipping_method: selectedShipping,
                shipping_fee: itemShippingFee,
              });
            }
          }
        });
      });

      const totalAmount = itemsToCheckout.reduce((sum, item) => sum + item.totalPrice, 0) + totalShippingFee;

      if (isNaN(totalAmount) || totalAmount <= 0) {
        throw new Error('Invalid total amount calculated for checkout');
      }

      const res = await fetch(
        "https://bompysyuamyalbzmubzo.supabase.co/functions/v1/create-campay-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
         body: JSON.stringify({
  name,
  phone,
  address,
  email: profile?.email ?? "guest@example.com",
  total: totalAmount,
  items: itemsToCheckout,
  userId: profile?.user_id ?? "guest",
  status: "pending",
}),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success || !data.reference)
        throw new Error(data?.error || "Payment initialization failed");

      setPaymentData({
        url: data.paymentUrl,
        checkoutId: data.checkout_id,
        reference: data.reference,
      });
      setPaymentModalOpen(true);
    } catch (err) {
      console.error("Checkout error:", err);
      showAlert(err.message || "Failed to process checkout", "Checkout could not start", "error");
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("checkouts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkouts" },
        (payload) => {
          const updatedCheckout = payload.new;
          if (updatedCheckout.status === "paid") {
            showAlert("Your payment has been confirmed.", "Payment confirmed");
            clearCart();
            navigate("/orders");
          } else if (updatedCheckout.status === "failed") {
            showAlert("Payment failed. Please try again.", "Payment failed", "error");
          }
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Hooks must run on every render, including while the product is loading.
  useEffect(() => {
    if (!hasPurchased || reviewSecondsLeft <= 0) return undefined;
    const timerId = window.setInterval(() => {
      setReviewSecondsLeft((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [hasPurchased, reviewSecondsLeft > 0]);

  useEffect(() => {
    const hasEditableReview = user?.id && reviews.some((review) => review.user_id === user.id && Date.now() < new Date(review.created_at).getTime() + 180_000);
    if (!hasEditableReview) return undefined;
    const timerId = window.setInterval(() => {
      const now = Date.now();
      setReviewClock(now);
      if (!reviews.some((review) => review.user_id === user.id && now < new Date(review.created_at).getTime() + 180_000)) {
        window.clearInterval(timerId);
      }
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [reviews, user?.id]);

  if (!product) {
    if (!productError) return <main className="product-detail-skeleton" aria-label={t("product_details.loading_product")} aria-busy="true" style={{ minHeight: "calc(100vh - 60px)" }}><div className="detail-skeleton-gallery"><div className="detail-skeleton-image" /><div className="detail-skeleton-thumbnails"><i /><i /><i /><i /></div></div><div className="detail-skeleton-info"><i className="detail-skeleton-eyebrow" /><i className="detail-skeleton-title" /><i className="detail-skeleton-copy" /><i className="detail-skeleton-copy short" /><div className="detail-skeleton-meta"><i /><i /><i /></div><i className="detail-skeleton-option" /><i className="detail-skeleton-row" /><i className="detail-skeleton-select" /><i className="detail-skeleton-total" /><i className="detail-skeleton-button" /></div></main>;
    return <main className="product-state-page"><section className="product-state-card" role="alert"><span className="product-state-mark">T</span><h1>{t("product_details.product_not_found")}</h1><p>{t("product_details.product_unavailable")}</p><button type="button" onClick={() => navigate("/shop")}>{t("product_details.explore_shop")}</button></section></main>;
  }

  // Image loading handlers
  const handleImageLoad = (imagePath) => {
    setImageStates(prev => ({
      ...prev,
      [imagePath]: { loaded: true, error: false }
    }));
  };

  const handleImageError = (imagePath, e) => {
    setImageStates(prev => ({
      ...prev,
      [imagePath]: { loaded: true, error: true }
    }));
    e.target.src = FallBackImage;
  };

  // Helper functions for reviews
  const renderStars = (value) => <span className="review-star-row" aria-label={t("product_details.rating_out_of_five", { rating: value })}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < Math.round(value) ? "currentColor" : "none"} />)}</span>;
  const canEdit = (review) => Boolean(user?.id && review.user_id === user.id && reviewClock < new Date(review.created_at).getTime() + 180_000);
  const reviewWindowOpen = hasPurchased && reviewSecondsLeft > 0;

  // Render product details
  return (
    <div className="premium-details-container">
      {/* Left side - Product Images */}
      <div className="right">
        <div className="premium-gallery">
          <div className="carousel-container">
            <motion.div 
              className="image-view"
              key={currentImage}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <img 
                src={images[currentImage]?.url || FallBackImage}
                alt={images[currentImage]?.alt || product.name}
                className={`zoomable-img ${imageStates[images[currentImage]?.path]?.loaded ? 'loaded' : 'loading'} ${imageStates[images[currentImage]?.path]?.error ? 'error' : ''}`}
                onLoad={() => handleImageLoad(images[currentImage]?.path)}
                onError={(e) => handleImageError(images[currentImage]?.path, e)}
                onClick={() => images[currentImage]?.url && window.open(images[currentImage]?.url, '_blank', 'noopener,noreferrer')}
              />
            </motion.div>
            
            {/* Navigation Arrows */}
            <button 
              className="carousel-arrow left-arrow" 
              onClick={prevImage}
              disabled={images.length <= 1}
            >
              ‹
            </button>
            <button 
              className="carousel-arrow right-arrow" 
              onClick={nextImage}
              disabled={images.length <= 1}
            >
              ›
            </button>
          </div>
          
          {/* Thumbnails */}
          {images.length > 1 && <div className="product-thumbnails" aria-label="Product photos">{images.map((img, idx) => <button type="button" key={`${img.url}-${idx}`} className={idx === currentImage ? "is-active" : ""} onClick={() => setCurrentImage(idx)} aria-label={`Show product photo ${idx + 1}`}><img src={img.url || FallBackImage} alt="" /></button>)}</div>}
        </div>

        {/* Reviews Section */}
        <div className="premium-reviews">
          <h2>{t("product_details.reviews_title")}</h2>
          {rating ? (
            <div className="average-rating">
              <span>{renderStars(rating)}</span>
              <span className="rating-number">({rating && typeof rating === 'number' ? rating.toFixed(1) : rating})</span>
            </div>
          ) : null}

          {/* Existing reviews */}
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <div key={review.id} className="review-container">
                <div className="review">
                  <div className="review-header">
                    <FontAwesomeIcon icon={faUser} className="user_icon" />
                    <div className="review-comment">
                      <strong>{t("product_details.verified_customer", { defaultValue: "Verified customer" })}</strong>
                      <p>{review.body || review.comment}</p>
                      <small>{new Date(review.created_at).toLocaleDateString()}</small>
                    </div>
                  </div>
                  <div className="review-stars">
                    <span className="stars"><Star size={14} fill="currentColor" /> {review.rating}</span>
                    {canEdit(review) && <>
                      <small className="review-edit-window">{t("product_details.review_edit_time_left", { seconds: Math.max(0, Math.ceil((new Date(review.created_at).getTime() + 180_000 - reviewClock) / 1000)), defaultValue: `You can update or delete this review for ${Math.max(0, Math.ceil((new Date(review.created_at).getTime() + 180_000 - reviewClock) / 1000))} more seconds.` })}</small>
                      <button className="editbtn" type="button" onClick={() => {
                        if (editingReviewId !== review.id) {
                          setEditingReviewId(review.id);
                          setReviewUpdates((prev) => ({ ...prev, [review.id]: { comment: review.body || review.comment || "", rating: Number(review.rating) || 5 } }));
                        } else setEditingReviewId(null);
                      }}>{editingReviewId === review.id ? t("product_details.cancel") : t("product_details.edit_review")}</button>
                      <button className="editbtn review-delete-btn" type="button" onClick={async () => {
                        const confirmed = await confirmDialog(t("product_details.review_delete_confirm", { defaultValue: "Delete this review? You can only delete it within three minutes after posting." }), t("product_details.delete_review", { defaultValue: "Delete review" }), { confirmLabel: t("product_details.delete_review", { defaultValue: "Delete review" }), tone: "warning" });
                        if (!confirmed) return;
                        const { error: deleteError } = await supabase.from("product_reviews").delete().eq("id", review.id);
                        if (deleteError) {
                          console.error("Error deleting review:", deleteError);
                          showAlert(deleteError.message || t("product_details.review_delete_failed", { defaultValue: "The review could not be deleted." }), t("product_details.review_delete_failed_title", { defaultValue: "Review could not be deleted" }), "error");
                          return;
                        }
                        setAllReviews((prev) => prev.filter((item) => item.id !== review.id));
                        setReviews((prev) => prev.filter((item) => item.id !== review.id));
                        const publicRatings = allReviews.filter((item) => item.id !== review.id && item.status === "published").map((item) => Number(item.rating)).filter(Number.isFinite);
                        setRating(publicRatings.length ? publicRatings.reduce((sum, value) => sum + value, 0) / publicRatings.length : 0);
                        setHasReviewed(false);
                        setEditingReviewId(null);
                        showAlert(t("product_details.review_deleted", { defaultValue: "Your review has been deleted." }), t("product_details.review_deleted_title", { defaultValue: "Review deleted" }));
                      }}><span>{t("product_details.delete_review", { defaultValue: "Delete review" })}</span></button>
                    </>}
                  </div>
                </div>

                {editingReviewId === review.id && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const updateText = reviewUpdate[review.id]?.comment?.trim();
                      if (!updateText) {
                        showAlert("Please enter a valid review.", "Review details needed", "warning");
                        return;
                      }

                      const { data, error } = await supabase
                        .from("product_reviews")
                        .update({
                          body: updateText,
                          rating: Number(reviewUpdate[review.id]?.rating) || 5,
                          updated_at: new Date().toISOString()
                        })
                        .eq("id", review.id)
                        .select();

                      if (error) {
                        console.error("Error updating review:", error);
                        showAlert("Failed to update review.", "Review could not be updated", "error");
                      } else if (data && data.length > 0) {
                        const updatedReviews = allReviews.map((item) => item.id === review.id ? { ...item, ...data[0] } : item);
                        setAllReviews(updatedReviews);
                        setReviews((prev) => prev.map((item) => item.id === review.id ? { ...item, ...data[0] } : item));
                        const publicRatings = updatedReviews.filter((item) => item.status === "published").map((item) => Number(item.rating)).filter(Number.isFinite);
                        setRating(publicRatings.length ? publicRatings.reduce((sum, value) => sum + value, 0) / publicRatings.length : 0);
                        setEditingReviewId(null);
                        showAlert("Your review has been updated.", "Review updated");
                      }
                    }}
                  >
                    <div className="rating-input" aria-label={t("product_details.rating_label")}>
                      <span>{t("product_details.rating_label")}: </span>
                      {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={`star ${star <= Number(reviewUpdate[review.id]?.rating || 5) ? "filled" : ""}`} aria-label={t("product_details.rating_out_of_five", { rating: star })} onClick={() => setReviewUpdates((prev) => ({ ...prev, [review.id]: { ...prev[review.id], rating: star } }))}>★</button>)}
                    </div>
                    <textarea
                      value={reviewUpdate[review.id]?.comment || ""}
                      onChange={(e) => setReviewUpdates((prev) => ({ ...prev, [review.id]: { ...prev[review.id], comment: e.target.value } }))}
                      placeholder={t("product_details.review_placeholder")}
                      required
                    />
                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => setEditingReviewId(null)}
                      >
                        {t("product_details.cancel")}
                      </button>
                      <button type="submit">{t("product_details.update")}</button>
                    </div>
                  </form>
                )}
              </div>
            ))
          ) : (
            <div className="reviews-empty-state" role="img" aria-label={t("product_details.no_reviews")}><MessageSquareText size={22} /></div>
          )}

          {/* View More/Less Toggle */}
          {allReviews.length > 5 && (
            <button 
              className="view-toggle-btn"
              onClick={toggleReviews}
            >
              {showAllReviews ? t("product_details.view_less") : t("product_details.view_all", { count: allReviews.length })}
            </button>
          )}

          {/* Add Review Form */}
          {user && (
            <>
              {checkingPurchase ? (
                <div className="review-form">
                  <p style={{ textAlign: "center", color: "#666" }}>{t("product_details.checking_purchase")}</p>
                </div>
              ) : hasReviewed ? (
                <div className="review-window-note" role="status">{t("product_details.review_already_submitted", { defaultValue: "You have already left a review for this product." })}</div>
              ) : hasPurchased && reviewWindowOpen ? (
                <form
                  className="review-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!reviewWindowOpen || hasReviewed) {
                      return;
                    }
                    if (!newReview.comment.trim()) {
                      showAlert("Please write a review.", "Review details needed", "warning");
                      return;
                    }

                    const { data, error } = await supabase
                      .from("product_reviews")
                      .insert([
                        {
                          product_id: product.id,
                          user_id: user.id,
                          order_item_id: reviewOrderItemId,
                          rating: newReview.rating,
                          body: newReview.comment.trim(),
                          status: "pending",
                        },
                      ])
                      .select();

                    if (error) {
                      console.error("Error adding review:", error);
                      showAlert("The review could not be submitted. A review may already exist for this product.", "Review could not be added", "error");
                    } else if (data && data.length > 0) {
                      setHasReviewed(true);
                      setAllReviews((prev) => [data[0], ...prev]);
                      setReviews((prev) => {
                        const newReviews = [data[0], ...prev];
                        return showAllReviews ? newReviews : newReviews.slice(0, 5);
                      });
                      setNewReview({ rating: 5, comment: "" });
                      showAlert("Your review has been added.", "Review submitted");

                      const { data: reviewsData } = await supabase
                        .from("product_reviews")
                        .select("rating,status")
                        .eq("product_id", product.id);
                      const publicRatings = (reviewsData || []).filter((review) => review.status === "published").map((review) => Number(review.rating)).filter(Number.isFinite);
                      setRating(publicRatings.length ? publicRatings.reduce((sum, value) => sum + value, 0) / publicRatings.length : 0);
                    }
                  }}
                >
                  <h3>{t("product_details.write_review")}</h3>
                  <p className="review-window-countdown">{t("product_details.review_post_window", { seconds: reviewSecondsLeft, defaultValue: `You have ${reviewSecondsLeft} seconds to post one review for this delivered item. You can update or delete it for three minutes after posting.` })}</p>
                  <div className="rating-input">
                    <span>{t("product_details.rating_label")}: </span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star ${star <= newReview.rating ? "filled" : ""}`}
                        aria-label={t("product_details.rating_out_of_five", { rating: star })}
                        onClick={() =>
                          setNewReview({ ...newReview, rating: star })
                        }
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newReview.comment}
                    onChange={(e) =>
                      setNewReview({ ...newReview, comment: e.target.value })
                    }
                    placeholder={t("product_details.review_placeholder")}
                    required
                    className="rating-textarea"
                  />
                  <button className="review-btn" type="submit">{t("product_details.submit_review")}</button>
                </form>
              ) : hasPurchased ? (
                <div className="review-window-note" role="status">Your one-minute review window has ended.</div>
              ) : (
                <div className="review-window-note" role="status">Reviews are available after this product has been delivered to you.</div>
              )}
            </>
          )}
          {!user && <div className="review-window-note" role="status">Sign in to leave a review after your order is delivered.</div>}
        </div>
      </div>

      {/* Right side - Product Info */}
      <div className="premium-info">
        <p className="product-eyebrow">{t("product_details.eyebrow")}</p>
        <h1 className="p-title">{product.name}</h1>
        <p className="p-desc">{product.description}</p>

        <dl className="p-meta" aria-label={t("product_details.facts_label")}>
          <div className="p-meta-item">
            <dt><FontAwesomeIcon icon={faTruck} /> {t("product_details.shipped_from")}</dt>
            <dd>{product.shipped_from}</dd>
          </div>
          <div className="p-meta-item">
            <dt>{t("product_details.base_weight")}</dt>
            <dd>{product.weight && !isNaN(product.weight) ? parseFloat(product.weight).toFixed(2) : product.weight || "0.00"} kg</dd>
          </div>
          <div className="p-meta-item">
            <dt>{t("product_details.base_price")}</dt>
            <dd>{convert(product.price, currency)} {currency}</dd>
          </div>
          {product.category_id?.name && <div className="p-meta-item">
            <dt><FontAwesomeIcon icon={faTags} /> {t("product_details.category")}</dt>
            <dd>{product.category_id.name}</dd>
          </div>}
        </dl>
        {/* Dynamic Options */}
        {product.options &&
          Object.entries(product.options).map(([optionName, optionValues]) => (
            <div key={optionName}>
              <div className="p-options">
                <p>{t("product_details.choose_option", { option: optionName.charAt(0).toUpperCase() + optionName.slice(1) })}</p>
                {Object.entries(optionValues).map(([optionValue]) => (
                  <button
                    key={optionValue}
                    className={`color-btn ${selectedColor === optionValue ? "active" : ""}`}
                    onClick={() => handleColorChange(optionValue)}
                  >
                    {optionValue}
                  </button>
                ))}
              </div>

              {/* Size/Sub-options Selection with Quantities */}
              {selectedColor && optionValues[selectedColor] && (
                <div className="p-sizes">
                  <h3>{t("product_details.options")}</h3>
                  {(() => {
                    const selectedData = optionValues[selectedColor];
                    const basePrice = parseFloat(product.price || 0);
                    const baseWeight = parseFloat(product.weight || 0);
                    
                    // Extract extra price/weight from the selected option
                    const extraPrice = parseFloat(selectedData?.extraPrice || selectedData?.added_price || 0);
                    const extraWeight = parseFloat(selectedData?.extraWeight || selectedData?.extra_weight || 0);
                    
                    // Find sub-options array (could be 'sizes', 'colors', 'options', or any array)
                    let subOptionsArray = null;
                    let subOptionsKey = null;
                    
                    // Look for any array property in selectedData
                    for (const [key, value] of Object.entries(selectedData)) {
                      if (Array.isArray(value)) {
                        subOptionsArray = value;
                        subOptionsKey = key;
                        break;
                      }
                    }
                    
                    // If we found a sub-options array
                    if (subOptionsArray && subOptionsArray.length > 0) {
                      return subOptionsArray.map((item, idx) => {
                        // Handle both string items and object items
                        const itemName = typeof item === "string" ? item : Object.keys(item)[0];
                        const itemData = typeof item === "object" ? item[itemName]?.[0] : null;
                        
                        const itemPrice = itemData?.price ? parseFloat(itemData.price) : 0;
                        const itemWeight = itemData?.weight ? parseFloat(itemData.weight) : 0;
                        
                        const unitPrice = basePrice + extraPrice + itemPrice;
                        const unitWeight = baseWeight + extraWeight + itemWeight;
                        
                        const quantity = quantities[`${selectedColor}-${itemName}`] || 0;

                        return (
                          <div key={`${selectedColor}-${itemName}-${idx}`} className="size-item">
                            <div className="options">
                              <span className="size-name">{itemName}</span>
                              <span className="unit-price">
                                {t("product_details.price")}: {convert(unitPrice, currency)} {currency}
                              </span>
                              <span className="unit-weight">
                                {t("product_details.weight")}: {typeof unitWeight === 'number' ? unitWeight.toFixed(2) : unitWeight} kg
                              </span>
                            </div>
                            <div className="buttonsq">
                              <button aria-label={t("product_details.decrease_quantity")}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleQtyChange(itemName, -1);
                                }}
                              >
                                -
                              </button>
                              <span>{quantity}</span>
                              <button aria-label={t("product_details.increase_quantity")}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleQtyChange(itemName, 1);
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      });
                    }
                    
                    // If no sub-options array, treat the option itself as a single item
                    const quantity = quantities[`${selectedColor}-default`] || 0;
                    const unitPrice = basePrice + extraPrice;
                    const unitWeight = baseWeight + extraWeight;
                    
                    return (
                      <div className="size-item">
                        <div className="options">
                          <span className="size-name">{selectedColor}</span>
                            <span className="unit-price">
                            {t("product_details.price")}: {convert(unitPrice, currency)} {currency}
                          </span>
                            <span className="unit-weight">
                            {t("product_details.weight")}: {typeof unitWeight === 'number' ? unitWeight.toFixed(2) : unitWeight} kg
                          </span>
                        </div>
                        <div className="buttonsq">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleQtyChange('default', -1);
                            }}
                          >
                            -
                          </button>
                          <span>{quantity}</span>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleQtyChange('default', 1);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}

        {/* Shipping Method */}
        <div className="p-shipping">
          <div className="shipping-header">
            <p>{t("product_details.shipping_method")}</p>
            <select
              value={selectedShipping}
              onChange={(e) => setSelectedShipping(e.target.value)}
              className="shipping-select"
            >
            {Object.keys(shippingMethods).map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
          <p>{t("product_details.shipping_fee")}: {convert(shippingFee, currency)} {currency}</p>
          <p>{t("product_details.total_weight")}: {typeof totalWeight === 'number' ? totalWeight.toFixed(2) : totalWeight} kg</p>
        </div>

        {/* Total Price */}
        <div className="p-price">
          <h2>
            {t("product_details.grand_total")}: {convert(typeof (totalPrice + shippingFee) === 'number' ? (totalPrice + shippingFee).toFixed(0) : totalPrice + shippingFee, currency)}{" "}
            {currency}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="addtocartbtn" onClick={handleAddToCart}>
            {t("product_details.add_to_bag")}
          </button>
        </div>
      </div>

    </div>
  );
}
