// src/pages/AdminApp.jsx
import React, { useState } from "react";
import { AdminProvider, useAdmin } from "../context/AdminContext";
import AdminDashboard from "../admin/AdminDashboard";
import AdminProducts from "../admin/AdminProducts";
import AdminOrders from "../admin/AdminOrders";
import AdminUsers from "../admin/AdminUsers";
import AdminCategories from "../admin/AdminCategories";
import AdminSubcategories from "../admin/AdminSubcategories";
import AdminReviews from "../admin/AdminReviews";
import AdminAnalytics from "../admin/AdminAnalytics";
import AdminSettings from "../admin/AdminSettings";
import AdminTracking from "../admin/AdminTracking";
import AdminAuth from "../admin/AdminAuth";
import AdminSignIn from "../components/AdminSignIn";
import { BarChart3, TrendingUp, Package, ShoppingCart, MapPin, Users, Folder, FolderTree, Star, Settings, Wrench, XCircle, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import "../styles/AdminAppComplete.css";
import Logo from "../assets/logo.png";

function AdminContent() {
  const { user, isAdmin, loading, signOut, adminRole } = useAdmin();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  // Not authenticated - use new simplified sign in
  if (!user) return <AdminSignIn />;

  // Not admin
  if (!isAdmin) {
    return (
      <div className="admin-access-denied">
        <div className="access-denied-card">
          <h2><XCircle className="inline-block mr-2" size={28} /> Access Denied</h2>
          <p>Your account does not have admin privileges.</p>
          <p>Please sign out and sign in with an admin account.</p>
          <button onClick={signOut} className="btn-primary">Sign Out</button>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: "dashboard", icon: <BarChart3 size={20} />, label: "Dashboard" },
    { id: "analytics", icon: <TrendingUp size={20} />, label: "Analytics" },
    { id: "products", icon: <Package size={20} />, label: "Products" },
    { id: "orders", icon: <ShoppingCart size={20} />, label: "Orders" },
    { id: "tracking", icon: <MapPin size={20} />, label: "Tracking" },
    { id: "users", icon: <Users size={20} />, label: "Users" },
    { id: "categories", icon: <Folder size={20} />, label: "Categories" },
    { id: "subcategories", icon: <FolderTree size={20} />, label: "Subcategories" },
    { id: "reviews", icon: <Star size={20} />, label: "Reviews" },
    { id: "settings", icon: <Settings size={20} />, label: "Settings" }
  ];

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon"><img src={Logo} alt="Logo" className="logo-img" /></span>
            {!sidebarCollapsed && <span className="logo-text">TSOGO Admin</span>}
          </div>
          <button 
            className="collapse-btn" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand" : "Collapse"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? "active" : ""}`}
              onClick={() => setActiveSection(item.id)}
              title={sidebarCollapsed ? item.label : ""}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-info">
            <div className="admin-avatar">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="admin-details">
                <div className="admin-role-badge">{adminRole}</div>
                <div className="admin-email-text">{user.email}</div>
              </div>
            )}
          </div>
          <button 
            onClick={signOut} 
            className="btn-signout-sidebar"
            title="Sign Out"
          >
            {sidebarCollapsed ? <LogOut size={18} /> : <><LogOut size={16} className="inline-block mr-2" /> Sign Out</>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        <div className="content-wrapper">
          {activeSection === "dashboard" && <AdminDashboard />}
          {activeSection === "analytics" && <AdminAnalytics />}
          {activeSection === "products" && <AdminProducts />}
          {activeSection === "orders" && <AdminOrders />}
          {activeSection === "tracking" && <AdminTracking />}
          {activeSection === "users" && <AdminUsers />}
          {activeSection === "categories" && <AdminCategories />}
          {activeSection === "subcategories" && <AdminSubcategories />}
          {activeSection === "reviews" && <AdminReviews />}
          {activeSection === "settings" && <AdminSettings />}
        </div>
      </main>
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminProvider>
      <AdminContent />
    </AdminProvider>
  );
}
