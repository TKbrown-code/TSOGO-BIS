// src/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { BarChart3, DollarSign, ShoppingCart, Users, Package, Clock, CheckCircle } from "lucide-react";
import "../styles/AdminDashboard.css";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);

    try {
      // Get products count
      const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      // Get orders count and stats
      const { data: orders } = await supabase
        .from("checkouts")
        .select("*")
        .order("created_at", { ascending: false });

      const totalOrders = orders?.length || 0;
      const pendingOrders = orders?.filter(o => o.status === "pending").length || 0;
      const completedOrders = orders?.filter(o => o.status === "completed").length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) || 0;

      // Get users count
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get recent orders
      const recentOrdersData = orders?.slice(0, 5) || [];

      setStats({
        totalProducts: productsCount || 0,
        totalOrders,
        totalUsers: usersCount || 0,
        totalRevenue,
        pendingOrders,
        completedOrders
      });

      setRecentOrders(recentOrdersData);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{t('admin.dashboard.loading')}</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1><BarChart3 className="inline-block mr-2" size={28} /> {t('admin.dashboard.title')}</h1>
        <p className="subtitle">{t('admin.dashboard.subtitle')}</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon"><DollarSign size={24} /></div>
          <div className="stat-content">
            <div className="stat-label">{t('admin.dashboard.stats.total_revenue')}</div>
            <div className="stat-value">{stats.totalRevenue.toLocaleString()} XAF</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon"><ShoppingCart size={24} /></div>
          <div className="stat-content">
            <div className="stat-label">{t('admin.dashboard.stats.total_orders')}</div>
            <div className="stat-value">{stats.totalOrders}</div>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-label">{t('admin.dashboard.stats.total_users')}</div>
            <div className="stat-value">{stats.totalUsers}</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon"><Package size={24} /></div>
          <div className="stat-content">
            <div className="stat-label">{t('admin.dashboard.stats.total_products')}</div>
            <div className="stat-value">{stats.totalProducts}</div>
          </div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-label">{t('admin.dashboard.stats.pending_orders')}</div>
            <div className="stat-value">{stats.pendingOrders}</div>
          </div>
        </div>

        <div className="stat-card completed">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-label">{t('admin.dashboard.stats.completed_orders')}</div>
            <div className="stat-value">{stats.completedOrders}</div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Recent Orders</h2>
          <a href="#orders" className="view-all-link">View All →</a>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-message">No orders yet</td>
                </tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.checkout_id}>
                    <td>#{order.checkout_id}</td>
                    <td>{order.user_name}</td>
                    <td>{parseFloat(order.total).toLocaleString()} XAF</td>
                    <td>
                      <span className={`status-badge ${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{new Date(order.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
