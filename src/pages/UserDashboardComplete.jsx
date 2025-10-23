// src/pages/UserDashboardComplete.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useUserContext } from "../context/useUserContext";
import { useNavigate } from "react-router-dom";
import { LogOut, BarChart3, ShoppingCart, User, Save, Lock, DollarSign, Package, Settings, CheckCircle, Clock, Info } from "lucide-react";
import "../styles/UserDashboardComplete.css";

export default function UserDashboardComplete() {
  const { user } = useUserContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // User data
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalSpent: 0
  });

  // Settings form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/SignUp");
      return;
    }
    loadUserData();
  }, [user]);

  async function loadUserData() {
    setLoading(true);

    // Load profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profileError && profileData) {
      setProfile(profileData);
      setFullName(profileData.full_name || "");
      setEmail(profileData.email || "");
      setPhone(profileData.phone || "");
      setLanguage(profileData.language || "en");
    }

    // Load orders
    const { data: ordersData, error: ordersError } = await supabase
      .from("checkouts")
      .select(`
        *,
        checkout_items(
          quantity,
          price,
          product_id(name)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!ordersError && ordersData) {
      setOrders(ordersData);

      // Calculate stats
      const totalOrders = ordersData.length;
      const completedOrders = ordersData.filter(o => o.status === "completed").length;
      const pendingOrders = ordersData.filter(o => o.status === "pending").length;
      const totalSpent = ordersData.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

      setStats({ totalOrders, completedOrders, pendingOrders, totalSpent });
    }

    setLoading(false);
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setSavingProfile(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone,
        language: language
      })
      .eq("user_id", user.id);

    if (error) {
      alert("Error updating profile: " + error.message);
    } else {
      alert("Profile updated successfully!");
      loadUserData();
    }

    setSavingProfile(false);
  }

  async function handleChangePassword(e) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters!");
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert("Error changing password: " + error.message);
    } else {
      alert("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setChangingPassword(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const formatCurrency = (amount) => {
    return `${amount.toLocaleString()} XAF`;
  };

  if (loading) {
    return (
      <div className="user-dashboard-loading">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="user-dashboard-complete">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="user-avatar-large">
            {profile?.full_name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="header-info">
            <h1>Welcome back, {profile?.full_name || "User"}!</h1>
            <p>{profile?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          <LogOut className="inline-block mr-1" size={16} /> Sign Out
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          <BarChart3 className="inline-block mr-1" size={16} /> Overview
        </button>
        <button
          className={activeTab === "orders" ? "active" : ""}
          onClick={() => setActiveTab("orders")}
        >
          <ShoppingCart className="inline-block mr-1" size={16} /> My Orders
        </button>
        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          <Settings className="inline-block mr-1" size={16} /> Settings
        </button>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="overview-tab">
            <h2>Your Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><ShoppingCart size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalOrders}</div>
                  <div className="stat-label">Total Orders</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><CheckCircle size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{stats.completedOrders}</div>
                  <div className="stat-label">Completed</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Clock size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{stats.pendingOrders}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><DollarSign size={24} /></div>
                <div className="stat-content">
                  <div className="stat-value">{formatCurrency(stats.totalSpent)}</div>
                  <div className="stat-label">Total Spent</div>
                </div>
              </div>
            </div>

            <h2>Recent Orders</h2>
            {orders.length > 0 ? (
              <div className="recent-orders">
                {orders.slice(0, 5).map(order => (
                  <div key={order.id} className="order-card-mini">
                    <div className="order-header-mini">
                      <strong>Order #{order.id.slice(0, 8)}</strong>
                      <span className={`status-badge ${order.status}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="order-details-mini">
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      <span className="order-total">{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><Package size={48} /></div>
                <h3>No orders yet</h3>
                <p>Start shopping to see your orders here!</p>
                <button onClick={() => navigate("/shop")} className="btn-shop">
                  Browse Products
                </button>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="orders-tab">
            <h2>All My Orders</h2>
            {orders.length > 0 ? (
              <div className="orders-list">
                {orders.map(order => (
                  <div key={order.id} className="order-card">
                    <div className="order-card-header">
                      <div>
                        <strong>Order #{order.id.slice(0, 8)}</strong>
                        <div className="order-date">
                          {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span className={`status-badge ${order.status}`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="order-card-body">
                      <div className="order-items">
                        {order.checkout_items?.map((item, idx) => (
                          <div key={idx} className="order-item">
                            <span>{item.product_id?.name || "Product"}</span>
                            <span>x{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="order-info-grid">
                        <div className="info-item">
                          <span className="label">Shipping Method:</span>
                          <span className="value">{order.shipping_method || "Standard"}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">Delivery Status:</span>
                          <span className={`delivery-badge ${order.delivery_status}`}>
                            {order.delivery_status || "pending"}
                          </span>
                        </div>
                        {order.tracking_link && (
                          <div className="info-item">
                            <span className="label">Tracking:</span>
                            <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" className="tracking-link">
                              Track Package
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="order-card-footer">
                      <div className="order-total-display">
                        Total: <strong>{formatCurrency(order.total_amount)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No orders yet</h3>
                <p>You haven't placed any orders yet.</p>
                <button onClick={() => navigate("/shop")} className="btn-shop">
                  Start Shopping
                </button>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="settings-tab">
            {/* Profile Settings */}
            <div className="settings-section">
              <h2><User className="inline-block mr-2" size={20} /> Profile Information</h2>
              <form onSubmit={handleUpdateProfile} className="settings-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="disabled-input"
                  />
                  <small>Email cannot be changed</small>
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+237 XXX XXX XXX"
                  />
                </div>

                <div className="form-group">
                  <label>Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <button type="submit" disabled={savingProfile} className="btn-save">
                  {savingProfile ? "Saving..." : <><Save className="inline-block mr-1" size={16} /> Save Profile</>}
                </button>
              </form>
            </div>

            {/* Password Change */}
            <div className="settings-section">
              <h2><Lock className="inline-block mr-2" size={20} /> Change Password</h2>
              <form onSubmit={handleChangePassword} className="settings-form">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    minLength="6"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    minLength="6"
                    required
                  />
                </div>

                <button type="submit" disabled={changingPassword} className="btn-save">
                  {changingPassword ? "Changing..." : <><Lock className="inline-block mr-1" size={16} /> Change Password</>}
                </button>
              </form>
            </div>

            {/* Account Info */}
            <div className="settings-section">
              <h2><Info className="inline-block mr-2" size={20} /> Account Information</h2>
              <div className="account-info">
                <div className="info-row">
                  <span className="label">User ID:</span>
                  <span className="value code">{user?.id}</span>
                </div>
                <div className="info-row">
                  <span className="label">Member Since:</span>
                  <span className="value">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>
        {
        `
        .navbar{
        display:none;
        }
          `
        }
      </style>
    </div>
  );
}
