import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CalendarDays, CheckCircle2, Clock3, Mail, Phone, Search, ShieldCheck, ShoppingBag, UserRound, Users, X, RefreshCw, ExternalLink } from "lucide-react";
import "./AdminUsers.css";

const formatMoney = (amount) => `${Number(amount || 0).toLocaleString()} XAF`;
const formatDate = (value, options = { year: "numeric", month: "short", day: "numeric" }) => value ? new Date(value).toLocaleDateString(undefined, options) : "—";
const parseItems = (items) => {
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try { const parsed = JSON.parse(items); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      console.error("Error loading admin user directory:", error);
      setLoadError(error.message || "The user directory could not be loaded.");
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function viewUserDetails(user) {
    setSelectedUser(user);
    setDetailsLoading(true);
    const { data, error } = await supabase.from("checkouts").select("checkout_id,total,status,payment_status,payment_method,delivery_status,tracking_number,tracking_link,items,created_at").eq("user_id", user.user_id).order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading user orders:", error);
      setUserOrders([]);
    } else {
      setUserOrders(data || []);
    }
    setDetailsLoading(false);
  }

  const filteredUsers = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !needle || [user.display_name, user.email, user.phone, user.user_id].some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesRole = roleFilter === "all" || (roleFilter === "admins" ? user.is_admin : !user.is_admin);
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return {
      total: users.length,
      newUsers: users.filter((user) => new Date(user.created_at).getTime() >= thirtyDaysAgo).length,
      customers: users.filter((user) => !user.is_admin).length,
      paidRevenue: users.reduce((sum, user) => sum + Number(user.paid_total || 0), 0),
    };
  }, [users]);

  return (
    <main className="admin-users-page">
      <header className="admin-users-heading">
        <div><span className="admin-users-eyebrow">CUSTOMER RELATIONSHIPS</span><h1>Users</h1><p>Explore customer accounts, order activity, and account preferences.</p></div>
        <button type="button" className="users-refresh-button" onClick={loadUsers} disabled={loading}><RefreshCw size={15} className={loading ? "users-spin" : ""} />Refresh directory</button>
      </header>

      <section className="admin-users-summary" aria-label="User summary">
        <article><span className="users-summary-icon"><Users size={18} /></span><div><strong>{stats.total}</strong><small>Registered accounts</small></div></article>
        <article><span className="users-summary-icon is-new"><CalendarDays size={18} /></span><div><strong>{stats.newUsers}</strong><small>Joined in 30 days</small></div></article>
        <article><span className="users-summary-icon is-customer"><UserRound size={18} /></span><div><strong>{stats.customers}</strong><small>Customer accounts</small></div></article>
        <article><span className="users-summary-icon is-revenue"><CheckCircle2 size={18} /></span><div><strong>{formatMoney(stats.paidRevenue)}</strong><small>Paid order value</small></div></article>
      </section>

      <section className="admin-users-workspace">
        <header className="admin-users-toolbar">
          <div><h2>Account directory</h2><p>{filteredUsers.length} {filteredUsers.length === 1 ? "account" : "accounts"} shown</p></div>
          <div className="admin-users-filters">
            <label className="users-search"><Search size={16} /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, email, phone or ID" aria-label="Search users" /></label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter account type"><option value="all">All accounts</option><option value="customers">Customers</option><option value="admins">Admins</option></select>
          </div>
        </header>

        {loadError && <div className="admin-users-state is-error" role="alert"><p>Could not load users. {loadError}</p><button type="button" onClick={loadUsers}>Try again</button></div>}
        {loading ? <div className="admin-users-loading" aria-label="Loading users">{[0, 1, 2, 3].map((item) => <i key={item} />)}</div> : !loadError && filteredUsers.length === 0 ? (
          <div className="admin-users-state"><span><Users size={22} /></span><h3>{users.length ? "No matching accounts" : "No accounts yet"}</h3><p>{users.length ? "Try another search or account filter." : "New customer accounts will appear here."}</p></div>
        ) : !loadError && <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th>Account</th><th>Contact</th><th>Orders</th><th>Paid value</th><th>Language</th><th>Joined</th><th /></tr></thead><tbody>
          {filteredUsers.map((user) => <tr key={user.user_id}>
            <td><div className="admin-user-identity"><span className="admin-user-avatar">{(user.display_name || user.email || "?").charAt(0).toUpperCase()}</span><span><strong>{user.display_name || "Customer"}</strong><small>{user.is_admin ? <><ShieldCheck size={12} />Administrator</> : "Customer"}</small></span></div></td>
            <td><div className="admin-user-contact">{user.email && <span><Mail size={13} />{user.email}</span>}{user.phone && <span><Phone size={13} />{user.phone}</span>}</div></td>
            <td><span className="users-order-count">{user.order_count || 0}</span></td>
            <td className="users-paid-total">{formatMoney(user.paid_total)}</td>
            <td><span className="users-language">{String(user.preferred_language || "fr").toUpperCase()}</span></td>
            <td>{formatDate(user.created_at)}</td>
            <td><button type="button" className="users-view-button" onClick={() => viewUserDetails(user)}>View account</button></td>
          </tr>)}
        </tbody></table></div>}
      </section>

      {selectedUser && <div className="admin-user-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUser(null); }}><section className="admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-modal-title">
        <header><div><span className="admin-users-eyebrow">ACCOUNT PROFILE</span><h2 id="admin-user-modal-title">{selectedUser.display_name || "Customer"}</h2><p>{selectedUser.email || "No email address"}</p></div><button type="button" aria-label="Close account details" onClick={() => setSelectedUser(null)}><X size={18} /></button></header>
        <div className="admin-user-profile-grid">
          <div><span>PHONE</span><strong>{selectedUser.phone || "Not provided"}</strong></div><div><span>LANGUAGE</span><strong>{String(selectedUser.preferred_language || "fr").toUpperCase()}</strong></div>
          <div><span>JOINED</span><strong>{formatDate(selectedUser.created_at)}</strong></div><div><span>ACCOUNT ID</span><strong className="admin-user-id">{selectedUser.user_id}</strong></div>
          <div><span>ORDER COUNT</span><strong>{selectedUser.order_count || 0}</strong></div><div><span>PAID ORDER VALUE</span><strong>{formatMoney(selectedUser.paid_total)}</strong></div>
        </div>
        <section className="admin-user-order-history"><div className="admin-user-order-heading"><div><h3>Order history</h3><p>{userOrders.length} {userOrders.length === 1 ? "order" : "orders"}</p></div><ShoppingBag size={18} /></div>
          {detailsLoading ? <div className="admin-user-orders-loading"><i /><i /></div> : userOrders.length ? <div className="admin-user-orders-list">{userOrders.map((order) => <article key={order.checkout_id}>
            <div className="admin-user-order-top"><strong>Order #{order.checkout_id}</strong><span className={`admin-user-order-status status-${String(order.payment_status || order.status || "pending").toLowerCase()}`}>{String(order.payment_status || order.status || "pending").replaceAll("_", " ")}</span></div>
            <div className="admin-user-order-items">{parseItems(order.items).map((item, index) => <span key={`${item.product_id || item.name}-${index}`}>{item.name || `Product #${item.product_id || "—"}`} × {item.quantity || 1}</span>)}</div>
            <div className="admin-user-order-bottom"><strong>{formatMoney(order.total)}</strong><span>{formatDate(order.created_at)}</span>{order.tracking_number && <a href={order.tracking_link || `/track/${encodeURIComponent(order.tracking_number)}`} target="_blank" rel="noreferrer">Track shipment <ExternalLink size={12} /></a>}</div>
          </article>)}</div> : <div className="admin-user-empty-orders"><ShoppingBag size={19} /><span>No orders placed yet.</span></div>}
        </section>
      </section></div>}
    </main>
  );
}
