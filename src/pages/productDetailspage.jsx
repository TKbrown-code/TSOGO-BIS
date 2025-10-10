import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useUserContext } from "../context/useUserContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";
import "../styles/productDetails.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faUser, faTruck, faTags, faXmark } from "@fortawesome/free-solid-svg-icons";

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
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [reviewUpdate, setReviewUpdates] = useState({});
  const [rating, setRating] = useState(0);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pid, setPid] = useState([]);

  // --- Load Product ---
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
        parsedOptions =
          typeof data.options === "string"
            ? JSON.parse(data.options)
            : data.options || {};
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

      // Default color & quantities
      const defaultColor = Object.keys(parsedOptions.color || {})[0] || "";
      setSelectedColor(defaultColor);

      const initQty = {};
      if (defaultColor && parsedOptions.color[defaultColor]?.sizes) {
        parsedOptions.color[defaultColor].sizes.forEach((sz) => {
          const name = typeof sz === "string" ? sz : Object.keys(sz)[0];
          initQty[name] = 0; // base quantity zero
        });
      }
      setQuantities(initQty);

      // Shipping methods
      const shippingData = typeof data.shipping_methods === "string"
        ? JSON.parse(data.shipping_methods)
        : data.shipping_methods || {};
      setShippingMethods(shippingData);
      setSelectedShipping(Object.keys(shippingData)[0] || "");
    }

    fetchProduct();
  }, [id]);

  // --- Fetch Reviews ---
  useEffect(() => {
    if (!id) return;

    async function fetchReviews() {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id, rating, comment, updated_at, username, user_id, created_at")
        .eq("product_id", id)
        .order("created_at", { ascending: false });

      if (!error && data) setReviews(data);
    }

    fetchReviews();
  }, [id]);

  // --- Calculate Totals ---
  useEffect(() => {
    if (!product || !selectedColor) return;

    const colorOpt = product.options.color[selectedColor];
    const colorExtra = parseFloat(colorOpt?.added_price || 0);
    const colorWeight = parseFloat(colorOpt?.extra_weight || 0);
    const basePrice = parseFloat(product.price || 0);
    const baseWeight = parseFloat(product.weight || 0);

    let totalP = 0;
    let totalW = 0;

    Object.entries(quantities).forEach(([sizeName, qty]) => {
      const sizeData = colorOpt.sizes.find((sz) =>
        typeof sz === "string" ? sz === sizeName : Object.keys(sz)[0] === sizeName
      );
      const sizePrice = typeof sizeData === "object" ? parseFloat(sizeData[sizeName][0]?.price || 0) : 0;
      const sizeWeight = typeof sizeData === "object" ? parseFloat(sizeData[sizeName][0]?.weight || 0) : 0;

      totalP += (sizePrice + colorExtra + basePrice) * qty;
      totalW += (baseWeight + sizeWeight + colorWeight) * qty;
    });

    setTotalPrice(totalP);
    setTotalWeight(totalW);

    const methodPrice = parseFloat(shippingMethods[selectedShipping] || 0);
    setShippingFee(methodPrice * totalW);
  }, [quantities, selectedColor, selectedShipping, product, shippingMethods]);

  const handleQtyChange = (size, delta) => {
    setQuantities((prev) => {
      const newQty = Math.max(0, (prev[size] || 0) + delta);
      return { ...prev, [size]: newQty };
    });
  };

  const handleAddToCart = async () => {
    if (!profile?.user_id) return alert("Please log in first.");

    const itemsToCart = Object.keys(quantities)
      .filter((size) => quantities[size] > 0)
      .map((sizeName) => {
        const colorOpt = product.options.color[selectedColor];
        return {
          user_id: profile.user_id,
          product_id: product.id,
          quantity: quantities[sizeName],
          selected_option: {
            color: selectedColor,
            size: sizeName,
            added_price: colorOpt.added_price,
          },
        };
      });

    for (let item of itemsToCart) {
      await supabase.from("cart").upsert(item);
    }
    addToCart(product);
    alert("✅ Product(s) added to cart!");
  };

  const handleCheckout = async (name, phone, address) => {
    try {
      const itemsToCheckout = Object.keys(quantities)
        .filter((size) => quantities[size] > 0)
        .map((sizeName) => {
          const colorOpt = product.options.color[selectedColor];
          const sizeData = colorOpt.sizes.find((sz) =>
            typeof sz === "string" ? sz === sizeName : Object.keys(sz)[0] === sizeName
          );
          const sizePrice = typeof sizeData === "object" ? parseFloat(sizeData[sizeName][0]?.price || 0) : 0;

          return {
            product_id: product.id,
            name: product.name,
            quantity: quantities[sizeName],
            size: sizeName,
            color: selectedColor,
            unitPrice: parseFloat(product.price) + colorOpt.added_price + sizePrice,
            totalPrice: (parseFloat(product.price) + colorOpt.added_price + sizePrice) * quantities[sizeName],
          };
        });

      const totalAmount = itemsToCheckout.reduce((sum, item) => sum + item.totalPrice, 0) + shippingFee;

      console.log("total: ", parseFloat(totalAmount));

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
            phone: phone.toString(),
            address,
            total: parseFloat(totalAmount),
            items: itemsToCheckout,
            shipping_method: selectedShipping,
            userId: profile?.user_id ?? "guest",
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
      console.error("Payment init error:", err);
      alert(err.message || "Failed to initialize payment");
    }
  };

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
      if (!res.ok || !data.success) throw new Error(data?.error || "Payment verification failed");

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

  if (!product) return <p>Loading product...</p>;

    const canEdit = (createdAt) => {
    const now = new Date();
    const reviewTime = new Date(createdAt);
    const diffMinutes = (now - reviewTime) / (1000 * 60);
    return diffMinutes < 5; // editable for 5 minutes
    };

    const renderStars = (rating) => {
    const fullStars = Math.floor(rating); // whole stars
    const halfStar = rating % 1 >= 0.5;  // check if there's a half star
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return (
      <>
        {"⭐".repeat(fullStars)}
        {halfStar && "✩"}
        {"☆".repeat(emptyStars)}
      </>
      );
    };

    
  return (
    <div className="premium-details-container">
      {/* --- Images / Carousel --- */}
      <div className="right">
      <div className="premium-gallery">
        <div className="image-view">
          <img src={images[currentImage]} alt={product.name} className="zoomable-img" />
        </div>
        <div className="thumb-list">
          {images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              className={`thumb ${idx === currentImage ? "active-thumb" : ""}`}
              onClick={() => setCurrentImage(idx)}
            />
          ))}
        </div>
      </div>
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
        {profile && reviews.length ? reviews.map((r) => (
  <div className="review-container" key={r.id}>
    <div className="review">
      <div className="review-header">
        <FontAwesomeIcon icon={faUser} className="user_icon"/> 
        <div className="review-comment">
          <strong>{r.username}</strong>
          <p>{r.comment}</p>
          <small>{new Date(r.created_at).toLocaleDateString()}</small>
        </div>
      </div>

      <div className="review-stars">
        <span className="stars">⭐ {r.rating}+</span>
        {profile?.user_id === r.user_id && canEdit(r.created_at) && (
          <button
            className="editbtn"
            style={{ cursor: 'pointer', marginLeft: '10px' }}
            onClick={() => {if(!editingReviewId) setEditingReviewId(r.id); else setEditingReviewId(null)}}
          >
            edit
          </button>
        )}
      </div>
    </div>

    {editingReviewId === r.id && (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const updateText = reviewUpdate[r.id];
          if(!updateText?.trim()) {
            alert("Enter the updated review before submitting!");
            return;
          }

          const { data, error } = await supabase
            .from("product_reviews")
            .update({ comment: updateText })
            .eq("id", r.id)
            .eq("user_id", profile.user_id);

          if(error) console.log("Error updating review:", error);
          else {
            console.log("Updated review:", data);
            // update local reviews array to reflect changes immediately
            setReviews(prev => prev.map(rv => rv.id === r.id ? {...rv, comment: updateText} : rv));
            setEditingReviewId(null);
          }
        }}
      >
        <button onClick={(e) => {e.preventDefault(); setEditingReviewId(null)}}>Close</button>
        <input
          type="text"
          value={reviewUpdate[r.id] || ""}
          onChange={(e) =>
            setReviewUpdates(prev => ({ ...prev, [r.id]: e.target.value }))
          }
          placeholder="Enter update..."
        />
        <button type="submit">Submit</button>
      </form>
    )}
  </div>
)) : <p>No reviews yet.</p>}

        <form
          className="review-form"
        onSubmit={async (e) => {
  e.preventDefault();

  // Ensure user is logged in
  if (!profile?.user_id) {
    alert("Login to review");
    return;
  }

  // Ensure comment is not empty
  if (!newReview.comment.trim()) {
    alert("Please write a comment before submitting.");
    return;
  }

  // Build the review payload
  const payload = {
    product_id: Number(id),          // Product ID
    user_id: profile.user_id,        // User UUID
    username: profile.full_name || "Anonymous",
    rating: Number(newReview.rating),
    comment: newReview.comment.trim(),
  };

  console.log("Review payload:", payload);

  // Insert the new review
  const { data: insertedReview, error: insertError } = await supabase
    .from("product_reviews")
    .insert([payload])
    .select("id, product_id, user_id, username, rating, comment");

  if (insertError) {
    console.error("Review insert error:", insertError);
    alert("Something went wrong while posting your review.");
    return;
  }

  // Update local reviews state
  if (insertedReview?.length) {
    setReviews(prev => [insertedReview[0], ...prev]);
  }

  // Reset the review form
  setNewReview({ rating: 5, comment: "" });
  alert("Review added successfully!");

  // Fetch all reviews for this product to compute average
  const { data: allReviews, error: fetchError } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", id);

  if (fetchError) {
    console.error("Error fetching reviews for avg calculation:", fetchError);
    return;
  }

  // Compute average rating
  const avgRating = allReviews.length
    ? Math.round(
        (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10
      ) / 10
    : 0;

    

  console.log("New average rating:", avgRating);

  // Update the product's avg_rating
  const { data: productData, error: updateError } = await supabase
    .from("products")
    .update({ avg_rating: avgRating })
    .eq("id", id);

  if (updateError) {
    console.error("Error updating product avg_rating:", updateError);
  }
 
}}

 >
          <h3>Leave a Review</h3>
          <label>
            Rating:
            <select
              value={newReview.rating}
              onChange={(e) => setNewReview({ ...newReview, rating: Number(e.target.value) })}
            >
              {[5,4,3,2,1].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <textarea
            value={newReview.comment}
            onChange={e => setNewReview({...newReview, comment: e.target.value})}
            placeholder="Write your review..."
          />
          <button type="submit">Submit Review</button>
        </form>
      </div>
      </div>

      {/* --- Product Info --- */}
      <div className="premium-info">
        <h1 className="p-title">{product.name}</h1>
        <p className="p-desc">{product.description}</p>

        <div className="p-meta">
          <p>
            <FontAwesomeIcon icon={faTruck} /> Shipped from: <strong>{product.shipped_from}</strong>
          </p>
          <p>Base Weight: {product.weight && product.weight.toFixed(2)} kg</p>
          <p>Base Price: {convert(product.price, currency)} {currency}</p>
          {product.category_id?.name && (
            <p>
              <FontAwesomeIcon icon={faTags} /> Category: {product.category_id.name}
            </p>
          )}
        </div>

        {/* --- Color Selection --- */}
         <div className="p-options">
            <p>Color:</p>
            {Object.keys(product.options.color || {}).map((color) => (
              <button
                key={color}
                className={`color-btn ${selectedColor === color ? "active" : ""}`}
                onClick={() => setSelectedColor(color)}
              >
                {color}
              </button>
            ))}
          </div>

        {/* --- Sizes with dynamic price --- */}
        <div className="p-sizes">
          <h3>Options</h3>
     {selectedColor &&
  product.options.color[selectedColor].sizes.map((sz, idx) => {
    const sizeName = typeof sz === "string" ? sz : Object.keys(sz)[0];

    const colorOpt = product.options.color[selectedColor];
    const sizeData = typeof sz === "object" ? sz[sizeName][0] : {};
    const sizePrice = sizeData?.price || 0;
    const sizeWeight = parseFloat(sizeData?.weight || 0);

    const basePrice = parseFloat(product.price || 0);
    const unitPrice = basePrice + (colorOpt.added_price || 0) + sizePrice;
    const unitWeight = parseFloat(product.weight || 0) + (parseFloat(colorOpt.extra_weight) || 0) + sizeWeight;

    return (
      <div key={idx} className="size-item">
        <div className="options">
            <span className="size-name">{sizeName}</span>
            <span className="unit-price">Price: {convert(unitPrice, currency)} {currency}</span>
            <span className="unit-weight">Weight: {unitWeight.toFixed(2)} kg</span>
        </div>
        <div className="buttonsq">
          <button onClick={() => handleQtyChange(sizeName, -1)}>-</button>
          <span>{quantities[sizeName]}</span>
          <button onClick={() => handleQtyChange(sizeName, 1)}>+</button>
        </div>
      </div>
    );
})}
        </div>

        {/* --- Shipping Method --- */}
        <div className="p-shipping">
          <div className="shipping-header">
            <p>Shipping Method:</p>
          <select
            value={selectedShipping}
            onChange={(e) => setSelectedShipping(e.target.value)}
            className="shipping-select"
          >
          <option value="">Select Shipping Method</option>
      {Object.entries(shippingMethods).map(([method, price]) => (
      <option key={method} value={method}>
        {method} (+{convert(price, currency)} per kg)
      </option>
    ))}
  </select>
  </div>
  <p>
    Shipping Fee: {convert(shippingFee, currency)} {currency}
  </p>
</div>

        {/* --- Total Price including shipping --- */}
        <div className="p-price">
          <h2>
            Grand Total: {convert(totalPrice + shippingFee, currency)} {currency}
          </h2>
        </div>

        {/* --- Action Buttons --- */}
        <div className="action-buttons">
          <button className="addtocartbtn" onClick={handleAddToCart}>
            Add to Cart
          </button>
          <button className="buy-btn" onClick={() => setPaymentModalOpen(true)}>
            Buy Now
          </button>
        </div>
      </div>

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
        {profile && reviews.length ? reviews.map((r) => (
  <div className="review-container" key={r.id}>
    <div className="review">
      <div className="review-header">
        <FontAwesomeIcon icon={faUser} className="user_icon"/> 
        <div className="review-comment">
          <strong>{r.username}</strong>
          <p>{r.comment}</p>
          <small>{new Date(r.created_at).toLocaleDateString()}</small>
        </div>
      </div>

      <div className="review-stars">
        <span className="stars">⭐ {r.rating}+</span>
        {profile?.user_id === r.user_id && canEdit(r.created_at) && (
          <button
            className="editbtn"
            style={{ cursor: 'pointer', marginLeft: '10px' }}
            onClick={() => {if(!editingReviewId) setEditingReviewId(r.id); else setEditingReviewId(null)}}
          >
            edit
          </button>
        )}
      </div>
    </div>

    {editingReviewId === r.id && (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const updateText = reviewUpdate[r.id];
          if(!updateText?.trim()) {
            alert("Enter the updated review before submitting!");
            return;
          }

          const { data, error } = await supabase
            .from("product_reviews")
            .update({ comment: updateText })
            .eq("id", r.id)
            .eq("user_id", profile.user_id);

          if(error) console.log("Error updating review:", error);
          else {
            console.log("Updated review:", data);
            // update local reviews array to reflect changes immediately
            setReviews(prev => prev.map(rv => rv.id === r.id ? {...rv, comment: updateText} : rv));
            setEditingReviewId(null);
          }
        }}
      >
        <button onClick={(e) => {e.preventDefault(); setEditingReviewId(null)}}>Close</button>
        <input
          type="text"
          value={reviewUpdate[r.id] || ""}
          onChange={(e) =>
            setReviewUpdates(prev => ({ ...prev, [r.id]: e.target.value }))
          }
          placeholder="Enter update..."
        />
        <button type="submit">Submit</button>
      </form>
    )}
  </div>
)) : <p>No reviews yet.</p>}

        <form
          className="review-form"
        onSubmit={async (e) => {
  e.preventDefault();

  // Ensure user is logged in
  if (!profile?.user_id) {
    alert("Login to review");
    return;
  }

  // Ensure comment is not empty
  if (!newReview.comment.trim()) {
    alert("Please write a comment before submitting.");
    return;
  }

  // Build the review payload
  const payload = {
    product_id: Number(id),          // Product ID
    user_id: profile.user_id,        // User UUID
    username: profile.full_name || "Anonymous",
    rating: Number(newReview.rating),
    comment: newReview.comment.trim(),
  };

  console.log("Review payload:", payload);

  // Insert the new review
  const { data: insertedReview, error: insertError } = await supabase
    .from("product_reviews")
    .insert([payload])
    .select("id, product_id, user_id, username, rating, comment");

  if (insertError) {
    console.error("Review insert error:", insertError);
    alert("Something went wrong while posting your review.");
    return;
  }

  // Update local reviews state
  if (insertedReview?.length) {
    setReviews(prev => [insertedReview[0], ...prev]);
  }

  // Reset the review form
  setNewReview({ rating: 5, comment: "" });
  alert("Review added successfully!");

  // Fetch all reviews for this product to compute average
  const { data: allReviews, error: fetchError } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", id);

  if (fetchError) {
    console.error("Error fetching reviews for avg calculation:", fetchError);
    return;
  }

  // Compute average rating
  const avgRating = allReviews.length
    ? Math.round(
        (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10
      ) / 10
    : 0;

    

  console.log("New average rating:", avgRating);

  // Update the product's avg_rating
  const { data: productData, error: updateError } = await supabase
    .from("products")
    .update({ avg_rating: avgRating })
    .eq("id", id);

  if (updateError) {
    console.error("Error updating product avg_rating:", updateError);
  }
 
}}

 >
          <h3>Leave a Review</h3>
          <label>
            Rating:
            <select
              value={newReview.rating}
              onChange={(e) => setNewReview({ ...newReview, rating: Number(e.target.value) })}
            >
              {[5,4,3,2,1].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <textarea
            value={newReview.comment}
            onChange={e => setNewReview({...newReview, comment: e.target.value})}
            placeholder="Write your review..."
          />
          <button type="submit">Submit Review</button>
        </form>
      </div>      

      {/* --- Payment Modal --- */}
      {paymentModalOpen && (
        <div className="payment-modal">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setPaymentModalOpen(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            {!paymentData ? (
              <CheckoutForm onSubmit={handleCheckout} loading={loading} />
            ) : (
              <div className="verify-payment">
                <p>Payment in process...</p>
                <button onClick={verifyPayment} disabled={loading}>
                  {loading ? "Verifying..." : "Verify Payment"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Checkout Form Component ---
function CheckoutForm({ onSubmit, loading }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  return (
    <form className="checkout-form" onSubmit={(e) => { e.preventDefault(); onSubmit(name, phone, address); }}>
      <h3>Checkout Details</h3>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" required />
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" required />
      <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Shipping Address" required />
      <button type="submit" disabled={loading}>{loading ? "Processing..." : "Proceed to Pay"}</button>
    </form>
  );
}
