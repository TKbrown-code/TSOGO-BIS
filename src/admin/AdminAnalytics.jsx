// src/admin/AdminAnalytics.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { TrendingUp, DollarSign, ShoppingCart, BarChart3, Trophy, CheckCircle } from "lucide-react";
import "../styles/AdminAnalytics.css";

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("day"); // day, week, month, year
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    topProducts: [],
    revenueByDay: [],
    ordersByStatus: []
  });

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  async function loadAnalytics() {
    setLoading(true);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case "day":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Fetch orders within date range (only paid orders)
    // Note: items are stored as JSONB in the checkouts table
    const { data: orders, error } = await supabase
      .from("checkouts")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading analytics:", error);
      setLoading(false);
      return;
    }

    // Fetch all products to map names
    const { data: products } = await supabase
      .from("products")
      .select("id, name");

    const productMap = {};
    products?.forEach(p => {
      productMap[p.id] = p.name;
    });

    // Calculate analytics (only from PAID orders)
    // Note: We only fetch orders where status = 'paid' to ensure accurate revenue tracking
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const completedOrders = orders.filter(o => o.status === "paid").length;
    const pendingOrders = orders.filter(o => o.status === "pending").length;
    const cancelledOrders = orders.filter(o => o.status === "cancelled").length;

    // Top products (items are stored as JSONB array)
    const productSales = {};
    orders.forEach(order => {
      const items = order.items || []; // items is a JSONB array
      items.forEach(item => {
        const productName = productMap[item.id] || item.name || "Unknown Product";
        if (!productSales[productName]) {
          productSales[productName] = { name: productName, quantity: 0, revenue: 0 };
        }
        productSales[productName].quantity += item.quantity || 0;
        productSales[productName].revenue += (item.quantity || 0) * parseFloat(item.price || 0);
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Revenue by day (for chart)
    const revenueByDay = {};
    orders.forEach(order => {
      const date = new Date(order.created_at).toLocaleDateString();
      if (!revenueByDay[date]) {
        revenueByDay[date] = 0;
      }
      revenueByDay[date] += parseFloat(order.total || 0);
    });

    const revenueByDayArray = Object.entries(revenueByDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .slice(-30); // Last 30 entries

    setAnalytics({
      totalRevenue,
      totalOrders,
      avgOrderValue,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      topProducts,
      revenueByDay: revenueByDayArray,
      ordersByStatus: [
        { status: "paid", count: completedOrders, color: "#10b981" },
        { status: "Pending", count: pendingOrders, color: "#f59e0b" },
        { status: "Cancelled", count: cancelledOrders, color: "#ef4444" }
      ]
    });

    setLoading(false);
  }

  const formatCurrency = (amount) => {
    return `${amount.toLocaleString()} XAF`;
  };

  return (
    <div className="admin-analytics">
      <div className="analytics-header">
        <div>
          <h1><TrendingUp className="inline-block mr-2" size={28} /> Sales Analytics</h1>
          <p className="subtitle">Track your revenue and sales performance</p>
        </div>
        <div className="time-range-selector">
          <button
            className={timeRange === "day" ? "active" : ""}
            onClick={() => setTimeRange("day")}
          >
            Today
          </button>
          <button
            className={timeRange === "week" ? "active" : ""}
            onClick={() => setTimeRange("week")}
          >
            Last 7 Days
          </button>
          <button
            className={timeRange === "month" ? "active" : ""}
            onClick={() => setTimeRange("month")}
          >
            Last 30 Days
          </button>
          <button
            className={timeRange === "year" ? "active" : ""}
            onClick={() => setTimeRange("year")}
          >
            Last Year
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card revenue">
              <div className="metric-icon"><DollarSign size={24} /></div>
              <div className="metric-content">
                <div className="metric-label">Total Revenue</div>
                <div className="metric-value">{formatCurrency(analytics.totalRevenue)}</div>
              </div>
            </div>

            <div className="metric-card orders">
              <div className="metric-icon"><ShoppingCart size={24} /></div>
              <div className="metric-content">
                <div className="metric-label">Total Orders</div>
                <div className="metric-value">{analytics.totalOrders}</div>
              </div>
            </div>

            <div className="metric-card avg">
              <div className="metric-icon"><BarChart3 size={24} /></div>
              <div className="metric-content">
                <div className="metric-label">Avg Order Value</div>
                <div className="metric-value">{formatCurrency(analytics.avgOrderValue)}</div>
              </div>
            </div>

            <div className="metric-card completed">
              <div className="metric-icon"><CheckCircle size={24} /></div>
              <div className="metric-content">
                <div className="metric-label">Completed</div>
                <div className="metric-value">{analytics.completedOrders}</div>
              </div>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="analytics-section">
            <h2><TrendingUp className="inline-block mr-2" size={20} /> Revenue Trend</h2>
            <div className="revenue-chart">
              {analytics.revenueByDay.length > 0 ? (
                <div className="chart-bars">
                  {analytics.revenueByDay.map((item, index) => {
                    const maxRevenue = Math.max(...analytics.revenueByDay.map(d => d.revenue));
                    const height = (item.revenue / maxRevenue) * 100;
                    return (
                      <div key={index} className="chart-bar-container">
                        <div
                          className="chart-bar"
                          style={{ height: `${height}%` }}
                          title={`${item.date}: ${formatCurrency(item.revenue)}`}
                        ></div>
                        <div className="chart-label">{item.date.split('/')[0]}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-chart">No revenue data for this period</div>
              )}
            </div>
          </div>

          {/* Orders by Status */}
          <div className="analytics-section">
            <h2><BarChart3 className="inline-block mr-2" size={20} /> Orders by Status</h2>
            <div className="status-breakdown">
              {analytics.ordersByStatus.map((item, index) => (
                <div key={index} className="status-item">
                  <div className="status-info">
                    <div
                      className="status-color"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="status-name">{item.status}</span>
                  </div>
                  <div className="status-count">{item.count}</div>
                  <div className="status-bar">
                    <div
                      className="status-bar-fill"
                      style={{
                        width: `${(item.count / analytics.totalOrders) * 100}%`,
                        backgroundColor: item.color
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="analytics-section">
            <h2><Trophy className="inline-block mr-2" size={20} /> Top Selling Products</h2>
            <div className="top-products">
              {analytics.topProducts.length > 0 ? (
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Product</th>
                      <th>Quantity Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topProducts.map((product, index) => (
                      <tr key={index}>
                        <td>
                          <span className="rank-badge">#{index + 1}</span>
                        </td>
                        <td className="product-name">{product.name}</td>
                        <td>{product.quantity}</td>
                        <td className="revenue-cell">{formatCurrency(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No product sales data</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
