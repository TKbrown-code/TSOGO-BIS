// src/pages/Orders.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useUserContext } from "../context/useUserContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import { supabase } from "../lib/supabase";
import "../styles/orders.css";
import { Link, useLocation } from "react-router-dom";
import { useModalMessage } from "../context/ModalMessageContext";
import { useTranslation } from "react-i18next";
import { BadgeCheck, CalendarDays, ExternalLink, Package, PackageOpen, Truck } from "lucide-react";

export default function Orders() {
  const { t, i18n } = useTranslation();
  const { profile, user, loading: userLoading } = useUserContext();
  const userId = user?.id || profile?.user_id || null;
  const { showAlert, confirmDialog } = useModalMessage();
  const { convert, currency } = useCurrencyContext();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const location = useLocation();

  const ensureImageUrl = async (product, product_images = []) => {
    const primary = product_images.find((img) => img.is_primary) || product_images[0];
    return primary?.image_url || "/placeholder.png";
  };

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    if (!userId) {
      setOrders([]);
      setLoadError("");
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setLoadError("");
    try {
      // Query checkout rows independently of the nested relation. Older deployed
      // schemas can have a differently named FK, while the order's items JSON is
      // still a complete, safe fallback for rendering.
      const { data, error } = await supabase
        .from("checkouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data || [];
      const checkoutIds = rows.map((order) => order.checkout_id).filter(Boolean);
      let checkoutItemsById = {};
      if (checkoutIds.length) {
        const { data: itemRows, error: itemError } = await supabase
          .from("checkout_items")
          .select("id,checkout_id,product_id,quantity,price,created_at,shipping_method,shipping_fee")
          .in("checkout_id", checkoutIds);
        if (itemError) console.warn("Could not load related checkout items; using saved order snapshots:", itemError);
        else checkoutItemsById = (itemRows || []).reduce((byOrder, item) => {
          (byOrder[item.checkout_id] ||= []).push(item);
          return byOrder;
        }, {});
      }

      const prepared = rows.map((order) => ({
        ...order,
        checkout_items: checkoutItemsById[order.checkout_id] || [],
      }));
      const allProductIds = [...new Set(prepared.flatMap((order) => {
        const snapshotItems = Array.isArray(order.items) ? order.items : typeof order.items === "string" ? (() => { try { return JSON.parse(order.items); } catch { return []; } })() : [];
        const itemRows = order.checkout_items.length ? order.checkout_items : snapshotItems;
        return itemRows.map((item) => item.product_id?.id ?? item.product_id).filter(Boolean);
      }))].filter((id) => typeof id === "number" || (typeof id === "string" && !Number.isNaN(Number(id)))).map(Number);
      const [productsResult, imagesResult] = allProductIds.length ? await Promise.all([
        supabase.from("products").select("id,name,price,weight,category_id(id,name),options,description").in("id", allProductIds),
        supabase.from("product_images").select("product_id,image_url,is_primary").in("product_id", allProductIds),
      ]) : [{ data: [], error: null }, { data: [], error: null }];
      if (productsResult.error) console.warn("Could not load product details for orders:", productsResult.error);
      if (imagesResult.error) console.warn("Could not load order product images:", imagesResult.error);
      const productsById = (productsResult.data || []).reduce((byId, product) => ({ ...byId, [product.id]: product }), {});
      const imagesByProduct = (imagesResult.data || []).reduce((byId, image) => {
        (byId[image.product_id] ||= []).push(image);
        return byId;
      }, {});

      const enriched = await Promise.all(prepared.map(async (order) => {
        const relatedItems = order.checkout_items || [];
        const snapshotItems = Array.isArray(order.items)
          ? order.items
          : typeof order.items === "string"
            ? (() => { try { return JSON.parse(order.items); } catch { return []; } })()
            : [];
        const items = relatedItems.length ? relatedItems : snapshotItems.map((item, index) => ({
          id: `${order.checkout_id}-${index}`,
          checkout_id: order.checkout_id,
          product_id: item.product_id,
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          shipping_method: item.shipping_method || null,
          shipping_fee: Number(item.shipping_fee) || 0,
          snapshot_name: item.name,
        }));
        const itemsWithProducts = await Promise.all(items.map(async (it) => {
          const productId = it.product_id?.id ?? it.product_id;
          const prod = productsById[productId] || null;
          const product_images = imagesByProduct[productId] || [];
          const imageUrl = await ensureImageUrl(prod || {}, product_images);
          return { ...it, product: prod || (it.snapshot_name ? { name: it.snapshot_name } : null), imageUrl };
        }));

        const totalShippingFee = items.reduce((sum, item) => sum + (Number(item.shipping_fee) || 0), 0);

        return { ...order, checkout_items: itemsWithProducts, total_shipping_fee: totalShippingFee };
      }));

      setOrders(enriched);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setLoadError(error.message || "Your orders could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  // Subscribe to checkout changes. Payment confirmation and tracking creation
  // are handled transactionally in the database, not by the customer's browser.
  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      setOrders([]);
      setLoadError("");
      setLoading(false);
      return;
    }
    fetchOrders();

    const channel = supabase
      .channel("checkouts-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkouts" },
        async (payload) => {
          const newRow = payload.new;
          if (newRow && newRow.user_id === userId) {
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
  }, [userLoading, userId, fetchOrders]);

  // The provider redirect returns here with the checkout ID. Verify its status
  // server-side while waiting for the webhook; never trust redirect parameters
  // as proof of payment. Stop after a terminal result or three minutes.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutIdParam = params.get("checkout_id");
    const transactionId = params.get("transId");
    if (!userId || (!checkoutIdParam && !transactionId)) return;
    let active = true;
    let attempts = 0;
    let timer;
    const refreshStatus = async () => {
      if (!active || attempts >= 15) return;
      attempts += 1;
      let checkoutId = checkoutIdParam;
      if (!checkoutId && transactionId) {
        const { data: checkout, error: lookupError } = await supabase
          .from("checkouts")
          .select("checkout_id")
          .eq("user_id", userId)
          .eq("payment_reference", transactionId)
          .maybeSingle();
        if (!active) return;
        if (lookupError || !checkout) {
          if (attempts < 15) timer = window.setTimeout(refreshStatus, 12000);
          return;
        }
        checkoutId = checkout.checkout_id;
      }
      const { data, error } = await supabase.functions.invoke("get-fapshi-checkout-status", {
        body: { checkoutId },
      });
      if (!active) return;
      if (!error && data?.success) {
        await fetchOrders({ silent: true });
        if (["paid", "failed", "expired"].includes(data.status)) return;
      }
      if (attempts < 15) timer = window.setTimeout(refreshStatus, 12000);
    };
    refreshStatus();
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId, location.search, fetchOrders]);

  // ---- cancel order ----
  const cancelOrder = async (orderId) => {
    if (!await confirmDialog(t("orders.cancel_confirm_message"), t("orders.cancel_confirm_title"), { confirmLabel: t("orders.cancel_order"), tone: "warning" })) return;
    const { error } = await supabase
      .from("checkouts")
      .update({ status: "cancelled", delivery_status: "cancelled" })
      .eq("checkout_id", orderId);
    if (error) showAlert(t("orders.cancel_error"), t("orders.cancel_error_title"), "error");
    else fetchOrders();
  };
  
  // ---- re-initiate payment ----
  const payNow = (order) => {
    if (order.payment_url && order.payment_provider === "fapshi") {
      window.location.assign(order.payment_url);
      return;
    }
    showAlert(t("orders.payment_link_unavailable"), t("orders.payment_error_title"), "warning");
  };

  // ---- search filter ----
  const filteredOrders = orders.filter((order) => {
    const q = search.toLowerCase();
    const idMatch = order.checkout_id.toString().includes(q);
    const nameMatch = (order.checkout_items || []).some((i) =>
      i.product?.name?.toLowerCase().includes(q)
    );
    return idMatch || nameMatch;
  });

  const paymentBadge = (status) => {
    switch (status) {
      case "paid":
        return { text: t("orders.payment_completed"), className: "badge-paid" };
      case "pending":
        return { text: t("orders.awaiting_payment"), className: "badge-pending" };
      case "cancelled":
        return { text: t("orders.cancelled"), className: "badge-cancelled" };
      default:
        return { text: status || t("common.unknown"), className: "badge-unknown" };
    }
  };

  const deliveryStepsFor = (delivery_status) => {
    const steps = ["pending", "processing", "shipped", "out_for_delivery", "delivered"];
    const index = Math.max(0, steps.indexOf(delivery_status));
    return steps.map((s, i) => ({ key: s, done: i <= index }));
  };

  return (
    <section className="orders-container-premium">
      <header className="orders-navbar">
        <div className="orders-nav-container">
          <div className="orders-nav-brand">
            <h1>{t("orders.title")}</h1>
            <span className="orders-count">{t("orders.order_count", { count: orders.length })}</span>
          </div>

          <nav className="orders-nav-links">
            <Link to="/orders" className={location.pathname === '/orders' ? 'active' : ''}>
              {t("orders.current")}
            </Link>
          </nav>

          <div className="orders-nav-actions">
            <input
              type="search"
              placeholder={t("orders.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="orders-search"
            />
            <Link to="/" className="back-to-shop">
              {t("orders.back_to_shop")}
            </Link>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="orders-loading">
          <div className="loading-spinner"></div>
          <p>{t("orders.loading")}</p>
        </div>
      ) : loadError ? (
        <div className="orders-load-error" role="alert">
          <h3>{t("orders.load_error_title", { defaultValue: "Your orders could not be loaded" })}</h3>
          <p>{loadError}</p>
          <button type="button" onClick={() => fetchOrders()}>{t("common.retry", { defaultValue: "Try again" })}</button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <span className="empty-icon" aria-hidden="true"><PackageOpen size={27} strokeWidth={1.5} /></span>
          <h3>{t("orders.none_title")}</h3>
          <p>{search ? t("orders.adjust_search") : t("orders.none_copy")}</p>
          <Link to="/" className="shop-now-btn">{t("orders.start_shopping")}</Link>
        </div>
      ) : (
        <div className="orders-grid-premium">
          {filteredOrders.map((order) => {
            const pb = paymentBadge(order.payment_status || order.status);
            const deliverySteps = deliveryStepsFor(order.delivery_status || "pending");
            const canCancel = order.status === "pending" && order.delivery_status === "pending";
            const canPay = order.status === "pending";

            return (
              <article key={order.checkout_id} className="order-card-premium">
                <header className="order-card-header">
                  <div className="header-left">
                    <div className="order-id"><Package size={16} aria-hidden="true" />{t("orders.order_number", { id: order.checkout_id })}</div>
                    <div className="order-date"><CalendarDays size={14} aria-hidden="true" />{new Date(order.created_at).toLocaleDateString({ en: "en-US", fr: "fr-FR", zh: "zh-CN" }[i18n.resolvedLanguage?.slice(0, 2)] || "en-US", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="order-badges">
                    <span className={`payment-badge ${pb.className}`}>{pb.text}</span>
                    {order.tracking_number && (
                      <a className="tracking-btn" href={order.tracking_link || `/track/${encodeURIComponent(order.tracking_number)}`} target="_blank" rel="noreferrer" aria-label={t("orders.track_number", { number: order.tracking_number })}>
                        <Truck size={14} aria-hidden="true" /><span>{order.tracking_number}</span><ExternalLink size={12} aria-hidden="true" />
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
                          alt={it.product?.name || t("product.details")}
                        />
                        <div className="order-item-meta">
                          <div className="order-item-title">{it.product?.name || t("orders.product_number", { id: it.product_id })}</div>
                          <div className="order-item-desc">{it.product?.description?.slice(0, 120) || ""}</div>
                          <div className="order-item-extra">
                            <span>{t("orders.weight")}: {it.product?.weight ?? "—"}</span>
                            <span>
                              {t("orders.shipping")}:{" "}
                              {Number(it.shipping_fee) > 0
                                ? `${convert(it.shipping_fee, currency)} ${currency} ${it.shipping_method ? `(${it.shipping_method})` : ''}`
                                : "—"}
                            </span>
                            {it.product?.category_id?.name && <span>{t("product.category")}: {it.product.category_id.name}</span>}
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
                        <div>{t("orders.total_payment")}</div>
                        <div className="summary-value">{convert(order.total, currency)} {currency}</div>
                      </div>
                      <div className="summary-row">
                        <div>{t("orders.payment_method")}</div>
                        <div className="muted">{order.payment_method || (order.payment_provider === "fapshi" ? t("orders.mobile_payment") : order.payment_provider === "bank" ? t("orders.bank_payment") : t("orders.not_available"))}</div>
                      </div>
                      <div className="summary-row">
                        <div>{t("orders.shipping_payment")}</div>
                        <div className={`summary-value shipping-payment ${order.payment_status === "paid" ? "is-paid" : "is-unpaid"}`}>
                          {Number(order.total_shipping_fee || 0) <= 0
                            ? t("orders.shipping_no_fee")
                            : order.payment_status === "paid"
                              ? t("orders.shipping_paid", { amount: `${convert(order.total_shipping_fee, currency)} ${currency}` })
                              : t("orders.shipping_unpaid")}
                        </div>
                      </div>
                      <div className="summary-row">
                        <div>{t("orders.shipping_method")}</div>
                        <div className="muted">{order['method of shipping'] || order.method_of_shipping || t("orders.standard")}</div>
                      </div>
                      <div className="summary-row">
                        <div>{t("orders.shipping_address")}</div>
                        <div className="muted">{order.address}</div>
                      </div>
                      <div className="summary-row">
                        <div>{t("orders.phone")}</div>
                        <div className="muted">{order.phone_number}</div>
                      </div>
                    </div>

                  </aside>
                </section>
                <section className="order-progress-panel" aria-label={t("orders.delivery_progress", { defaultValue: "Delivery progress" })}>
                  <div className="order-progress-heading"><span><BadgeCheck size={16} aria-hidden="true" />{t("orders.delivery_progress", { defaultValue: "Delivery progress" })}</span>{order.tracking_number && <small>{t("orders.tracking_number", { defaultValue: "Tracking number" })}: <strong>{order.tracking_number}</strong></small>}</div>
                  <div className="delivery-progress">
                    {deliverySteps.map((step, idx) => (
                      <div key={step.key} className={`delivery-step ${step.done ? "done" : ""}`}>
                        <div className="circle">{idx + 1}</div>
                        <div className="step-label">{t(`orders.delivery_${step.key}`, { defaultValue: step.key.replace(/_/g, " ") })}</div>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="order-actions">
                  {canPay && <button className="btn primary" onClick={() => payNow(order)}>{t("orders.pay_now")}</button>}
                  {canCancel && <button className="btn danger" onClick={() => cancelOrder(order.checkout_id)}>{t("orders.cancel_order")}</button>}
                  {order.tracking_number && <a className="btn secondary" href={order.tracking_link || `/track/${encodeURIComponent(order.tracking_number)}`} target="_blank" rel="noreferrer">{t("orders.view_tracking")}</a>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`.navbar{display:none;}`}</style>
    </section>
  );
}
