import { showSiteModal as alert } from "../../utils/siteModal";
// src/admin/AdminOrders.jsx
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { sendOrderStatusNotification } from "../../utils/sendOrderStatusNotification";
import { ShoppingCart, RefreshCw, DollarSign, Search, User, Phone, MapPin, Truck, Link as LinkIcon, Clock, CheckCircle, Package, Mail, CalendarDays, ExternalLink, CreditCard, RotateCcw } from "lucide-react";
import "./AdminOrders.css";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDelivery, setFilterDelivery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [savingOrderId, setSavingOrderId] = useState(null);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("checkouts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading orders:", error);
      setLoadError(error.message || "Orders could not be loaded.");
    } else {
      const rows = data || [];
      const productIds = [...new Set(rows.flatMap((order) => {
        const items = orderItems(order);
        return items.map((item) => item.product_id?.id ?? item.product_id).filter(Boolean);
      }))];
      let imagesByProduct = {};
      if (productIds.length) {
        const { data: images, error: imageError } = await supabase
          .from("product_images")
          .select("product_id,image_url,is_primary")
          .in("product_id", productIds);
        if (imageError) console.warn("Could not load order product images:", imageError);
        imagesByProduct = (images || []).reduce((result, image) => {
          const current = result[image.product_id] || [];
          current.push(image);
          result[image.product_id] = current;
          return result;
        }, {});
      }
      setOrders(rows.map((order) => ({
        ...order,
        items: orderItems(order).map((item) => {
          const productId = item.product_id?.id ?? item.product_id;
          const productImages = imagesByProduct[productId] || [];
          return {
            ...item,
            image_url: item.image_url || item.imageUrl || item.product?.image_url || productImages.find((image) => image.is_primary)?.image_url || productImages[0]?.image_url || "",
          };
        }),
      })));
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    let refreshTimer;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadOrders({ silent: true }), 120);
    };
    const channel = supabase
      .channel("admin-orders-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "checkouts" }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function updateOrderStatus(orderId, status) {
    setSavingOrderId(orderId);
    const { error } = await supabase
      .from("checkouts")
      .update({ status })
      .eq("checkout_id", orderId);

    if (error) {
      alert("Error updating status: " + error.message);
    } else {
      setOrders(current => current.map(o =>
        o.checkout_id === orderId ? { ...o, status } : o
      ));
      const emailError = await sendOrderStatusNotification(orderId, "order", status);
      alert(emailError ? `Status updated, but the customer email failed: ${emailError}` : "Status updated and customer notified by email.");
    }
    setSavingOrderId(null);
  }

  async function updateDeliveryStatus(orderId, deliveryStatus) {
    setSavingOrderId(orderId);
    const { error } = await supabase.rpc("admin_update_shipment_status", {
      p_checkout_id: orderId,
      p_status: deliveryStatus,
    });

    if (error) {
      alert("Error updating delivery status: " + error.message);
    } else {
      setOrders(current => current.map(o =>
        o.checkout_id === orderId ? { ...o, delivery_status: deliveryStatus } : o
      ));
      const emailError = await sendOrderStatusNotification(orderId, "delivery", deliveryStatus);
      alert(emailError ? `Delivery status updated, but the customer email failed: ${emailError}` : "Delivery status updated and customer notified by email.");
    }
    setSavingOrderId(null);
  }

  async function markPaymentComplete(orderId) {
    setSavingOrderId(orderId);
    const { data, error } = await supabase.functions.invoke("admin-mark-checkout-paid", { body: { checkoutId: orderId } });
    if (error || !data?.success) {
      alert("Payment could not be confirmed: " + (data?.error || error?.message || "Please retry."));
    } else {
      setOrders(current => current.map(o => o.checkout_id === orderId ? { ...o, status: "paid", payment_status: "paid", payment_method: "WhatsApp" } : o));
      alert(data.emailSent ? "Payment marked complete and confirmation email sent." : "Payment marked complete.");
    }
    setSavingOrderId(null);
  }

  async function updateTrackingLink(orderId, trackingLink) {
    const cleanLink = trackingLink.trim();
    let trackingNumber = "";
    try {
      const parsedUrl = new URL(cleanLink);
      trackingNumber = decodeURIComponent(parsedUrl.pathname.split("/").filter(Boolean).at(-1) || "");
    } catch {
      trackingNumber = cleanLink.split("/").filter(Boolean).at(-1) || "";
    }
    trackingNumber = trackingNumber.toUpperCase();
    const userIdPrefix = (selectedOrder?.user_id || "00000000").replace(/-/g, "").slice(0, 4).toUpperCase();
    const expectedTrackingNumber = new RegExp(`^TSB${userIdPrefix}[A-Z0-9]{8}$`);
    if (cleanLink && !expectedTrackingNumber.test(trackingNumber)) {
      alert(`Use the tracking format TSB${userIdPrefix} followed by eight random letters or numbers.`);
      return;
    }
    const internalTrackingLink = trackingNumber ? `/track/${trackingNumber}` : null;
    setSavingOrderId(orderId);
    const { error } = await supabase.rpc("admin_update_checkout_tracking", {
      p_checkout_id: orderId,
      p_tracking_number: trackingNumber || null,
    });

    if (error) {
      alert("Error updating tracking link: " + error.message);
    } else {
      setOrders(current => current.map(o =>
        o.checkout_id === orderId ? { ...o, tracking_link: internalTrackingLink, tracking_number: trackingNumber || null } : o
      ));
      setSelectedOrder(null);
      alert("Tracking link updated successfully!");
    }
    setSavingOrderId(null);
  }

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const query = searchQuery.trim().toLowerCase();
    // Customers see order numbers formatted as "Order #123". Accept that
    // exact text as well as the bare number in the admin order search.
    const normalizedOrderQuery = query.replace(/^order\s*/, "").replace(/^#/, "").trim();
    const orderNumber = String(order.checkout_id ?? order.id ?? "").toLowerCase();
    const matchesSearch = !query ||
      (order.user_name?.toLowerCase().includes(query) || false) ||
      (order.email?.toLowerCase().includes(query) || false) ||
      (order.phone_number?.includes(searchQuery.trim()) || false) ||
      orderNumber.includes(normalizedOrderQuery) ||
      (order.tracking_number?.toLowerCase().includes(query) || false);
    const matchesStatus = !filterStatus || order.status === filterStatus;
    const matchesDelivery = !filterDelivery || order.delivery_status === filterDelivery;
    return matchesSearch && matchesStatus && matchesDelivery;
  });

  // Statistics
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    processing: orders.filter(o => o.status === "processing").length,
    completed: orders.filter(o => ["completed", "paid"].includes((o.payment_status || o.status || "").toLowerCase())).length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
    totalRevenue: orders.filter(o => ["completed", "paid"].includes((o.payment_status || o.status || "").toLowerCase())).reduce((sum, o) => sum + Number.parseFloat(o.total || 0), 0)
  };

  const orderItems = (order) => {
    if (Array.isArray(order.items)) return order.items;
    if (typeof order.items === "string") {
      try { const parsed = JSON.parse(order.items); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return Array.isArray(order.checkout_items) ? order.checkout_items : [];
  };

  const money = (amount) => `${Number.parseFloat(amount || 0).toLocaleString()} XAF`;
  const titleCase = (value) => String(value || "pending").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <main className="admin-orders">
      <header className="orders-page-heading">
        <div><span className="orders-kicker">COMMERCE OPERATIONS</span><h1>Orders</h1><p>Review payments, prepare deliveries, and keep every customer order moving.</p></div>
        <button type="button" className="orders-refresh" onClick={loadOrders} disabled={loading}><RotateCcw size={15} className={loading ? "is-spinning" : ""} />Refresh orders</button>
      </header>

      <section className="orders-stats" aria-label="Order summary">
        <article className="orders-stat"><span className="orders-stat-icon"><Package size={18} /></span><div><strong>{stats.total}</strong><small>Total orders</small></div><span className="orders-stat-note">All time</span></article>
        <article className="orders-stat is-pending"><span className="orders-stat-icon"><Clock size={18} /></span><div><strong>{stats.pending}</strong><small>Awaiting action</small></div></article>
        <article className="orders-stat is-processing"><span className="orders-stat-icon"><RefreshCw size={18} /></span><div><strong>{stats.processing}</strong><small>Processing</small></div></article>
        <article className="orders-stat is-complete"><span className="orders-stat-icon"><CheckCircle size={18} /></span><div><strong>{stats.completed}</strong><small>Paid orders</small></div></article>
        <article className="orders-stat is-revenue"><span className="orders-stat-icon"><DollarSign size={18} /></span><div><strong>{money(stats.totalRevenue)}</strong><small>Paid revenue</small></div></article>
      </section>

      <section className="orders-workspace">
        <div className="orders-toolbar">
          <div className="orders-toolbar-copy"><h2>Order queue</h2><p>{filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"} shown</p></div>
          <div className="orders-filters">
            <label className="orders-search"><Search size={16} /><input type="search" aria-label="Search orders" placeholder="Name, email, phone, order or tracking number" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></label>
            <select aria-label="Filter order status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">All order statuses</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select>
            <select aria-label="Filter delivery status" value={filterDelivery} onChange={e => setFilterDelivery(e.target.value)}><option value="">All deliveries</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="in_transit">In transit</option><option value="out_for_delivery">Out for delivery</option><option value="delivered">Delivered</option></select>
            {(searchQuery || filterStatus || filterDelivery) && <button type="button" className="orders-clear" onClick={() => { setSearchQuery(""); setFilterStatus(""); setFilterDelivery(""); }}>Clear filters</button>}
          </div>
        </div>

        {loadError && <div className="orders-error" role="alert"><p>Orders could not be loaded. {loadError}</p><button type="button" onClick={loadOrders}>Try again</button></div>}
        {loading ? <div className="orders-loading-grid" aria-label="Loading orders">{Array.from({ length: 3 }, (_, index) => <div className="orders-loading-card" key={index}><i /><i /><i /><b /></div>)}</div> : !loadError && filteredOrders.length === 0 ? (
          <div className="orders-empty"><span><ShoppingCart size={22} /></span><h3>{orders.length ? "No matching orders" : "No orders yet"}</h3><p>{orders.length ? "Change or clear your filters to see other orders." : "New customer orders will appear here."}</p>{orders.length > 0 && <button type="button" onClick={() => { setSearchQuery(""); setFilterStatus(""); setFilterDelivery(""); }}>Clear filters</button>}</div>
        ) : !loadError && <div className="orders-card-list">
          {filteredOrders.map((order) => {
            const id = order.checkout_id ?? order.id;
            const items = orderItems(order);
            const paymentStatus = (order.payment_status || order.status || "pending").toLowerCase();
            const customerName = order.user_name || order.username || "Guest customer";
            const orderStatus = (order.status || "pending").toLowerCase();
            const rawDeliveryStatus = (order.delivery_status || "pending").toLowerCase();
            const deliveryStatus = rawDeliveryStatus === "shipped" ? "in_transit" : rawDeliveryStatus;
            return <article className="admin-order-card" key={id}>
              <header className="admin-order-card-header"><div><span className="order-reference">ORDER ID <b>#{id}</b></span><span className="order-created"><CalendarDays size={13} />{order.created_at ? new Date(order.created_at).toLocaleString() : "Date unavailable"}</span></div><div className="order-status-stack"><span className={`order-pill order-${orderStatus}`}>{titleCase(orderStatus)}</span><span className={`order-pill payment-${paymentStatus}`}>{paymentStatus === "paid" || paymentStatus === "completed" ? "Payment received" : `Payment ${titleCase(paymentStatus).toLowerCase()}`}</span></div></header>
              <div className="admin-order-card-content">
                <section className="order-customer-block"><span className="order-block-label">CUSTOMER</span><strong><User size={15} />{customerName}</strong>{order.email && <span><Mail size={14} />{order.email}</span>}{order.phone_number && <span><Phone size={14} />{order.phone_number}</span>}<span className="order-address"><MapPin size={14} />{order.address || "No delivery address"}</span></section>
                <section className="order-products-block"><span className="order-block-label">ITEMS · {items.length}</span>{items.length ? <div className="order-product-list">{items.slice(0, 3).map((item, index) => <div className="order-product-line" key={`${item.product_id || item.id || item.name}-${index}`}><span className="order-product-image">{item.image_url ? <img src={item.image_url} alt={item.name || "Ordered product"} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false; }} /> : null}<Package size={17} aria-hidden="true" hidden={Boolean(item.image_url)} /></span><span className="order-product-quantity">×{item.quantity || 1}</span><span className="order-product-name">{item.name || `Product #${item.product_id || "—"}`}{(item.option || item.size || item.color) && <small>{item.option || [item.color, item.size].filter(Boolean).join(" · ")}</small>}</span><strong>{money(item.totalPrice ?? (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)))}</strong></div>)}{items.length > 3 && <small className="order-more-items">+{items.length - 3} more items</small>}</div> : <p className="order-no-items">Item details unavailable</p>}</section>
                <section className="order-total-block"><span className="order-block-label">ORDER TOTAL</span><strong>{money(order.total)}</strong>{Number(order.shipping_due_on_delivery) > 0 && <span className="order-payment-method">Delivery due on arrival: {money(order.shipping_due_on_delivery)}</span>}<span className="order-payment-method"><CreditCard size={14} />{titleCase(order.payment_method || order.payment_provider || "Payment method pending")}</span>{order.tracking_number && <a href={order.tracking_link || `/track/${encodeURIComponent(order.tracking_number)}`} target={order.tracking_link ? "_blank" : undefined} rel={order.tracking_link ? "noreferrer" : undefined} className="order-tracking-number"><Truck size={14} />{order.tracking_number}<ExternalLink size={12} /></a>}</section>
              </div>
              <footer className="admin-order-card-actions"><label><span>Order</span><select value={orderStatus} disabled={savingOrderId === id} onChange={e => updateOrderStatus(id, e.target.value)}><option value="pending">Pending</option><option value="pending_payment">Awaiting payment</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></label><label><span>Delivery · 5 steps</span><select value={deliveryStatus} disabled={savingOrderId === id} onChange={e => updateDeliveryStatus(id, e.target.value)}><option value="pending">Pending</option><option value="processing">Processing</option><option value="in_transit">In transit</option><option value="out_for_delivery">Out for delivery</option><option value="delivered">Delivered</option></select></label>{paymentStatus !== "paid" && <button type="button" className="order-tracking-action" disabled={savingOrderId === id} onClick={() => markPaymentComplete(id)}><CheckCircle size={15} />Mark payment complete</button>}<button type="button" className="order-tracking-action" disabled={savingOrderId === id} onClick={() => setSelectedOrder(order)}><LinkIcon size={15} />{order.tracking_link ? "Edit tracking" : "Add tracking"}</button></footer>
            </article>;
          })}
        </div>}
      </section>

      {selectedOrder && <div className="orders-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}><section className="orders-tracking-modal" role="dialog" aria-modal="true" aria-labelledby="tracking-modal-title"><header><div><span className="orders-kicker">DELIVERY DETAILS</span><h2 id="tracking-modal-title">Tracking link</h2><p>Order #{selectedOrder.checkout_id ?? selectedOrder.id}</p></div><button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close tracking dialog">×</button></header><label className="tracking-link-field">Public tracking URL<input type="url" placeholder={`https://your-store.com/track/TSB${(selectedOrder.user_id || "00000000").replace(/-/g, "").slice(0, 4).toUpperCase()}XXXXXXXX`} defaultValue={selectedOrder.tracking_link || ""} onKeyDown={e => { if (e.key === "Enter") updateTrackingLink(selectedOrder.checkout_id ?? selectedOrder.id, e.currentTarget.value); }} /></label><p className="tracking-hint">Tracking numbers use TSB, the first four characters of the customer ID, and eight random letters or numbers.</p><footer><button type="button" onClick={() => setSelectedOrder(null)} className="orders-modal-cancel">Cancel</button><button type="button" disabled={savingOrderId === (selectedOrder.checkout_id ?? selectedOrder.id)} onClick={(event) => { const input = event.currentTarget.closest(".orders-tracking-modal").querySelector("input"); updateTrackingLink(selectedOrder.checkout_id ?? selectedOrder.id, input.value); }} className="orders-modal-save">Save tracking</button></footer></section></div>}
    </main>
  );
}
