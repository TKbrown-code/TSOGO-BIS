import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useUserContext } from "../context/useUserContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";
import "../styles/productDetails.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faUser, faTruck, faTags, faXmark } from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";
import { verifyCampayPayment } from "../utils/fapshi";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;
const X_WEBHOOK_SECRET = import.meta.env.VITE_X_WEBHOOK_SECRET;

export default function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, clearCart } = useCart();
  const { profile } = useUserContext();
  const { currency, convert } = useCurrencyContext();

  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
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
  const [rating, setRating] = useState(0);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(true);

  // Load product data
  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*), category_id(name)")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching product:", error);
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

      const imgs = data.product_images || [];
      await preloadAllImages(imgs);
      const urls = imgs.map((img) => getCachedImage(img.image_path));

      setProduct({
        ...data,
        options: parsedOptions,
        shipped_from: data.shipped_from || "Unknown",
      });
      setImages(urls);

      // Set default selection - get first option type and first option value
      const firstOptionType = Object.keys(parsedOptions)[0];
      const firstOptionValue = firstOptionType ? Object.keys(parsedOptions[firstOptionType])[0] : "";
      setSelectedColor(firstOptionValue);

      // Initialize quantities (empty - will be populated as user selects)
      setQuantities({});

      // Set shipping methods
      const shippingData = typeof data.shipping_methods === "string" ? 
        JSON.parse(data.shipping_methods) : 
        (data.shipping_methods || {});
      setShippingMethods(shippingData);
      setSelectedShipping(Object.keys(shippingData)[0] || "");
    }

    fetchProduct();
  }, [id]);

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
      }
    }

    fetchReviews();
  }, [id]);

  // Check if user has purchased this product
  useEffect(() => {
    if (!id || !profile?.user_id) {
      setCheckingPurchase(false);
      setHasPurchased(false);
      return;
    }

    async function checkPurchaseHistory() {
      setCheckingPurchase(true);
      try {
        // Fetch user's checkouts
        const { data: checkouts, error } = await supabase
          .from("checkouts")
          .select("items")
          .eq("user_id", profile.user_id)
          .eq("status", "paid");

        if (error) {
          console.error("Error checking purchase history:", error);
          setHasPurchased(false);
          return;
        }

        // Check if any checkout contains this product
        const purchased = checkouts?.some(checkout => {
          const items = typeof checkout.items === "string" 
            ? JSON.parse(checkout.items) 
            : checkout.items;
          return items?.some(item => item.product_id === id);
        });

        setHasPurchased(purchased || false);
      } catch (err) {
        console.error("Error checking purchase:", err);
        setHasPurchased(false);
      } finally {
        setCheckingPurchase(false);
      }
    }

    checkPurchaseHistory();
  }, [id, profile?.user_id]);

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
    if (!profile?.user_id) return alert("Please log in first.");

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
      return alert("Please select at least one option and quantity");
    }

    console.log('Adding items to cart:', cartItems.length, 'items');

    // Add all items to cart
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
      }
    }
    
    alert(`✅ ${cartItems.length} product(s) added to cart!`);
    // Cart will not open automatically
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
        "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/create-campay-order",
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
      alert(err.message || "Failed to process checkout");
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
            alert("✅ Payment confirmed!");
            clearCart();
            navigate("/orders");
          } else if (updatedCheckout.status === "failed") {
            alert("❌ Payment failed. Please try again.");
          }
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /*
  // Verify payment
  const verifyPayment = async () => {
    if (!paymentData?.checkoutId) return;
    setLoading(true);
    
    try {
      const res = await fetch(
        "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/verify-campay-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "x-webhook-secret": X_WEBHOOK_SECRET,
          },
          body: JSON.stringify({
            reference: paymentData.reference,
            checkout_id: paymentData.checkoutId,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Payment verification failed");
      }

      alert(`Payment ${data.status.toUpperCase()}`);
      clearCart();
      navigate("/orders");
    } catch (err) {
      console.error("Payment verification error:", err);
      alert(err.message || "Failed to verify payment");
    } finally {
      setLoading(false);
      setPaymentModalOpen(false);
    }
  };
*/  /*
  // Verify payment
  const verifyPayment = async () => {
    if (!paymentData?.checkoutId) return;
    setLoading(true);
    
    try {
      const res = await fetch(
        "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/verify-campay-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "x-webhook-secret": X_WEBHOOK_SECRET,
          },
          body: JSON.stringify({
            reference: paymentData.reference,
            checkout_id: paymentData.checkoutId,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Payment verification failed");
      }

      alert(`Payment ${data.status.toUpperCase()}`);
      clearCart();
      navigate("/orders");
    } catch (err) {
      console.error("Payment verification error:", err);
      alert(err.message || "Failed to verify payment");
    } finally {
      setLoading(false);
      setPaymentModalOpen(false);
    }
  };
*/
  if (!product) {
    return <p>Loading product...</p>;
  }

  // Helper functions for reviews
  const canEdit = (createdAt) => {
    const now = new Date();
    const reviewTime = new Date(createdAt);
    const diffMinutes = (now - reviewTime) / (1000 * 60);
    return diffMinutes < 5; // editable for 5 minutes
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    return (
      <>
        {"⭐".repeat(fullStars)}
        {halfStar && "✩"}
        {"☆".repeat(emptyStars)}
      </>
    );
  };

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
                src={images[currentImage]} 
                alt={product.name} 
                className="zoomable-img" 
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
          
          {/* Dots Indicator */}
          <div className="carousel-dots">
            {images.map((_, idx) => (
              <button
                key={idx}
                className={`dot ${idx === currentImage ? "active" : ""}`}
                onClick={() => setCurrentImage(idx)}
              />
            ))}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="premium-reviews">
          <h2>Customer Reviews</h2>
          {rating ? (
            <div className="average-rating">
              <span>{renderStars(rating)}</span>
              <span className="rating-number">({rating && rating.toFixed(1)})</span>
            </div>
          ) : (
            <p>No ratings yet</p>
          )}

          {/* Existing reviews */}
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <div key={review.id} className="review-container">
                <div className="review">
                  <div className="review-header">
                    <FontAwesomeIcon icon={faUser} className="user_icon" />
                    <div className="review-comment">
                      <strong>{review.username}</strong>
                      <p>{review.comment}</p>
                      <small>{new Date(review.created_at).toLocaleDateString()}</small>
                    </div>
                  </div>
                  <div className="review-stars">
                    <span className="stars">⭐ {review.rating}</span>
                    {profile?.user_id === review.user_id && canEdit(review.created_at) && (
                      <button
                        className="editbtn"
                        onClick={() => {
                          if (editingReviewId !== review.id) {
                            setEditingReviewId(review.id);
                            setReviewUpdates(prev => ({
                              ...prev,
                              [review.id]: review.comment
                            }));
                          } else {
                            setEditingReviewId(null);
                          }
                        }}
                      >
                        {editingReviewId === review.id ? "Cancel" : "Edit"}
                      </button>
                    )}
                  </div>
                </div>

                {editingReviewId === review.id && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const updateText = reviewUpdate[review.id]?.trim();
                      if (!updateText) {
                        alert("Please enter a valid review");
                        return;
                      }

                      const { data, error } = await supabase
                        .from("product_reviews")
                        .update({ 
                          comment: updateText,
                          updated_at: new Date().toISOString()
                        })
                        .eq("id", review.id)
                        .select();

                      if (error) {
                        console.error("Error updating review:", error);
                        alert("Failed to update review");
                      } else if (data && data.length > 0) {
                        setReviews(prev =>
                          prev.map((r) =>
                            r.id === review.id ? { ...r, ...data[0] } : r
                          )
                        );
                        setEditingReviewId(null);
                        alert("Review updated successfully!");
                      }
                    }}
                  >
                    <textarea
                      value={reviewUpdate[review.id] || ""}
                      onChange={(e) =>
                        setReviewUpdates(prev => ({
                          ...prev,
                          [review.id]: e.target.value
                        }))
                      }
                      placeholder="Edit your review..."
                      required
                    />
                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => setEditingReviewId(null)}
                      >
                        Cancel
                      </button>
                      <button type="submit">Update</button>
                    </div>
                  </form>
                )}
              </div>
            ))
          ) : (
            <p>No reviews yet.</p>
          )}

          {/* View More/Less Toggle */}
          {allReviews.length > 5 && (
            <button 
              className="view-toggle-btn"
              onClick={toggleReviews}
            >
              {showAllReviews ? `View Less (Show 5)` : `View All ${allReviews.length} Reviews`}
            </button>
          )}

          {/* Add Review Form */}
          {profile && (
            <>
              {checkingPurchase ? (
                <div className="review-form">
                  <p style={{ textAlign: "center", color: "#666" }}>Checking purchase history...</p>
                </div>
              ) : hasPurchased ? (
                <form
                  className="review-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newReview.comment.trim()) {
                      alert("Please write a review");
                      return;
                    }

                    const { data, error } = await supabase
                      .from("product_reviews")
                      .insert([
                        {
                          product_id: product.id,
                          user_id: profile.user_id,
                          username: profile.full_name || "Anonymous",
                          rating: newReview.rating,
                          comment: newReview.comment.trim(),
                        },
                      ])
                      .select();

                    if (error) {
                      console.error("Error adding review:", error);
                      alert("Failed to add review");
                    } else if (data && data.length > 0) {
                      setAllReviews((prev) => [data[0], ...prev]);
                      setReviews((prev) => {
                        const newReviews = [data[0], ...prev];
                        return showAllReviews ? newReviews : newReviews.slice(0, 5);
                      });
                      setNewReview({ rating: 5, comment: "" });
                      alert("Review added successfully!");

                      // Update product rating
                      const { data: reviewsData } = await supabase
                        .from("product_reviews")
                        .select("rating")
                        .eq("product_id", product.id);

                      if (reviewsData && reviewsData.length > 0) {
                        const avgRating =
                          reviewsData.reduce((sum, r) => sum + r.rating, 0) /
                          reviewsData.length;
                        await supabase
                          .from("products")
                          .update({ avg_rating: parseFloat(avgRating.toFixed(2)) })
                          .eq("id", product.id);
                        setRating(parseFloat(avgRating.toFixed(2)));
                      }
                    }
                  }}
                >
                  <h3>Write a Review</h3>
                  <div className="rating-input">
                    <span>Rating: </span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`star ${star <= newReview.rating ? "filled" : ""}`}
                        onClick={() =>
                          setNewReview({ ...newReview, rating: star })
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <textarea
                    value={newReview.comment}
                    onChange={(e) =>
                      setNewReview({ ...newReview, comment: e.target.value })
                    }
                    placeholder="Share your thoughts about this product..."
                    required
                    className="rating-textarea"
                  />
                  <button className="review-btn" type="submit">Submit Review</button>
                </form>
              ) : (
                <div className="review-form" style={{ 
                  background: "#fff3cd", 
                  border: "1px solid #ffc107", 
                  borderRadius: "8px",
                  padding: "20px",
                  textAlign: "center"
                }}>
                  <h3 style={{ color: "#856404", marginBottom: "10px" }}>Purchase Required</h3>
                  <p style={{ color: "#856404", margin: 0 }}>
                    You need to purchase this product before you can leave a review.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right side - Product Info */}
      <div className="premium-info">
        <h1 className="p-title">{product.name}</h1>
        <p className="p-desc">{product.description}</p>

        <div className="p-meta">
          <p>
            <FontAwesomeIcon icon={faTruck} /> Shipped from:{" "}
            <strong>{product.shipped_from}</strong>
          </p>
          <p>Base Weight: {product.weight && product.weight.toFixed(2)} kg</p>
          <p>Base Price: {convert(product.price, currency)} {currency}</p>
          {product.category_id?.name && (
            <p>
              <FontAwesomeIcon icon={faTags} /> Category:{" "}
              {product.category_id.name}
            </p>
          )}
        </div>

        {/* Dynamic Options */}
        {product.options &&
          Object.entries(product.options).map(([optionName, optionValues]) => (
            <div key={optionName}>
              <div className="p-options">
                <p>{optionName.charAt(0).toUpperCase() + optionName.slice(1)}:</p>
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
                  <h3>Options</h3>
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
                                Price: {convert(unitPrice, currency)} {currency}
                              </span>
                              <span className="unit-weight">
                                Weight: {unitWeight.toFixed(2)} kg
                              </span>
                            </div>
                            <div className="buttonsq">
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleQtyChange(itemName, -1);
                                }}
                              >
                                -
                              </button>
                              <span>{quantity}</span>
                              <button 
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
                            Price: {convert(unitPrice, currency)} {currency}
                          </span>
                          <span className="unit-weight">
                            Weight: {unitWeight.toFixed(2)} kg
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
            <p>Shipping Method:</p>
            <select
              value={selectedShipping}
              onChange={(e) => setSelectedShipping(e.target.value)}
              className="shipping-select"
            >
              {Object.entries(shippingMethods).map(([method, price]) => (
                <option key={method} value={method}>
                  {method} ({convert(price, currency)} per kg)
                </option>
              ))}
            </select>
          </div>
          <p>Shipping Fee: {convert(shippingFee, currency)} {currency}</p>
          <p>Total Weight: {totalWeight.toFixed(2)} kg</p>
        </div>

        {/* Total Price */}
        <div className="p-price">
          <h2>
            Grand Total: {convert((totalPrice + shippingFee).toFixed(0), currency)}{" "}
            {currency}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="addtocartbtn" onClick={handleAddToCart}>
            Add to Cart
          </button>
          <button
            className="buy-btn"
            onClick={() => setPaymentModalOpen(true)}
            disabled={Object.values(quantities).every(qty => qty === 0)}
          >
            Buy Now
          </button>
        </div>
      </div>

      {/* Mobile Reviews Section */}
      <div className="premium-reviews-mobile">
        <h2>Customer Reviews</h2>
        {rating ? (
          <div className="average-rating">
            <span>{renderStars(rating)}</span>
            <span className="rating-number">({rating && rating.toFixed(1)})</span>
          </div>
        ) : (
          <p>No ratings yet</p>
        )}

        {/* Existing reviews */}
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <div key={review.id} className="review-container">
              <div className="review">
                <div className="review-header">
                  <FontAwesomeIcon icon={faUser} className="user_icon" />
                  <div className="review-comment">
                    <strong>{review.username}</strong>
                    <p>{review.comment}</p>
                    <small>{new Date(review.created_at).toLocaleDateString()}</small>
                  </div>
                </div>
                <div className="review-stars">
                  <span className="stars">⭐ {review.rating}</span>
                  {profile?.user_id === review.user_id && canEdit(review.created_at) && (
                    <button
                      className="editbtn"
                      onClick={() => {
                        if (editingReviewId !== review.id) {
                          setEditingReviewId(review.id);
                          setReviewUpdates(prev => ({
                            ...prev,
                            [review.id]: review.comment
                          }));
                        } else {
                          setEditingReviewId(null);
                        }
                      }}
                    >
                      {editingReviewId === review.id ? "Cancel" : "Edit"}
                    </button>
                  )}
                </div>
              </div>

              {editingReviewId === review.id && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const updateText = reviewUpdate[review.id]?.trim();
                    if (!updateText) {
                      alert("Please enter a valid review");
                      return;
                    }

                    const { data, error } = await supabase
                      .from("product_reviews")
                      .update({ 
                        comment: updateText,
                        updated_at: new Date().toISOString()
                      })
                      .eq("id", review.id)
                      .select();

                    if (error) {
                      console.error("Error updating review:", error);
                      alert("Failed to update review");
                    } else if (data && data.length > 0) {
                      setReviews(prev =>
                        prev.map((r) =>
                          r.id === review.id ? { ...r, ...data[0] } : r
                        )
                      );
                      setEditingReviewId(null);
                      alert("Review updated successfully!");
                    }
                  }}
                >
                  <textarea
                    value={reviewUpdate[review.id] || ""}
                    onChange={(e) =>
                      setReviewUpdates(prev => ({
                        ...prev,
                        [review.id]: e.target.value
                      }))
                    }
                    placeholder="Edit your review..."
                    required
                  />
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setEditingReviewId(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit">Update</button>
                  </div>
                </form>
              )}
            </div>
          ))
        ) : (
          <p>No reviews yet.</p>
        )}

        {/* View More/Less Toggle */}
        {allReviews.length > 5 && (
          <button 
            className="view-toggle-btn"
            onClick={toggleReviews}
          >
            {showAllReviews ? `View Less (Show 5)` : `View All ${allReviews.length} Reviews`}
          </button>
        )}

        {/* Add Review Form */}
        {profile && (
          <form
            className="review-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newReview.comment.trim()) {
                alert("Please write a review");
                return;
              }

              const { data, error } = await supabase
                .from("product_reviews")
                .insert([
                  {
                    product_id: product.id,
                    user_id: profile.user_id,
                    username: profile.full_name || "Anonymous",
                    rating: newReview.rating,
                    comment: newReview.comment.trim(),
                  },
                ])
                .select();

              if (error) {
                console.error("Error adding review:", error);
                alert("Failed to add review");
              } else if (data && data.length > 0) {
                setAllReviews((prev) => [data[0], ...prev]);
                setReviews((prev) => {
                  const newReviews = [data[0], ...prev];
                  return showAllReviews ? newReviews : newReviews.slice(0, 5);
                });
                setNewReview({ rating: 5, comment: "" });
                alert("Review added successfully!");

                // Update product rating
                const { data: reviewsData } = await supabase
                  .from("product_reviews")
                  .select("rating")
                  .eq("product_id", product.id);

                if (reviewsData && reviewsData.length > 0) {
                  const avgRating =
                    reviewsData.reduce((sum, r) => sum + r.rating, 0) /
                    reviewsData.length;
                  await supabase
                    .from("products")
                    .update({ avg_rating: parseFloat(avgRating.toFixed(2)) })
                    .eq("id", product.id);
                  setRating(parseFloat(avgRating.toFixed(2)));
                }
              }
            }}
          >
            <h3>Write a Review</h3>
            <div className="rating-input">
              <span>Rating: </span>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${star <= newReview.rating ? "filled" : ""}`}
                  onClick={() =>
                    setNewReview({ ...newReview, rating: star })
                  }
                >
                  ★
                </span>
              ))}
            </div>
            <textarea
              value={newReview.comment}
              onChange={(e) =>
                setNewReview({ ...newReview, comment: e.target.value })
              }
              placeholder="Share your thoughts about this product..."
              required
            />
            <button type="submit">Submit Review</button>
          </form>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="payment-modal">
          <div className="modal-content">
            <button
              className="close-btn"
              onClick={() => setPaymentModalOpen(false)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            
            {!paymentData ? (
              <div className="checkout-form">
                <h3>Checkout Details</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    handleCheckout(
                      form.name.value,
                      form.phone.value,
                      form.address.value
                    );
                  }}
                >
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    required
                    defaultValue={profile?.full_name || ""}
                  />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    required
                    title="Please enter a valid phone number"
                  />
                  <textarea
                    name="address"
                    placeholder="Shipping Address"
                    required
                    rows="3"
                  ></textarea>
                  
                  <div className="order-summary">
                    <h4>Order Summary</h4>
                    {Object.entries(product.options || {}).map(([optionType, optionValues]) => 
                      Object.entries(optionValues).map(([optionValue, optionData]) => {
                        const basePrice = parseFloat(product.price || 0);
                        const extraPrice = parseFloat(optionData?.extraPrice || optionData?.added_price || 0);
                        
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
                          return subOptionsArray.map((item) => {
                            const itemName = typeof item === "string" ? item : Object.keys(item)[0];
                            const itemData = typeof item === "object" ? item[itemName]?.[0] : null;
                            const qty = quantities[`${optionValue}-${itemName}`] || 0;
                            
                            if (qty === 0) return null;
                            
                            const itemPrice = itemData?.price ? parseFloat(itemData.price) : 0;
                            const unitPrice = basePrice + extraPrice + itemPrice;
                            
                            return (
                              <div key={`${optionValue}-${itemName}`} className="order-item">
                                <span>{product.name} - {optionValue} - {itemName} (x{qty})</span>
                                <span>{convert(unitPrice * qty, currency)} {currency}</span>
                              </div>
                            );
                          });
                        } else {
                          // No sub-options, treat as single item
                          const qty = quantities[`${optionValue}-default`] || 0;
                          
                          if (qty === 0) return null;
                          
                          const unitPrice = basePrice + extraPrice;
                          
                          return (
                            <div key={`${optionValue}-default`} className="order-item">
                              <span>{product.name} - {optionValue} (x{qty})</span>
                              <span>{convert(unitPrice * qty, currency)} {currency}</span>
                            </div>
                          );
                        }
                      })
                    )}
                    
                    <div className="order-total">
                      <span>Shipping:</span>
                      <span>{convert(shippingFee, currency)} {currency}</span>
                    </div>
                    <div className="order-total">
                      <strong>Total:</strong>
                      <strong>{convert(totalPrice + shippingFee, currency)} {currency}</strong>
                    </div>
                  </div>
                  
                  <button type="submit" disabled={loading}>
                    {loading ? "Processing..." : "Proceed to Payment"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="verify-payment">
                <h3>Complete Your Payment</h3>
                <p>Please complete your payment using the following details:</p>
                <div className="payment-details">
                  <p><strong>Reference:</strong> {paymentData.reference}</p>
                  <p><strong>Amount:</strong> {convert(totalPrice + shippingFee, currency)} {currency}</p>
                </div>
                <button
                  onClick={() => window.open(paymentData.url, "_blank")}
                  className="pay-now-btn"
                >
                  Pay Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}