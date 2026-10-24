// src/pages/AdminApp.jsx
import React, { useEffect, useState } from "react";
import { AdminProvider, useAdmin } from "../../context/AdminContext";
import AdminDashboard from "../dashboard/AdminDashboard";
import AdminProducts from "../products/AdminProducts";
import AdminOrders from "../orders/AdminOrders";
import AdminUsers from "../users/AdminUsers";
import AdminCategories from "../categories/AdminCategories";
import AdminReviews from "../reviews/AdminReviews";
import AdminAnalytics from "../analytics/AdminAnalytics";
import AdminSettings from "../settings/AdminSettings";
import AdminReferrals from "../referrals/AdminReferrals";
import AdminTracking from "../tracking/AdminTracking";
import AdminCoupons from "../coupons/AdminCoupons";
import AdminAds from "../ads/AdminAds";
import AdminAuth from "../auth/AdminAuth";
import AdminSignIn from "../auth/AdminSignIn";
import AdminMfaGate from "../auth/AdminMfaGate";
import { BarChart3, TrendingUp, Package, ShoppingCart, MapPin, Users, FolderTree, Star, Settings, XCircle, LogOut, ChevronLeft, ChevronRight, Menu, Gift, X, TicketPercent, Megaphone } from "lucide-react";
import "./AdminAppComplete.css";
import Logo from "../../assets/brand-logo.png";
import NotificationCenter from "../../components/shared/NotificationCenter";

