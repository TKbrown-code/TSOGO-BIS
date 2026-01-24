// src/pages/UserDashboardNew.jsx - Complete User Dashboard with Sidebar
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useUserContext } from "../context/useUserContext";
import { useNavigate, Navigate } from "react-router-dom";
import { getCachedImage } from "../utils/imageCache";
import { Home, BarChart3, ShoppingCart, ShoppingBag, FileText, LogOut, DollarSign, Package, Star, Settings, CheckCircle, Clock, Plus, Minus } from "lucide-react";
import "../styles/UserDashboardNew.css";

export default function UserDashboardNew() {
  const { user, profile, loading } = useUserContext();
  const navigate = useNavigate();
  
  // Active section
  const [activeSection, setActiveSection] = useState("overview");
  const [dataLoading, setDataLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productNames, setProductNames] = useState({});

  // User data from all tables
  const [userData, setUserData] = useState({
    profile: null,
    orders: [],
    cart: [],
    cartHistory: [],
    reviews: []
  });

  // Statistics
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
    cartItems: 0,
    reviewsGiven: 0
  });

  // Settings form
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    language: "en"
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Helper function to get product image
  const getProductImage = (product) => {
    if (!product) return "/placeholder.png";
    const primaryImage = product.product_images?.find(img => img.is_primary);
    if (primaryImage) {
      return getCachedImage(primaryImage.image_path) || "/placeholder.png";
    }
    return "/placeholder.png";
  };

  // Redirect if not logged in
  if (!loading && !user) {
    return <Navigate to="/SignUp" replace />;
  }

  useEffect(() => {
    if (user) {
      loadAllUserData();
    }
  }, [user]);

  async function loadAllUserData() {
    setDataLoading(true);

    try {
      // 1. Load Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // 2. Load Orders (checkouts) with product details
      const { data: ordersData } = await supabase
        .from("checkouts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // 3. Load Cart with full product details and images
      const { data: cartData } = await supabase
        .from("cart")
        .select(`
          *,
          product_id (
            id,
            name,
            price,
            in_Stock,
            description,
            product_images (
              image_path,
              is_primary
            )
          )
        `)
        .eq("user_id", user.id);

      // 4. Load Cart History (basic data first)
      const { data: cartHistoryData } = await supabase
        .from("cart_history")
        .select("*")
        .eq("user_id", user.id)
        .order("action_at", { ascending: false })
        .limit(20);
      
      // Fetch product names for cart history
      if (cartHistoryData && cartHistoryData.length > 0) {
        const productIds = [...new Set(cartHistoryData.map(item => item.product_id))];
        const { data: productsData } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        
        const nameMap = {};
        if (productsData) {
          productsData.forEach(product => {
            nameMap[product.id] = product.name;
          });
        }
        setProductNames(nameMap);
      }
      
      console.log("Cart History Data:", cartHistoryData);

      // 5. Load Reviews with product details
      const { data: reviewsData } = await supabase
        .from("product_reviews")
        .select(`
          *,
          product_id (
            id,
            name,
            product_images (
              image_path,
              is_primary
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Set user data
      setUserData({
        profile: profileData,
        orders: ordersData || [],
        cart: cartData || [],
        cartHistory: cartHistoryData || [],
        reviews: reviewsData || []
      });

      // Set form data
      if (profileData) {
        setFormData({
          fullName: profileData.full_name || "",
          phone: profileData.phone || "",
          language: profileData.language || "en"
        });
      }

      // Calculate statistics
      const totalOrders = ordersData?.length || 0;
      const completedOrders = ordersData?.filter(o => o.status === "paid").length || 0;
      const pendingOrders = ordersData?.filter(o => o.status === "pending").length || 0;
      const totalSpent = ordersData?.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) || 0;

      setStats({
        totalOrders,
        completedOrders,
        pendingOrders,
        totalSpent,
        cartItems: cartData?.length || 0,
        reviewsGiven: reviewsData?.length || 0
      });

    } catch (error) {
      console.error("Error loading user data:", error);
    }

    setDataLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  async function handleSaveProfile() {
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.fullName,
        phone: formData.phone,
        language: formData.language
      })
      .eq("user_id", user.id);

    if (error) {
      alert("Error updating profile: " + error.message);
    } else {
      alert("Profile updated successfully!");
      loadAllUserData();
    }

    setSaving(false);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert("Error changing password: " + error.message);
    } else {
      alert("Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    }

    setSaving(false);
  }

  async function handleRemoveFromCart(cartId) {
    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("id", cartId);

    if (error) {
      alert("Error removing item: " + error.message);
    } else {
      loadAllUserData();
    }
  }

  async function handleUpdateCartQuantity(cartId, newQuantity) {
    if (newQuantity < 1) return;

    const { error } = await supabase
      .from("cart")
      .update({ quantity: newQuantity })
      .eq("id", cartId);

    if (error) {
      alert("Error updating quantity: " + error.message);
    } else {
      loadAllUserData();
    }
  }

  const formatCurrency = (amount) => {
    return `${parseFloat(amount).toLocaleString()} XAF`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  if (loading || dataLoading) {
    return (
      <div className="user-dashboard-loading">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

const fetchproduct = async (id) => {
  if (!id) return null;

  try {
    const { data, error } = await supabase
      .from("products")
      .select("name")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("fetchProduct failed:", err.message);
    return null;
  }
};


  return (
    <div className="user-dashboard-container">
      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`user-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="user-avatar">
            {userData.profile?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <h3>{userData.profile?.username || "User"}</h3>
          <p>{userData.profile?.email}</p>
        </div>

        <nav className="sidebar-nav">
          <button
            className="btn-home"
            onClick={() => navigate("/")}
          >
            <span className="icon"><Home size={20} /></span>
            Home
          </button>
          <button
            className={activeSection === "overview" ? "active" : ""}
            onClick={() => {
              setActiveSection("overview");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><BarChart3 size={20} /></span>
            Overview
          </button>
          <button
            className={activeSection === "orders" ? "active" : ""}
            onClick={() => {
              setActiveSection("orders");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><ShoppingCart size={20} /></span>
            My Orders
          </button>
          <button
            className={activeSection === "cart" ? "active" : ""}
            onClick={() => {
              setActiveSection("cart");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><ShoppingBag size={20} /></span>
            Shopping Cart
            {stats.cartItems > 0 && (
              <span className="badge">{stats.cartItems}</span>
            )}
          </button>
          <button
            className={activeSection === "reviews" ? "active" : ""}
            onClick={() => {
              setActiveSection("reviews");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><Star size={20} /></span>
            My Reviews
          </button>
          <button
            className={activeSection === "history" ? "active" : ""}
            onClick={() => {
              setActiveSection("history");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><FileText size={20} /></span>
            Cart History
          </button>
          <button
            className={activeSection === "settings" ? "active" : ""}
            onClick={() => {
              setActiveSection("settings");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><Settings size={20} /></span>
            Settings
          </button>
        </nav>

        <button className="btn-signout" onClick={handleSignOut}>
          <span className="icon"><LogOut size={20} /></span>
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="user-main-content">
        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="section-content">
            <h1>Dashboard Overview</h1>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><ShoppingCart size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalOrders}</div>
                  <div className="stat-label">Total Orders</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><CheckCircle size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.completedOrders}</div>
                  <div className="stat-label">Completed</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Clock size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.pendingOrders}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><DollarSign size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{formatCurrency(stats.totalSpent)}</div>
                  <div className="stat-label">Total Spent</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><ShoppingBag size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.cartItems}</div>
                  <div className="stat-label">Cart Items</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Star size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.reviewsGiven}</div>
                  <div className="stat-label">Reviews Given</div>
                </div>
              </div>
            </div>

            <div className="recent-section">
              <h2>Recent Orders</h2>
              {userData.orders.slice(0, 5).length === 0 ? (
                <div className="empty-state">
                  <p>No orders yet</p>
                  <button onClick={() => navigate("/shop")}>Start Shopping</button>
                </div>
              ) : (
                <div className="orders-list">
                  {userData.orders.slice(0, 5).map(order => (
                    <div onClick={() => navigate(`/order/${order.checkout_id}`)} key={order.checkout_id} className="order-card-mini">
                      <div className="order-header">
                        <strong>Order #{order.checkout_id}</strong>
                        <span className={`status-badge ${order.status}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="order-details">
                        <span>{formatDate(order.created_at)}</span>
                        <span className="order-total">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders Section */}
        {activeSection === "orders" && (
          <div className="section-content">
            <h1>My Orders</h1>

            {userData.orders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Package size={48} /></div>
                <h3>No Orders Yet</h3>
                <p>Start shopping to see your orders here</p>
                <button onClick={() => navigate("/shop")}>Browse Products</button>
              </div>
            ) : (
              <div className="orders-list">
                {userData.orders.map(order => {
                  const items = order.items || [];
                  return (
                    <div key={order.checkout_id} className="order-card">
                      <div className="order-card-header">
                        <div>
                          <strong>Order #{order.checkout_id}</strong>
                          <div className="order-date">{formatDate(order.created_at)}</div>
                        </div>
                        <span className={`status-badge ${order.status}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="order-card-body">
                        <div className="order-items">
                          <strong>Items:</strong>
                          {items.map((item, idx) => (
                            <div key={idx} className="order-item">
                              <span>{item.name} x {item.quantity}</span>
                              <span>{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="order-info-grid">
                          <div className="info-item">
                            <div className="label">Delivery Status</div>
                            <div className="value">
                              <span className={`delivery-badge ${order.delivery_status}`}>
                                {order.delivery_status || "pending"}
                              </span>
                            </div>
                          </div>

                          <div className="info-item">
                            <div className="label">Shipping Method</div>
                            <div className="value">{order["method of shipping"] || "Standard"}</div>
                          </div>

                          <div className="info-item">
                            <div className="label">Delivery Address</div>
                            <div className="value">{order.address}</div>
                          </div>

                          {order.tracking_link && (
                            <div className="info-item">
                              <div className="label">Tracking</div>
                              <div className="value">
                                <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" className="tracking-link">
                                  Track Package
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="order-card-footer">
                        <div className="order-total-display">
                          Total: <strong>{formatCurrency(order.total)}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Cart Section */}
        {activeSection === "cart" && (
          <div className="section-content">
            <h1>Shopping Cart</h1>

            {userData.cart.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><ShoppingBag size={48} /></div>
                <h3>Your Cart is Empty</h3>
                <p>Add some products to your cart</p>
                <button onClick={() => navigate("/shop")}>Browse Products</button>
              </div>
            ) : (
              <div className="cart-list">
                {userData.cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-info">
                      <h3>{item.products?.name}</h3>
                      <p className="cart-item-price">{formatCurrency(item.products?.price || 0)}</p>
                      {item.color && <p>Color: {item.color}</p>}
                      {item.size && <p>Size: {item.size}</p>}
                      <p className="cart-item-stock">
                        {item.products?.in_Stock === "true" ? "✅ In Stock" : "❌ Out of Stock"}
                      </p>
                    </div>

                    <div className="cart-item-actions">
                      <div className="quantity-control">
                        <button onClick={() => handleUpdateCartQuantity(item.id, item.quantity - 1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => handleUpdateCartQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <button className="btn-remove" onClick={() => handleRemoveFromCart(item.id)}>
                        Remove
                      </button>
                    </div>

                    <div className="cart-item-total">
                      {formatCurrency((item.products?.price || 0) * item.quantity)}
                    </div>
                  </div>
                ))}

                <div className="cart-summary">
                  <h3>Cart Summary</h3>
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <strong>
                      {formatCurrency(
                        userData.cart.reduce((sum, item) => 
                          sum + (item.products?.price || 0) * item.quantity, 0
                        )
                      )}
                    </strong>
                  </div>
                  <button className="btn-checkout" onClick={() => navigate("/checkout")}>
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews Section */}
        {activeSection === "reviews" && (
          <div className="section-content">
            <h1>My Reviews</h1>

            {userData.reviews.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⭐</div>
                <h3>No Reviews Yet</h3>
                <p>Purchase products and leave reviews</p>
              </div>
            ) : (
              <div className="reviews-list">
                {userData.reviews.map(review => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <h3>{review.product_id?.name || 'Unknown Product'}</h3>
                      <div className="review-rating">
                        {"⭐".repeat(review.rating)}
                      </div>
                    </div>
                    <p className="review-comment">{review.comment}</p>
                    <div className="review-date">{formatDate(review.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cart History Section */}
        {activeSection === "history" && (
          <div className="section-content">
            <h1>Cart History</h1>

            {userData.cartHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><FileText size={48} /></div>
                <h3>No History Yet</h3>
                <p>Your cart activity will appear here</p>
              </div>
            ) : (
              <div className="history-list">
                {userData.cartHistory.map(history => (
                  <div key={history.history_id} className="history-item">
                    <div className="history-icon">
                      {history.action === "INSERT" ? <Plus size={20} /> : <Minus size={20} />}
                    </div>
                    <div className="history-info">
                      <strong>{history.action === "INSERT" ? "Added to cart" : "Removed from cart"}</strong>
                      <p>{productNames[history.product_id] || history.product_id} | Quantity: {history.quantity}</p>
                      <span className="history-date">{formatDate(history.action_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Section */}
        {activeSection === "settings" && (
          <div className="section-content">
            <h1>Account Settings</h1>

            <div className="settings-section">
              <h2>Profile Information</h2>
              <div className="settings-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={userData.profile?.email || ""}
                    disabled
                    className="disabled-input"
                  />
                  <small>Email cannot be changed</small>
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Language</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <button className="btn-save" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h2>Change Password</h2>
              <div className="settings-form">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <button className="btn-save" onClick={handleChangePassword} disabled={saving}>
                  {saving ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h2>Account Information</h2>
              <div className="account-info">
                <div className="info-row">
                  <span className="label">User ID:</span>
                  <span className="value code">{user?.id}</span>
                </div>
                <div className="info-row">
                  <span className="label">Member Since:</span>
                  <span className="value">{formatDate(userData.profile?.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
