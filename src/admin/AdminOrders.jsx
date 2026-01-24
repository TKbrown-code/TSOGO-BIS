// src/admin/AdminOrders.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ShoppingCart, BarChart3, RefreshCw, DollarSign, Search, User, Phone, MapPin, Truck, Link, Clock, CheckCircle, XCircle } from "lucide-react";
import "../styles/AdminOrders.css";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDelivery, setFilterDelivery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("checkouts")
      .select(`
        *,
        checkout_items(
          id,
          product_id,
          quantity,
          price,
          shipping_method,
          shipping_fee
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading orders:", error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }

  async function updateOrderStatus(orderId, status) {
    const { error } = await supabase
      .from("checkouts")
      .update({ status })
      .eq("checkout_id", orderId);

    if (error) {
      alert("Error updating status: " + error.message);
    } else {
      setOrders(orders.map(o => 
        o.checkout_id === orderId ? { ...o, status } : o
      ));
      alert("Status updated successfully!");
    }
  }

  async function updateDeliveryStatus(orderId, deliveryStatus) {
    const { error } = await supabase
      .from("checkouts")
      .update({ delivery_status: deliveryStatus })
      .eq("checkout_id", orderId);

    if (error) {
      alert("Error updating delivery status: " + error.message);
    } else {
      setOrders(orders.map(o => 
        o.checkout_id === orderId ? { ...o, delivery_status: deliveryStatus } : o
      ));
      alert("Delivery status updated successfully!");
    }
  }

  async function updateTrackingLink(orderId, trackingLink) {
    const { error } = await supabase
      .from("checkouts")
      .update({ tracking_link: trackingLink })
      .eq("checkout_id", orderId);

    if (error) {
      alert("Error updating tracking link: " + error.message);
    } else {
      const trackingNumber = trackingLink.split('/track/')[1] || '';
      const {error} = await supabase.from("order_tracking").update({tracking_number: trackingNumber}).eq("order_id", orderId);
      if(error){
        alert("Error updating tracking number: " + error.message);
        return;
      }
      setOrders(orders.map(o => 
        o.checkout_id === orderId ? { ...o, tracking_link: trackingLink } : o
      ));
      setSelectedOrder(null);
      alert("Tracking link updated successfully!");
    }
  }

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.username?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (order.phone_number?.includes(searchQuery) || false) ||
      order.checkout_id.toString().includes(searchQuery);
    const matchesStatus = !filterStatus || order.status === filterStatus;
    const matchesDelivery = !filterDelivery || order.delivery_status === filterDelivery;
    return matchesSearch && matchesStatus && matchesDelivery;
  });

  // Statistics
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    processing: orders.filter(o => o.status === "processing").length,
    completed: orders.filter(o => o.status === "completed").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
    totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0)
  };

  return (
    <div className="admin-orders">
      <div className="orders-header">
        <div>
          <h1><ShoppingCart className="inline-block mr-2" size={28} /> Orders Management</h1>
          <p className="subtitle">Manage customer orders and deliveries</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><BarChart3 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Orders</div>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon"><Clock size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card processing">
          <div className="stat-icon"><RefreshCw size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.processing}</div>
            <div className="stat-label">Processing</div>
          </div>
        </div>
        <div className="stat-card completed">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="stat-card cancelled">
          <div className="stat-icon"><XCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.cancelled}</div>
            <div className="stat-label">Cancelled</div>
          </div>
        </div>
        <div className="stat-card revenue">
          <div className="stat-icon"><DollarSign size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalRevenue.toLocaleString()} XAF</div>
            <div className="stat-label">Total Revenue</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by customer name, phone, or order ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterDelivery} onChange={e => setFilterDelivery(e.target.value)}>
          <option value="">All Delivery Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
        </select>
        {(searchQuery || filterStatus || filterDelivery) && (
          <button
            onClick={() => {
              setSearchQuery("");
              setFilterStatus("");
              setFilterDelivery("");
            }}
            className="btn-clear"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ShoppingCart size={48} /></div>
          <h3>No orders found</h3>
          <p>
            {searchQuery || filterStatus || filterDelivery
              ? "Try adjusting your filters"
              : "No orders have been placed yet"}
          </p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => (
            <div key={order.checkout_id} className="order-card">
              <div className="order-header">
                <div className="order-id">
                  <strong>Order #{order.checkout_id}</strong>
                  <span className="order-date">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="order-badges">
                  <span className={`status-badge ${order.status}`}>
                    {order.status}
                  </span>
                  <span className={`delivery-badge ${order.delivery_status}`}>
                    {order.delivery_status || "pending"}
                  </span>
                </div>
              </div>

              <div className="order-body">
                <div className="order-info">
                  <div className="info-rowt">
                    <p className="label"><User className="inline-block mr-1" size={16} /> Customer:</p>
                    <p className="value">{order.username}</p>
                  </div>
                  <div className="info-rowt">
                    <p className="label"><Phone className="inline-block mr-1" size={16} /> Phone:</p>
                    <p className="value">{order.phone_number}</p>
                  </div>
                  <div className="info-rowt">
                    <p className="label"><MapPin className="inline-block mr-1" size={16} /> Address:</p>
                    <p className="value">{order.address}</p>
                  </div>
                  {order.method_of_shipping && (
                    <div className="info-rowt">
                      <p className="label"><Truck className="inline-block mr-1" size={16} /> Shipping:</p>
                      <p className="value">{order.method_of_shipping}</p>
                    </div>
                  )}
                  <div className="info-rowt">
                    <p className="label"><DollarSign className="inline-block mr-1" size={16} /> Total:</p>
                    <p className="value total">{parseFloat(order.total).toLocaleString()} XAF</p>
                  </div>
                  {order.tracking_link && (
                    <div className="info-rowt">
                      <p className="label"><Link className="inline-block mr-1" size={16} /> Tracking:</p>
                      <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" className="tracking-link">
                        View Tracking
                      </a>
                    </div>
                  )}
                </div>

                {/* Order Items */}
                {order.checkout_items && order.checkout_items.length > 0 && (
                  <div className="order-items">
                    <h4>Order Items ({order.checkout_items.length})</h4>
                    <div className="items-list">
                      {order.checkout_items.map(item => (
                        <div key={item.id} className="item-row">
                          <p className="item-qty">×{item.quantity}</p>
                          <p className="item-name">Product ID: {item.product_id}</p>
                          <p className="item-price">{parseFloat(item.price).toLocaleString()} XAF</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="order-actions">
                <div className="action-group">
                  <label>Order Status:</label>
                  <select
                    value={order.status}
                    onChange={e => updateOrderStatus(order.checkout_id, e.target.value)}
                    className="status-select"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="action-group">
                  <label>Delivery Status:</label>
                  <select
                    value={order.delivery_status || "pending"}
                    onChange={e => updateDeliveryStatus(order.checkout_id, e.target.value)}
                    className="delivery-select"
                  >
                    <option value="pending">Pending</option>
                    <option value="shipped">Shipped</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <button
                  onClick={() => setSelectedOrder(order)}
                  className="btn-tracking"
                >
                  {order.tracking_link ? "Update" : "Add"} Tracking
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tracking Link Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Update Tracking Link</h3>
              <button onClick={() => setSelectedOrder(null)} className="close-btn">✕</button>
            </div>
            <div className="modal-body">
              <p>Order #{selectedOrder.checkout_id}</p>
              <input
                type="text"
                placeholder="Enter tracking link URL"
                defaultValue={selectedOrder.tracking_link || ""}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    updateTrackingLink(selectedOrder.checkout_id, e.target.value);
                  }
                }}
                id="tracking-input"
                className="tracking-input"
              />
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedOrder(null)} className="btn-cancel">
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById("tracking-input");
                  updateTrackingLink(selectedOrder.checkout_id, input.value);
                }}
                className="btn-save"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
