// src/pages/Orders.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useUserContext } from "../context/useUserContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import { supabase } from "../lib/supabase";
import { getCachedImage, fetchFromSupabase, cache as imageCache } from "../utils/imageCache";
import "../styles/orders.css";
import { Link, useLocation } from "react-router-dom";
import { SUPABASE_ANON_KEY } from "../lib/constants";

export default function Orders() {
  const { profile } = useUserContext();
  const { convert, currency } = useCurrencyContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const location = useLocation();

  // Helper: generate a unique tracking code
  const genTrackingCode = useCallback((checkoutId) => {
    const randomNumbers = Math.floor(1000 + Math.random() * 9000);
    return `TSB${randomNumbers}${checkoutId}`;
  }, []);

  const buildTrackingLink = useCallback((trackingCode) => {
    return `${window.location.origin}/track/${trackingCode}`;
  }, []);

  const ensureImageUrl = async (product, product_images = []) => {
    const primary = product_images.find((img) => img.is_primary) || product_images[0];
    if (!primary?.image_path) return "/placeholder.png";
    const cached = getCachedImage(primary.image_path);
    if (cached && cached !== "/placeholder.png") return cached;
    const url = primary.image_path;  
    return url;
  };

  const fetchOrders = useCallback(async () => {
    if (!profile?.user_id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("checkouts")
      .select(`
        *,
        checkout_items!checkout_items_checkout_id_fkey(
          id, checkout_id, product_id, quantity, price, created_at, shipping_method, shipping_fee
        )
      `)
      .eq("user_id", profile.user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      (data || []).map(async (order) => {
        const items = order.checkout_items || [];
        const productIds = [...new Set(items.map((it) => it.product_id).filter(Boolean))].filter(id => typeof id === 'number' || (typeof id === 'string' && !isNaN(Number(id)))).map(id => Number(id));
        let productsById = {};

        if (productIds.length) {
          try {
            const { data: productsData, error: productsError } = await supabase
              .from("products")
              .select(`id, name, price, weight, category_id(id, name), options, description`)
              .in("id", productIds);
            if (!productsError) {
              productsById = (productsData || []).reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
              }, {});
            } else {
              console.error("Error fetching products:", productsError);
            }
          } catch (err) {
            console.error("Exception fetching products:", err);
          }
        }

        let imagesByProduct = {};
        if (productIds.length) {
          const { data: piData } = await supabase
            .from("product_images")
            .select("product_id, image_path, is_primary")
            .in("product_id", productIds);
          if (piData) {
            imagesByProduct = piData.reduce((acc, row) => {
              acc[row.product_id] = acc[row.product_id] || [];
              acc[row.product_id].push({ image_path: row.image_path, is_primary: row.is_primary });
              return acc;
            }, {});
          }
        }

        const itemsWithProducts = await Promise.all(
          items.map(async (it) => {
            const prod = productsById[it.product_id] || null;
            const product_images = imagesByProduct[it.product_id] || [];
            const imageUrl = await ensureImageUrl(prod || {}, product_images);
            return { ...it, product: prod, imageUrl };
          })
        );

        const totalShippingFee = items.reduce((sum, item) => sum + (item.shipping_fee || 0), 0);

        return { ...order, checkout_items: itemsWithProducts, total_shipping_fee: totalShippingFee };
      })
    );

    setOrders(enriched);
    setLoading(false);
  }, [profile]);

  // subscribe + auto-generate tracking
  useEffect(() => {
    if (!profile?.user_id) return;
    fetchOrders();

    const channel = supabase
      .channel("checkouts-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkouts" },
        async (payload) => {
          const newRow = payload.new;
          const oldRow = payload.old;
          if (newRow && newRow.user_id === profile.user_id) {
            const becameProcessing =
              oldRow?.delivery_status !== "processing" && newRow.delivery_status === "processing";
            
            console.log("Order update received:", {
              checkout_id: newRow.checkout_id,
              oldStatus: oldRow?.delivery_status,
              newStatus: newRow.delivery_status,
              becameProcessing,
              hasTrackingLink: !!newRow.tracking_link,
              userId: profile.user_id
            });
            
            if (becameProcessing && !newRow.tracking_link) {
              const trackingCode = genTrackingCode(newRow.checkout_id);
              const trackingUrl = buildTrackingLink(trackingCode);
              console.log("Attempting to update tracking:", {
                checkout_id: newRow.checkout_id,
                trackingCode,
                trackingUrl
              });
              
              try {
                const { error } = await supabase
                  .from("checkouts")
                  .update({ tracking_link: trackingUrl, tracking_number: trackingCode })
                  .eq("checkout_id", newRow.checkout_id);
                
                if (error) {
                  console.error("Failed to update tracking info:", error);
                } else {
                  console.log("Successfully updated tracking info");
                  newRow.tracking_link = trackingUrl;
                  newRow.tracking_number = trackingCode;
                  // Refresh orders to get the latest data from database
                  fetchOrders();
                }
              } catch (err) {
                console.error("Exception during tracking update:", err);
              }
            }
            setOrders((prev) => {
              const exists = prev.some((o) => o.checkout_id === newRow.checkout_id);
              return exists
                ? prev.map((o) => (o.checkout_id === newRow.checkout_id ? { ...o, ...newRow } : o))
                : [newRow, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchOrders, buildTrackingLink, genTrackingCode]);

  // ---- cancel order ----
  const cancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    const { error } = await supabase
      .from("checkouts")
      .update({ status: "cancelled", delivery_status: "cancelled" })
      .eq("checkout_id", orderId);
    if (error) alert("Failed to cancel order: " + error.message);
    else fetchOrders();
  };
  
  // ---- re-initiate payment ----
  const payNow = async (order) => {
    try {
      const res = await fetch(
        "https://gidifmqzolmrqpywpimw.supabase.co/functions/v1/create-campay-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, },
          body: JSON.stringify({
            checkoutId: order.checkout_id,
            name: order.user_name,
            phone: order.phone_number,
            amount: order.total,
          }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        alert("Redirecting to payment...");
        window.location.href = data.payment_url;
      } else {
        console.error("Payment initiation failed:", data);
        alert("Failed to initiate payment.");
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert("An error occurred while starting payment.");
    }
  };

  // ---- search filter ----
  const filteredOrders = orders.filter((order) => {
    const q = search.toLowerCase();
    const idMatch = order.checkout_id.toString().includes(q);
    const nameMatch = order.checkout_items.some((i) =>
      i.product?.name?.toLowerCase().includes(q)
    );
    return idMatch || nameMatch;
  });

  const paymentBadge = (status) => {
    switch (status) {
      case "paid":
        return { text: "payment Completed", className: "badge-paid" };
      case "pending":
        return { text: "Awaiting payment", className: "badge-pending" };
      case "cancelled":
        return { text: "Cancelled", className: "badge-cancelled" };
      default:
        return { text: status || "Unknown", className: "badge-unknown" };
    }
  };

  const deliveryStepsFor = (delivery_status) => {
    const steps = ["pending", "processing", "shipped", "out_for_delivery", "delivered"];
    const index = Math.max(0, steps.indexOf(delivery_status));
    return steps.map((s, i) => ({ key: s, done: i <= index }));
  };

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    completed: orders.filter(o => o.status === 'paid').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  return (
    <section className="orders-container-premium">
      <header className="orders-navbar">
        <div className="orders-nav-container">
          <div className="orders-nav-brand">
            <h1>Order Management</h1>
            <span className="orders-count">{orderStats.total} {orderStats.total === 1 ? 'Order' : 'Orders'}</span>
          </div>

          <nav className="orders-nav-links">
            <Link to="/orders" className={location.pathname === '/orders' ? 'active' : ''}>
              Current Orders
            </Link>
            <Link to="/orders/history" className={location.pathname.includes('history') ? 'active' : ''}>
              Order History
            </Link>
            <Link to="/orders/returns" className={location.pathname.includes('returns') ? 'active' : ''}>
              Returns
            </Link>
          </nav>

          <div className="orders-nav-actions">
            <input
              type="search"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="orders-search"
            />
            <Link to="/" className="back-to-shop">
              Back to Shop
            </Link>
          </div>
        </div>
      </header>

      {/* Order Stats */}
      <div className="order-stats">
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-info">
            <span className="stat-value">{orderStats.total}</span>
            <span className="stat-label">Total Orders</span>
          </div>
        </div>
        <div className="stat-card pending">
          <span className="stat-icon">⏳</span>
          <div className="stat-info">
            <span className="stat-value">{orderStats.pending}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
        <div className="stat-card completed">
          <span className="stat-icon">✅</span>
          <div className="stat-info">
            <span className="stat-value">{orderStats.completed}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
        <div className="stat-card cancelled">
          <span className="stat-icon">❌</span>
          <div className="stat-info">
            <span className="stat-value">{orderStats.cancelled}</span>
            <span className="stat-label">Cancelled</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="orders-loading">
          <div className="loading-spinner"></div>
          <p>Loading your orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <span className="empty-icon">📭</span>
          <h3>No orders found</h3>
          <p>{search ? 'Try adjusting your search terms' : 'Start shopping to see your orders here'}</p>
          <Link to="/" className="shop-now-btn">Start Shopping</Link>
        </div>
      ) : (
        <div className="orders-grid-premium">
          {filteredOrders.map((order) => {
            const pb = paymentBadge(order.status);
            const deliverySteps = deliveryStepsFor(order.delivery_status || "pending");
            const canCancel = order.status === "pending" && order.delivery_status === "pending";
            const canPay = order.status === "pending";

            return (
              <article key={order.checkout_id} className="order-card-premium">
                <header className="order-card-header">
                  <div className="header-left">
                    <div className="order-id">🔖 Order #{order.checkout_id}</div>
                    <div className="order-date">📅 {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="order-badges">
                    <span className={`payment-badge ${pb.className}`}>{pb.text}</span>
                    {order.tracking_number && (
                      <a className="tracking-btn" href={order.tracking_link} target="_blank" rel="noreferrer" onClick={(e) => console.log("Tracking link clicked:", order.tracking_link)}>
                        📍 {order.tracking_number}
                      </a>
                    )}
                  </div>
                </header>

                <section className="order-content">
                  <div className="order-items-column">
                    {order.checkout_items?.map((it) => (
                      <div className="order-item-row" key={it.id}>
                        <img
                          className="order-item-image"
                          src={it.imageUrl || "/placeholder.png"}
                          alt={it.product?.name || "Product"}
                        />
                        <div className="order-item-meta">
                          <div className="order-item-title">{it.product?.name || `Product #${it.product_id}`}</div>
                          <div className="order-item-desc">{it.product?.description?.slice(0, 120) || ""}</div>
                          <div className="order-item-extra">
                            <span>Weight: {it.product?.weight ?? "—"}</span>
                            <span>
                              Shipping:{" "}
                              {it.shipping_fee
                                ? `${convert(it.shipping_fee, currency)} ${currency} ${it.shipping_method ? `(${it.shipping_method})` : ''}`
                                : "—"}
                            </span>
                            <span>Category: {it.product?.category_id?.name ?? "—"}</span>
                          </div>
                        </div>
                        <div className="order-item-pricing">
                          <div>{convert(it.price * it.quantity, currency)} {currency}</div>
                          <div className="muted">({it.quantity} × {convert(it.price, currency)})</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <aside className="order-sidebar">
                    <div className="order-summary">
                      <div className="summary-row">
                        <div>Total payment...</div>
                        <div className="summary-value">{convert(order.total, currency)} {currency}</div>
                      </div>
                      <div className="summary-row">
                        <div>Shipping Fee...</div>
                        <div className="summary-value">{convert(order.total_shipping_fee || 0, currency)} {currency}</div>
                      </div>
                      <div className="summary-row">
                        <div>Shipping Method...</div>
                        <div className="muted">{order['method of shipping'] || order.method_of_shipping || 'Standard'}</div>
                      </div>
                      <div className="summary-row">
                        <div>Shipping Address...</div>
                        <div className="muted">{order.address}</div>
                      </div>
                      <div className="summary-row">
                        <div>Phone number...</div>
                        <div className="muted">{order.phone_number}</div>
                      </div>
                    </div>

                    <div className="delivery-progress">
                      {deliverySteps.map((step, idx) => (
                        <div key={step.key} className={`delivery-step ${step.done ? "done" : ""}`}>
                          <div className="circle">{idx + 1}</div>
                          <div className="step-label">{step.key.replace(/_/g, " ")}</div>
                        </div>
                      ))}
                    </div>

                    <div className="order-actions">
                      {canPay && (
                        <button className="btn primary" onClick={() => payNow(order)}>Pay Now</button>
                      )}
                      {canCancel && (
                        <button className="btn danger" onClick={() => cancelOrder(order.checkout_id)}>Cancel Order</button>
                      )}
                      {order.tracking_number && (
                        <a className="btn secondary" style={{background:"#FF5733", color:"white"}} href={order.tracking_link} target="_blank" rel="noreferrer" onClick={(e) => console.log("Track button clicked:", order.tracking_link)}>Track {order.tracking_number}</a>
                      )}
                    </div>
                  </aside>
                </section>
              </article>
            );
          })}
        </div>
      )}

      <style>{`.navbar{display:none;}`}</style>
    </section>
  );
}
