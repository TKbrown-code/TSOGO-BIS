import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../context/AdminContext";
import { MapPin, Plus, Search, Package, Truck, TruckIcon, CheckCircle, XCircle, Trash2, Eye, Edit } from "lucide-react";
import "../styles/AdminTracking.css";

export default function AdminTracking() {
  const { adminRole } = useAdmin();
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingTracking, setEditingTracking] = useState(null);
  const [orders, setOrders] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    order_id: "",
    tracking_number: "",
    user_name: "",
    total_amount: "",
    shipping_from: "",
    present_location: "",
    status: "in_transit",
    estimated_delivery: "",
    notes: ""
  });

  useEffect(() => {
    fetchTrackings();
    fetchOrders();
  }, []);

  const fetchTrackings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("order_tracking")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTrackings(data || []);
    } catch (error) {
      console.error("Error fetching trackings:", error);
      alert("Failed to load tracking data");
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("checkouts")
        .select("checkout_id, user_name, total, tracking_number")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const handleCreate = () => {
    setEditingTracking(null);
    setFormData({
      order_id: "",
      tracking_number: "",
      user_name: "",
      total_amount: "",
      shipping_from: "",
      present_location: "",
      status: "in_transit",
      estimated_delivery: "",
      notes: ""
    });
    setShowModal(true);
  };

  const handleEdit = (tracking) => {
    setEditingTracking(tracking);
    setFormData({
      order_id: tracking.order_id || "",
      tracking_number: tracking.tracking_number,
      user_name: tracking.user_name,
      total_amount: tracking.total_amount,
      shipping_from: tracking.shipping_from,
      present_location: tracking.present_location,
      status: tracking.status,
      estimated_delivery: tracking.estimated_delivery || "",
      notes: tracking.notes || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.tracking_number || !formData.user_name || !formData.total_amount) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      if (editingTracking) {
        // Update existing
        const { error } = await supabase
          .from("order_tracking")
          .update({
            order_id: formData.order_id || null,
            user_name: formData.user_name,
            total_amount: parseFloat(formData.total_amount),
            shipping_from: formData.shipping_from,
            present_location: formData.present_location,
            status: formData.status,
            estimated_delivery: formData.estimated_delivery || null,
            notes: formData.notes
          })
          .eq("id", editingTracking.id);

        if (error) throw error;
        alert("Tracking updated successfully!");
      } else {
        // Create new
        const { error } = await supabase
          .from("order_tracking")
          .insert({
            order_id: formData.order_id || null,
            tracking_number: formData.tracking_number,
            user_name: formData.user_name,
            total_amount: parseFloat(formData.total_amount),
            shipping_from: formData.shipping_from,
            present_location: formData.present_location,
            status: formData.status,
            estimated_delivery: formData.estimated_delivery || null,
            notes: formData.notes
          });

        if (error) throw error;
        alert("Tracking created successfully!");
      }

      setShowModal(false);
      fetchTrackings();
    } catch (error) {
      console.error("Error saving tracking:", error);
      alert("Failed to save tracking: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this tracking?")) return;

    try {
      const { error } = await supabase
        .from("order_tracking")
        .delete()
        .eq("id", id);

      if (error) throw error;
      alert("Tracking deleted successfully!");
      fetchTrackings();
    } catch (error) {
      console.error("Error deleting tracking:", error);
      alert("Failed to delete tracking: " + error.message);
    }
  };

  const filteredTrackings = trackings.filter(t => {
    const matchesSearch = 
      t.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.present_location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: "#f59e0b", icon: <Package size={16} />, text: "Pending" },
      in_transit: { color: "#3b82f6", icon: <Truck size={16} />, text: "In Transit" },
      out_for_delivery: { color: "#8b5cf6", icon: <TruckIcon size={16} />, text: "Out for Delivery" },
      delivered: { color: "#10b981", icon: <CheckCircle size={16} />, text: "Delivered" },
      failed: { color: "#ef4444", icon: <XCircle size={16} />, text: "Failed" }
    };
    
    const badge = badges[status] || badges.pending;
    
    return (
      <span className="status-badge" style={{ backgroundColor: badge.color }}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  return (
    <div className="admin-tracking">
      <div className="tracking-header">
        <h1><MapPin className="inline-block mr-2" size={28} /> Order Tracking Management</h1>
        <button onClick={handleCreate} className="btn-create">
          <Plus className="inline-block mr-1" size={16} /> Create Tracking
        </button>
      </div>

      <div className="tracking-filters">
        <input
          type="text"
          placeholder="Search by tracking number, name, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="status-filter"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_transit">In Transit</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading trackings...</div>
      ) : (
        <div className="tracking-table-container">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>From</th>
                <th>Current Location</th>
                <th>Status</th>
                <th>Est. Delivery</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrackings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    No tracking records found
                  </td>
                </tr>
              ) : (
                filteredTrackings.map((tracking) => (
                  <tr key={tracking.id}>
                    <td className="tracking-number">
                      <code>{tracking.tracking_number}</code>
                    </td>
                    <td>{tracking.user_name}</td>
                    <td className="amount">{tracking.total_amount} XAF</td>
                    <td>{tracking.shipping_from}</td>
                    <td className="location"><MapPin className="inline-block mr-1" size={14} /> {tracking.present_location}</td>
                    <td>{getStatusBadge(tracking.status)}</td>
                    <td>
                      {tracking.estimated_delivery 
                        ? new Date(tracking.estimated_delivery).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="actions">
                      <button
                        onClick={() => handleEdit(tracking)}
                        className="btn-edit"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(tracking.id)}
                        className="btn-delete"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                      <a
                        href={`/track/${tracking.tracking_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-view"
                        title="View Tracking Page"
                      >
                        <Eye size={16} />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="adtrack-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTracking ? "Edit Tracking" : "Create Tracking"}</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="admin_tracking-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Order ID (Optional)</label>
                  <select
                    value={formData.order_id}
                    onChange={(e) => setFormData({...formData, order_id: e.target.value})}
                  >
                    <option value="">-- Select Order --</option>
                    {orders.map(order => (
                      <option key={order.checkout_id} value={order.checkout_id}>
                        #{order.checkout_id} - {order.user_name} ({order.total} XAF)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tracking Number *</label>
                  <input
                    type="text"
                    value={formData.tracking_number}
                    onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
                    placeholder="e.g., 26-3K3W4X7E"
                    required
                    disabled={editingTracking}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Customer Name *</label>
                  <input
                    type="text"
                    value={formData.user_name}
                    onChange={(e) => setFormData({...formData, user_name: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Total Amount (XAF) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({...formData, total_amount: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Shipping From *</label>
                  <input
                    type="text"
                    value={formData.shipping_from}
                    onChange={(e) => setFormData({...formData, shipping_from: e.target.value})}
                    placeholder="e.g., Douala, Cameroon"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Present Location *</label>
                  <input
                    type="text"
                    value={formData.present_location}
                    onChange={(e) => setFormData({...formData, present_location: e.target.value})}
                    placeholder="e.g., Yaoundé Sorting Center"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="in_transit">In Transit</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Estimated Delivery</label>
                  <input
                    type="date"
                    value={formData.estimated_delivery}
                    onChange={(e) => setFormData({...formData, estimated_delivery: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="3"
                  placeholder="Additional notes about the shipment..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingTracking ? "Update Tracking" : "Create Tracking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
