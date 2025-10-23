import { useUserContext } from "../context/useUserContext";
import { SignOut } from "../hooks/useUserInfo";
import { useNavigate, Link, Navigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { user, profile, loading } = useUserContext();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [checkouts, setCheckouts] = useState([]);

  // Fetch cart and checkout data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch cart items
      const { data: cartData, error: cartError } = await supabase
        .from("cart")
        .select("product_id")
        .eq("id", user.id);

      if (cartError) console.error("Cart fetch error:", cartError);
      else if (cartData.length) {
        const productIds = cartData.map((item) => item.product_id);
        const { data: products, error: prodError } = await supabase
          .from("products")
          .select("*")
          .in("id", productIds);

        if (prodError) console.error("Products fetch error:", prodError);
        else setCartItems(products || []);
      } else setCartItems([]);

      // Fetch checkouts with items
      const { data: checkoutData, error: checkoutError } = await supabase
        .from("checkouts")
        .select("*, checkout_items(*)")
        .eq("visitor_id", user.id);

      if (checkoutError) console.error("Checkouts fetch error:", checkoutError);
      else setCheckouts(checkoutData || []);
    };

    fetchData();
  }, [user]);

  if (loading) return <p className="loading"></p>;

  if (!user) {
    navigate("/");
    return null;
  }

  if (!profile) {
    return (
      <div className="dashboard-container">
        <h2 className="heading">Profile not found</h2>
        <p>We couldn’t load your profile. Try again later.</p>
        <button className="logout-btn" onClick={SignOut}>
          Log Out
        </button>
      </div>
    );
  }

  // 🔹 Remove item from cart
  const handleRemoveFromCart = async (productId) => {
    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("id", user.id)
      .eq("product_id", productId);

    if (error) {
      console.error("Failed to remove item:", error);
    } else {
      setCartItems((prev) => prev.filter((item) => item.id !== productId));
    }
  };

  return (
    <div className="dashboard-container">
      <h1 className="heading">Welcome to TSOGO-BIS, {profile.full_name}!</h1>

      {/* Profile Info */}
      <section className="profile-section">
        <h2 className="subheading">Your Profile</h2>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>Phone:</strong> {profile.phone || "Not provided"}</p>
        <p><strong>Joined:</strong> {new Date(profile.created_at).toLocaleDateString()}</p>
      </section>

      {/* Cart Items */}
      <section className="cart-section">
        <h2 className="subheading">Your Cart ({cartItems.length})</h2>
        {cartItems.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <ul className="product-list">
            {cartItems.map((product) => (
              <li key={product.id} className="product-item">
                <img
                  src={product.image_url?.[0] || "/placeholder.png"}
                  alt={product.name}
                  className="product-img"
                />
                <div className="product-info">
                  <p className="product-name">{product.name}</p>
                  <p className="product-price">${product.price.toFixed(2)}</p>
                  <p className="product-category">Category: {product.category}</p>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveFromCart(product.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Checkouts */}
      <section className="checkout-section">
        <h2 className="subheading">Your Orders ({checkouts.length})</h2>
        {checkouts.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <ul className="checkout-list">
            {checkouts.map((order) => (
              <li key={order.id} className="checkout-item">
                <p><strong>Order ID:</strong> {order.id}</p>
                <p><strong>Total:</strong> ${order.total.toFixed(2)}</p>
                <p><strong>Payment:</strong> {order.payment_method}</p>
                <p><strong>Placed on:</strong> {new Date(order.created_at).toLocaleDateString()}</p>

                {order.checkout_items?.length > 0 && (
                  <ul className="checkout-products">
                    {order.checkout_items.map((item) => (
                      <li key={item.id}>
                        Product ID: {item.product_id} | Quantity: {item.quantity} | Price: ${item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Link to order details page */}
                <Link to={`/orders/${order.id}`} className="order-details-link">
                  View Order Details
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="logout-btn" onClick={SignOut}>
        Log Out
      </button>
    </div>
  );
}
