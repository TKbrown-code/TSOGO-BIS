// src/admin/AdminUsers.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Users, Calendar, Search, ShoppingCart, ShoppingBag, FileText, X, Plus, Minus, Edit } from "lucide-react";
import "../styles/AdminUsers.css";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [userCartHistory, setUserCartHistory] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading users:", error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }

  async function loadUserDetails(userId) {
    // Load user orders
    const { data: orders } = await supabase
      .from("checkouts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Load user cart history - table doesn't exist yet
    const cartHistory = [];

    setUserOrders(orders || []);
    setUserCartHistory(cartHistory || []);
  }

  async function viewUserDetails(user) {
    setSelectedUser(user);
    await loadUserDetails(user.user_id);
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.phone.includes(searchQuery)
    );
  });

  return (
    <div className="admin-users">
      <div className="users-header">
        <div>
          <h1><Users className="inline-block mr-2" size={28} /> Users Management</h1>
          <p className="subtitle">Manage registered users and their activities</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Total Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Calendar size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">
              {users.filter(u => {
                const createdDate = new Date(u.created_at);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return createdDate >= thirtyDaysAgo;
              }).length}
            </div>
            <div className="stat-label">New (30 days)</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="btn-clear">
            Clear Search
          </button>
        )}
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Users size={48} /></div>
          <h3>No users found</h3>
          <p>
            {searchQuery
              ? "Try adjusting your search"
              : "No users have registered yet"}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Language</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.user_id}>
                  <td>
                    <div className="user-name">
                      <div className="user-avatar">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      {user.full_name}
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.phone}</td>
                  <td>
                    <span className="language-badge">
                      {user.language || "en"}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => viewUserDetails(user)}
                      className="btn-view"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>User Details</h3>
                <p className="user-email">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="close-btn"><X size={20} /></button>
            </div>

            <div className="modal-body">
              {/* User Info */}
              <div className="user-info-section">
                <h4><FileText className="inline-block mr-2" size={20} /> User Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Full Name:</span>
                    <span className="value">{selectedUser.full_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Email:</span>
                    <span className="value">{selectedUser.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Phone:</span>
                    <span className="value">{selectedUser.phone}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Language:</span>
                    <span className="value">{selectedUser.language || "en"}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Joined:</span>
                    <span className="value">
                      {new Date(selectedUser.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">User ID:</span>
                    <span className="value code">{selectedUser.user_id}</span>
                  </div>
                </div>
              </div>

              {/* User Orders */}
              <div className="user-orders-section">
                <h4><ShoppingCart className="inline-block mr-2" size={20} /> Order History ({userOrders.length})</h4>
                {userOrders.length === 0 ? (
                  <p className="empty-message">No orders yet</p>
                ) : (
                  <div className="orders-list-modal">
                    {userOrders.map(order => (
                      <div key={order.checkout_id} className="order-item">
                        <div className="order-info">
                          <strong>Order #{order.checkout_id}</strong>
                          <span className={`status-badge ${order.status}`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="order-details">
                          <span>{parseFloat(order.total).toLocaleString()} XAF</span>
                          <span className="order-date">
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart History */}
              <div className="cart-history-section">
                <h4><ShoppingBag className="inline-block mr-2" size={20} /> Cart Activity (Last 20)</h4>
                {userCartHistory.length === 0 ? (
                  <p className="empty-message">No cart activity</p>
                ) : (
                  <div className="cart-history-list">
                    {userCartHistory.map(item => (
                      <div key={item.history_id} className="cart-history-item">
                        <div className="action-badge">
                          {item.action === "INSERT" ? <Plus size={16} /> : 
                           item.action === "DELETE" ? <Minus size={16} /> : <Edit size={16} />}
                        </div>
                        <div className="cart-info">
                          <span className="product-id">Product #{item.product_id}</span>
                          <span className="quantity">Qty: {item.quantity}</span>
                        </div>
                        <span className="action-time">
                          {new Date(item.action_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
