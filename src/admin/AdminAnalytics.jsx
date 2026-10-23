import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, BarChart3, Check, Clock3, Package, RefreshCw, ShoppingBag, Trophy, XCircle } from "lucide-react";
import "../styles/AdminAnalytics.css";

const paidStates = new Set(["paid", "completed", "success", "successful"]);
const currency = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const formatXaf = (amount) => `${currency.format(Number(amount) || 0)} XAF`;
const paymentState = (order) => String(order.payment_status || order.status || "pending").toLowerCase();

function readItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

function buildBuckets(orders, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  if (days <= 30) {
    for (let offset = days - 1; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(date.getDate() - offset);
      buckets.push({ key: date.toLocaleDateString(), label: date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }), revenue: 0, orders: 0 });
    }
  } else if (days === 90) {
    for (let index = 12; index >= 0; index--) {
      const start = new Date(today);
      start.setDate(start.getDate() - index * 7 - 6);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      buckets.push({ key: start.toISOString(), start, end, label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), revenue: 0, orders: 0 });
    }
  } else {
    for (let index = 11; index >= 0; index--) {
      const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      buckets.push({ key: date.toISOString(), start: date, end, label: date.toLocaleDateString(undefined, { month: "short" }), revenue: 0, orders: 0 });
    }
  }
  const byDate = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  orders.forEach((order) => {
    if (!paidStates.has(paymentState(order))) return;
    const date = new Date(order.created_at);
    let bucket;
    if (days <= 30) bucket = byDate.get(date.toLocaleDateString());
    else bucket = buckets.find((candidate) => date >= candidate.start && date < candidate.end);
    if (bucket) {
      bucket.revenue += Number(order.amount_due ?? order.total ?? 0);
      bucket.orders += 1;
    }
  });
  return buckets;
}