function AdminContent() {
  const { user, isAdmin, loading, signOut } = useAdmin();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("admin-body", Boolean(user && isAdmin));
    return () => document.body.classList.remove("admin-body");
  }, [user, isAdmin]);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 768px)");
    const keepMobileDrawerExpanded = () => {
      if (compactViewport.matches) setSidebarCollapsed(false);
    };
    keepMobileDrawerExpanded();
    compactViewport.addEventListener("change", keepMobileDrawerExpanded);
    return () => compactViewport.removeEventListener("change", keepMobileDrawerExpanded);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="admin-startup-skeleton" aria-busy="true" aria-label="Loading admin workspace">
        <aside className="startup-sidebar"><i className="startup-brand" />{Array.from({ length: 9 }, (_, index) => <i className="startup-nav-item" key={index} />)}<i className="startup-profile" /></aside>
        <main className="startup-main"><header><i /><i /></header><section><div className="startup-title"><i /><i /></div><div className="startup-metrics">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div><div className="startup-panels"><i /><i /></div><div className="startup-panels lower"><i /><i /></div></section></main>
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
    { id: "dashboard", group: "Overview", icon: <BarChart3 size={19} />, label: "Dashboard" },
    { id: "analytics", group: "Overview", icon: <TrendingUp size={19} />, label: "Analytics" },
    { id: "orders", group: "Commerce", icon: <ShoppingCart size={19} />, label: "Orders" },
    { id: "tracking", group: "Commerce", icon: <MapPin size={19} />, label: "Tracking" },
    { id: "products", group: "Catalog", icon: <Package size={19} />, label: "Products" },
    { id: "categories", group: "Catalog", icon: <FolderTree size={19} />, label: "Categories" },
    { id: "users", group: "Customers", icon: <Users size={19} />, label: "Users" },
    { id: "reviews", group: "Customers", icon: <Star size={19} />, label: "Reviews" },
    { id: "referrals", group: "Customers", icon: <Gift size={19} />, label: "Referrals" },
    { id: "coupons", group: "Commerce", icon: <TicketPercent size={19} />, label: "Coupons" },
    { id: "ads", group: "Workspace", icon: <Megaphone size={19} />, label: "Ads & popups" },
    { id: "settings", group: "Workspace", icon: <Settings size={19} />, label: "Settings" }
  ];

  const activeLabel = menuItems.find((item) => item.id === activeSection)?.label || "Dashboard";
  const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  const showSidebarLabels = !sidebarCollapsed || isMobileViewport;
  const navigateTo = (section) => {
    setActiveSection(section);
    setMobileNavOpen(false);
  };
  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      setMobileNavOpen(false);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  };

  return (
    <AdminMfaGate user={user} onSignOut={signOut}>
    <div className={`admin-container ${sidebarCollapsed ? "sidebar-is-collapsed" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      {mobileNavOpen && <button className="admin-sidebar-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon"><img src={Logo} alt="Logo" className="logo-img" /></span>
            {showSidebarLabels && <span className="logo-lockup"><span className="logo-text">TSOGO <b>Admin</b></span><small>COMMERCE WORKSPACE</small></span>}
          </div>
          <button
            className="collapse-btn" 
            onClick={toggleSidebar}
            title={isMobileViewport ? "Close navigation" : sidebarCollapsed ? "Expand" : "Collapse"}
            aria-label={isMobileViewport ? "Close navigation" : sidebarCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
          >
            {isMobileViewport ? <X size={18} /> : sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {[...new Set(menuItems.map((item) => item.group))].map((group) => (
            <div className="sidebar-nav-group" key={group}>
              {showSidebarLabels && <span className="sidebar-group-label">{group}</span>}
              {menuItems.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${activeSection === item.id ? "active" : ""}`}
                  onClick={() => navigateTo(item.id)}
                  title={!showSidebarLabels ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={activeSection === item.id ? "page" : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {showSidebarLabels && <span className="nav-label">{item.label}</span>}
                  {showSidebarLabels && activeSection === item.id && <span className="nav-active-mark" aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-info">
            <div className="admin-avatar">
              {user.email?.charAt(0).toUpperCase() || "A"}
            </div>
            {showSidebarLabels && (
              <div className="admin-details">
                <div className="admin-profile-name">{user.user_metadata?.display_name || user.email?.split("@")[0] || "Administrator"}</div>
                <div className="admin-email-text">{user.email}</div>
              </div>
            )}
          </div>
          <button 
            onClick={signOut} 
            className="btn-signout-sidebar"
            title="Sign Out"
            aria-label="Sign out of admin workspace"
          >
            {sidebarCollapsed ? <LogOut size={18} /> : <><LogOut size={16} className="inline-block mr-2" /> Sign Out</>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        <header className="admin-topbar">
          <button className="admin-mobile-menu" onClick={() => { setSidebarCollapsed(false); setMobileNavOpen(true); }} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="admin-topbar-title"><span>TSOGO BIS / ADMIN</span><strong>{activeLabel}</strong></div>
          <div className="admin-topbar-actions">
            <NotificationCenter userId={user.id} audience="admin" onOpen={() => navigateTo("orders")} />
            <span className="admin-live-indicator"><i /> Admin workspace</span>
            <div className="admin-topbar-avatar" title={user.email}>{user.email?.charAt(0).toUpperCase()}</div>
          </div>
        </header>
        <div className="content-wrapper">
          {/* Keep the overview mounted while other admin sections are open so its data and view state are preserved. */}
          <div hidden={activeSection !== "dashboard"}>
            <AdminDashboard onNavigate={navigateTo} />
          </div>
          {activeSection === "analytics" && <AdminAnalytics />}
          {activeSection === "products" && <AdminProducts />}
          {activeSection === "orders" && <AdminOrders />}
          {activeSection === "tracking" && <AdminTracking />}
          {activeSection === "users" && <AdminUsers />}
          {activeSection === "categories" && <AdminCategories />}
          {activeSection === "reviews" && <AdminReviews />}
          {activeSection === "referrals" && <AdminReferrals />}
          {activeSection === "coupons" && <AdminCoupons />}
          {activeSection === "ads" && <AdminAds />}
          {activeSection === "settings" && <AdminSettings />}
        </div>
      </main>
    </div>
    </AdminMfaGate>
  );
}

export default function AdminApp() {
  return (
    <AdminProvider>
      <AdminContent />
    </AdminProvider>
  );
}