function TrendChart({ buckets }) {
  const width = 760;
  const height = 250;
  const top = 18;
  const bottom = 24;
  const maxRevenue = Math.max(...buckets.map((item) => item.revenue), 1);
  const maxOrders = Math.max(...buckets.map((item) => item.orders), 1);
  const step = width / buckets.length;
  const barWidth = Math.min(22, step * 0.56);
  const points = buckets.map((item, index) => ({
    x: index * step + step / 2,
    y: height - bottom - (item.orders / maxOrders) * (height - top - bottom),
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const tickCount = buckets.length <= 7 ? buckets.length : 6;
  const labels = Array.from({ length: tickCount }, (_, index) => Math.round(index * (buckets.length - 1) / Math.max(tickCount - 1, 1)));
  return (
    <div className="analytics-chart" role="img" aria-label="Paid revenue and paid order trend">
      <div className="analytics-chart-grid"><i /><i /><i /><i /></div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {buckets.map((item, index) => {
          const barHeight = item.revenue ? Math.max(3, (item.revenue / maxRevenue) * (height - top - bottom)) : 0;
          return <rect key={item.key} x={index * step + (step - barWidth) / 2} y={height - bottom - barHeight} width={barWidth} height={barHeight} rx="4" fill="#d8e3da"><title>{item.label}: {formatXaf(item.revenue)} revenue</title></rect>;
        })}
        <path d={line} fill="none" stroke="#315b47" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => <circle key={buckets[index].key} cx={point.x} cy={point.y} r="3.5" fill="#fffefa" stroke="#315b47" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{buckets[index].label}: {buckets[index].orders} paid orders</title></circle>)}
      </svg>
      <div className="analytics-chart-labels">{labels.map((index) => <span key={buckets[index].key}>{buckets[index].label}</span>)}</div>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, tone }) {
  return <article className={`analytics-metric ${tone}`}><span className="analytics-metric-icon">{React.createElement(icon, { size: 19 })}</span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article>;
}

function AnalyticsSkeleton() {
  return <main className="admin-analytics analytics-skeleton" aria-busy="true" aria-label="Loading sales analytics">
    <header className="analytics-skeleton-heading"><div><i /><i /><i /></div><i /></header>
    <div className="analytics-skeleton-metrics">{[0, 1, 2, 3].map((item) => <i key={item} />)}</div>
    <i className="analytics-skeleton-chart" />
    <div className="analytics-skeleton-lower"><i /><i /></div>
  </main>;
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [sortBy, setSortBy] = useState("quantity");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [productNames, setProductNames] = useState({});

  const loadAnalytics = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (days === 365) start.setFullYear(start.getFullYear() - 1);
    else start.setDate(start.getDate() - (days - 1));
    try {
      const [ordersResult, productsResult] = await Promise.all([
        supabase.from("checkouts").select("checkout_id,items,total,amount_due,referral_credit_applied,payment_status,status,created_at", { count: "exact" }).gte("created_at", start.toISOString()).order("created_at", { ascending: true }).limit(1000),
        supabase.from("products").select("id,name"),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;
      const allOrders = [...(ordersResult.data || [])];
      for (let from = allOrders.length; from < (ordersResult.count || 0); from += 1000) {
        const { data, error: pageError } = await supabase.from("checkouts")
          .select("checkout_id,items,total,amount_due,referral_credit_applied,payment_status,status,created_at")
          .gte("created_at", start.toISOString()).order("created_at", { ascending: true }).range(from, from + 999);
        if (pageError) throw pageError;
        if (!data?.length) break;
        allOrders.push(...data);
      }
      setOrders(allOrders);
      setProductNames(Object.fromEntries((productsResult.data || []).map((product) => [String(product.id), product.name])));
    } catch (loadError) {
      console.error("Error loading sales analytics:", loadError);
      setError("Analytics could not be loaded. Check your admin access and database connection, then try again.");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const paidOrders = useMemo(() => orders.filter((order) => paidStates.has(paymentState(order))), [orders]);
  const stats = useMemo(() => {
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.amount_due ?? order.total ?? 0), 0);
    const units = paidOrders.reduce((sum, order) => sum + readItems(order.items).reduce((itemSum, item) => itemSum + Math.max(0, Number(item.quantity || 0)), 0), 0);
    return { revenue, orders: orders.length, paid: paidOrders.length, pending: orders.filter((order) => ["pending", "initiating", "processing"].includes(paymentState(order))).length, failed: orders.filter((order) => ["failed", "expired", "cancelled"].includes(paymentState(order))).length, average: paidOrders.length ? revenue / paidOrders.length : 0, units };
  }, [orders, paidOrders]);

  const buckets = useMemo(() => buildBuckets(orders, days), [orders, days]);
  const topProducts = useMemo(() => {
    const sales = new Map();
    paidOrders.forEach((order) => readItems(order.items).forEach((item) => {
      const id = String(item.product_id ?? item.id ?? "unknown");
      const quantity = Math.max(0, Number(item.quantity || 0));
      const lineRevenue = Math.max(0, Number(item.price || 0) * quantity);
      const current = sales.get(id) || { id, name: item.name || productNames[id] || `Product ${id}`, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += lineRevenue;
      sales.set(id, current);
    }));
    return [...sales.values()].sort((a, b) => sortBy === "quantity" ? b.quantity - a.quantity || b.revenue - a.revenue : b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 10);
  }, [paidOrders, productNames, sortBy]);

  const statuses = useMemo(() => [
    { label: "Paid", key: "paid", count: paidOrders.length, icon: Check },
    { label: "Pending / processing", key: "pending", count: stats.pending, icon: Clock3 },
    { label: "Failed / expired", key: "failed", count: stats.failed, icon: XCircle },
  ], [paidOrders.length, stats.pending, stats.failed]);
  const maxStatus = Math.max(...statuses.map((status) => status.count), 1);
  const maxProductQuantity = Math.max(...topProducts.map((product) => product.quantity), 1);
  const rangeName = days === 365 ? "12 months" : `last ${days} days`;

  if (loading) return <AnalyticsSkeleton />;

  return (
    <main className="admin-analytics">
      <header className="analytics-heading">
        <div><span className="analytics-eyebrow">INSIGHTS & PERFORMANCE</span><h1>Sales analytics</h1><p>Understand what sells, what earns, and where each order stands.</p></div>
        <div className="analytics-heading-actions"><div className="analytics-period"><span><Activity size={15} /> Report period</span><select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Analytics period"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></div><button className="analytics-refresh" onClick={() => loadAnalytics(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "is-refreshing" : ""} />{refreshing ? "Updating" : "Refresh"}</button></div>
      </header>

      {error && <div className="analytics-error" role="alert">{error}</div>}

      <section className="analytics-metrics-grid" aria-label="Sales metrics">
        <MetricCard icon={Banknote} label="Collected revenue" value={formatXaf(stats.revenue)} detail={`Paid checkouts · ${rangeName}`} tone="green" />
        <MetricCard icon={ShoppingBag} label="Orders received" value={stats.orders.toLocaleString()} detail={`${stats.paid} payments completed`} tone="sand" />
        <MetricCard icon={Package} label="Units sold" value={stats.units.toLocaleString()} detail="Items on paid orders" tone="blue" />
        <MetricCard icon={BarChart3} label="Average paid order" value={formatXaf(stats.average)} detail="Collected revenue ÷ paid orders" tone="lavender" />
      </section>

      <section className="analytics-panel trend-panel">
        <div className="analytics-panel-head"><div><span className="analytics-eyebrow">SALES TREND</span><h2>Revenue & paid orders</h2><p>Revenue uses the amount collected after store credit is applied.</p></div><span className="analytics-period-pill">{rangeName}</span></div>
        <div className="trend-summary"><strong>{formatXaf(stats.revenue)}</strong><span>revenue collected</span><span className="trend-separator" /><strong>{stats.paid}</strong><span>paid orders</span></div>
        <div className="trend-legend"><span><i className="legend-revenue" /> Revenue</span><span><i className="legend-orders" /> Paid orders</span></div>
        <TrendChart buckets={buckets} />
      </section>

      <div className="analytics-lower-grid">
        <section className="analytics-panel bestseller-panel">
          <div className="analytics-panel-head bestseller-head"><div><span className="analytics-eyebrow">PRODUCT PERFORMANCE</span><h2>Top-selling products</h2><p>Ranked using paid order items only. Shipping is excluded from product sales value.</p></div><Trophy size={21} /></div>
          <div className="bestseller-toolbar"><span>{topProducts.length ? `Top ${topProducts.length} in ${rangeName}` : `No product sales in ${rangeName}`}</span><div className="bestseller-sort" aria-label="Rank products by"><button className={sortBy === "quantity" ? "active" : ""} onClick={() => setSortBy("quantity")}>Units sold</button><button className={sortBy === "revenue" ? "active" : ""} onClick={() => setSortBy("revenue")}>Sales value</button></div></div>
          {topProducts.length ? <div className="bestseller-table-wrap"><table className="bestseller-table"><thead><tr><th>Rank</th><th>Product</th><th>Units sold</th><th>Product sales</th></tr></thead><tbody>{topProducts.map((product, index) => <tr key={product.id}><td><span className={`bestseller-rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span></td><td><div className="bestseller-name">{product.name}</div><span className="bestseller-id">Product ID {product.id}</span></td><td><div className="units-cell"><strong>{product.quantity.toLocaleString()}</strong><span className="units-track"><i style={{ width: `${(product.quantity / maxProductQuantity) * 100}%` }} /></span></div></td><td className="bestseller-revenue">{formatXaf(product.revenue)}</td></tr>)}</tbody></table></div> : <div className="analytics-empty"><Package size={25} /><strong>No paid product lines yet</strong><span>Product rankings will appear after successful payments.</span></div>}
        </section>

        <section className="analytics-panel status-panel">
          <div className="analytics-panel-head"><div><span className="analytics-eyebrow">ORDER PIPELINE</span><h2>Payment status</h2><p>Checkout payment outcomes for {rangeName}.</p></div><ShoppingBag size={20} /></div>
          <div className="payment-status-total"><strong>{stats.orders.toLocaleString()}</strong><span>orders in report</span></div>
          <div className="payment-status-list">{statuses.map((status) => <div className="payment-status-item" key={status.key}><div className="payment-status-label"><span className={`payment-dot ${status.key}`} /><span>{status.label}</span><strong>{status.count}</strong></div><div className="payment-track"><i className={status.key} style={{ width: `${(status.count / maxStatus) * 100}%` }} /></div></div>)}</div>
          <div className="status-insight"><ArrowDownRight size={16} /><span>Pending payments are not counted as collected revenue.</span></div>
        </section>
      </div>
    </main>
  );
}
