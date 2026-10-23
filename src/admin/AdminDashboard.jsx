import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import {
  ArrowDownRight, ArrowUpRight, BadgeCheck, Banknote, Boxes, CalendarDays,
  Clock3, Gift, Package, RefreshCw, ShoppingBag, UsersRound,
} from "lucide-react";
import "../styles/AdminDashboard.css";

const XAF = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const formatMoney = (value) => `${XAF.format(Number(value) || 0)} XAF`;
const statusOf = (order) => String(order.payment_status || order.status || "pending").toLowerCase();
const paidStatuses = new Set(["paid", "completed", "success", "successful"]);

function makeSeries(orders, days) {
  const today = new Date();
  const buckets = Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (days - 1 - index));
    return { key: day.toLocaleDateString(), label: day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }), value: 0 };
  });
  const lookup = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  orders.forEach((order) => {
    if (!paidStatuses.has(statusOf(order))) return;
    const bucket = lookup.get(new Date(order.created_at).toLocaleDateString());
    if (bucket) bucket.value += Number(order.total || 0);
  });
  return buckets;
}

function SalesChart({ series, days }) {
  const width = 760;
  const height = 226;
  const pad = { top: 18, right: 12, bottom: 12, left: 12 };
  const max = Math.max(...series.map((point) => point.value), 1);
  const coords = series.map((point, index) => ({
    x: pad.left + (index / Math.max(series.length - 1, 1)) * (width - pad.left - pad.right),
    y: height - pad.bottom - (point.value / max) * (height - pad.top - pad.bottom),
  }));
  const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${coords.at(-1)?.x || width},${height - pad.bottom} L${coords[0]?.x || 0},${height - pad.bottom} Z`;
  const labelIndexes = days === 7 ? series.map((_, index) => index) : [0, 5, 11, 17, 23, 29];

  return (
    <div className="overview-chart" role="img" aria-label={`Paid sales during the last ${days} days`}>
      <div className="overview-chart-guides"><i /><i /><i /></div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6d947f" stopOpacity=".23" /><stop offset="100%" stopColor="#6d947f" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#salesFill)" />
        <path d={line} fill="none" stroke="#315b47" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {coords.map((point, index) => <circle key={series[index].key} cx={point.x} cy={point.y} r={days === 7 ? 4 : 2.5} fill="#fffefa" stroke="#315b47" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{series[index].label}: {formatMoney(series[index].value)}</title></circle>)}
      </svg>
      <div className="overview-chart-labels">{labelIndexes.map((index) => <span key={series[index].key}>{series[index].label}</span>)}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <section className="admin-dashboard overview-skeleton" aria-busy="true" aria-label="Loading dashboard overview">
      <header className="overview-skeleton-heading"><div><i /><i /><i /></div><i /></header>
      <div className="overview-skeleton-metrics">{[0, 1, 2, 3].map((item) => <i key={item} />)}</div>
      <div className="overview-skeleton-panels"><i /><i /></div>
      <div className="overview-skeleton-panels lower"><i /><i /></div>
    </section>
  );
}

export default function AdminDashboard({ onNavigate = () => {} }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState({ products: 0, customers: 0, periodOrders: [], periodOrderCount: 0, recentOrders: [], lowStock: [], referralCount: 0, referralCredit: 0, referralsAvailable: true });

  const loadOverview = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    try {
      const [productsResult, customersResult, periodResult, recentResult, lowStockResult] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("checkouts").select("total,payment_status,status,created_at", { count: "exact" }).gte("created_at", start.toISOString()).order("created_at", { ascending: true }).limit(1000),
        supabase.from("checkouts").select("checkout_id,user_name,email,total,payment_status,status,created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("products").select("id,name,stock_quantity").order("stock_quantity", { ascending: true }).limit(30),
      ]);
      const failed = [productsResult, customersResult, periodResult, recentResult, lowStockResult].find((result) => result.error);
      if (failed) throw failed.error;

      // Referrals are an optional panel until its schema migration is installed.
      const referralResult = await supabase.from("referrals").select("commission_amount").order("created_at", { ascending: false }).limit(1000);
      const referrals = referralResult.error ? [] : referralResult.data || [];
      const periodOrders = [...(periodResult.data || [])];
      for (let from = periodOrders.length; from < (periodResult.count || 0); from += 1000) {
        const { data: page, error: pageError } = await supabase.from("checkouts")
          .select("total,payment_status,status,created_at")
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: true })
          .range(from, from + 999);
        if (pageError) throw pageError;
        if (!page?.length) break;
        periodOrders.push(...page);
      }
      setOverview({
        products: productsResult.count || 0,
        customers: customersResult.count || 0,
        periodOrders,
        periodOrderCount: periodResult.count || 0,
        recentOrders: recentResult.data || [],
        lowStock: (lowStockResult.data || []).filter((product) => Number(product.stock_quantity || 0) <= 5).slice(0, 5),
        referralCount: referrals.length,
        referralCredit: referrals.reduce((sum, referral) => sum + Number(referral.commission_amount || 0), 0),
        referralsAvailable: !referralResult.error,
      });
    } catch (loadError) {
      console.error("Error loading admin overview:", loadError);
      setError("Some dashboard information could not be loaded. Check your admin access and database connection, then refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const metrics = useMemo(() => {
    const paid = overview.periodOrders.filter((order) => paidStatuses.has(statusOf(order)));
    const pending = overview.periodOrders.filter((order) => statusOf(order) === "pending").length;
    const revenue = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { revenue, orders: overview.periodOrderCount, paid: paid.length, pending, average: paid.length ? revenue / paid.length : 0 };
  }, [overview.periodOrders, overview.periodOrderCount]);

  const series = useMemo(() => makeSeries(overview.periodOrders, days), [overview.periodOrders, days]);
  const statuses = useMemo(() => [
    { key: "paid", label: "Paid", count: overview.periodOrders.filter((order) => paidStatuses.has(statusOf(order))).length },
    { key: "pending", label: "Pending", count: overview.periodOrders.filter((order) => statusOf(order) === "pending").length },
    { key: "failed", label: "Failed / expired", count: overview.periodOrders.filter((order) => ["failed", "expired"].includes(statusOf(order))).length },
  ], [overview.periodOrders]);
  const maxStatus = Math.max(...statuses.map((status) => status.count), 1);

  if (loading) return <DashboardSkeleton />;

  return (
    <section className="admin-dashboard">
      <header className="overview-heading">
        <div><p className="dashboard-eyebrow">STORE OPERATIONS</p><h1>{t("admin.dashboard.title")}</h1><p>{t("admin.dashboard.subtitle")}</p></div>
        <button type="button" className="dashboard-refresh" onClick={() => loadOverview(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "is-refreshing" : ""} />{refreshing ? "Refreshing" : "Refresh overview"}</button>
      </header>

      {error && <div className="overview-error" role="alert">{error}</div>}

      <div className="overview-metrics">
        <article className="overview-metric revenue-metric"><span className="overview-metric-icon"><Banknote size={19} /></span><div><small>Paid sales · {days} days</small><strong>{formatMoney(metrics.revenue)}</strong><span>{metrics.paid} paid orders</span></div></article>
        <article className="overview-metric"><span className="overview-metric-icon"><ShoppingBag size={19} /></span><div><small>Orders · {days} days</small><strong>{metrics.orders.toLocaleString()}</strong><span>{metrics.pending} awaiting payment</span></div></article>
        <article className="overview-metric"><span className="overview-metric-icon"><Boxes size={19} /></span><div><small>Products</small><strong>{overview.products.toLocaleString()}</strong><span>{overview.lowStock.length} items at low stock</span></div></article>
        <article className="overview-metric"><span className="overview-metric-icon"><UsersRound size={19} /></span><div><small>Customers</small><strong>{overview.customers.toLocaleString()}</strong><span>Registered accounts</span></div></article>
      </div>

      <div className="overview-primary-grid">
        <section className="overview-panel sales-panel">
          <div className="overview-panel-heading"><div><span className="overview-kicker">PERFORMANCE</span><h2>Sales overview</h2><p>{formatMoney(metrics.average)} average paid order</p></div><div className="overview-range" aria-label="Sales chart range"><button className={days === 7 ? "active" : ""} onClick={() => setDays(7)}>7 days</button><button className={days === 30 ? "active" : ""} onClick={() => setDays(30)}>30 days</button></div></div>
          <div className="chart-total"><strong>{formatMoney(metrics.revenue)}</strong><span><ArrowUpRight size={14} /> collected in this period</span></div>
          <SalesChart series={series} days={days} />
        </section>

        <section className="overview-panel order-health-panel">
          <div className="overview-panel-heading"><div><span className="overview-kicker">FULFILLMENT PULSE</span><h2>Order health</h2><p>Payment status in the selected period</p></div><span className="health-icon"><BadgeCheck size={19} /></span></div>
          <div className="status-summary"><strong>{metrics.orders.toLocaleString()}</strong><span>total orders</span></div>
          <div className="status-bars">{statuses.map((status) => <div className="status-row" key={status.key}><div><span className={`status-dot ${status.key}`} />{status.label}<strong>{status.count}</strong></div><span className="status-track"><i className={status.key} style={{ width: `${(status.count / maxStatus) * 100}%` }} /></span></div>)}</div>
          <button type="button" className="overview-text-link" onClick={() => onNavigate("orders")}>Open order management <ArrowUpRight size={15} /></button>
        </section>
      </div>

      <div className="overview-secondary-grid">
        <section className="overview-panel activity-panel">
          <div className="overview-panel-heading"><div><span className="overview-kicker">LATEST ACTIVITY</span><h2>Recent orders</h2></div><button type="button" className="overview-text-link" onClick={() => onNavigate("orders")}>View all <ArrowUpRight size={15} /></button></div>
          {overview.recentOrders.length ? <div className="recent-order-list">{overview.recentOrders.map((order) => {
            const status = statusOf(order);
            return <article className="recent-order-row" key={order.checkout_id}><span className="recent-order-icon"><ShoppingBag size={17} /></span><div className="recent-order-main"><strong>Order #{order.checkout_id}</strong><span>{order.user_name || order.email || "Guest customer"} · {new Date(order.created_at).toLocaleString()}</span></div><div className="recent-order-total"><strong>{formatMoney(order.total)}</strong><span className={`overview-status-tag ${paidStatuses.has(status) ? "paid" : status}`}>{status}</span></div></article>;
          })}</div> : <div className="overview-empty"><ShoppingBag size={22} /><strong>No orders yet</strong><span>New customer orders will show here.</span></div>}
        </section>

        <div className="overview-side-stack">
          <section className="overview-panel low-stock-panel"><div className="overview-panel-heading"><div><span className="overview-kicker">INVENTORY</span><h2>Stock watch</h2></div><button type="button" className="overview-icon-link" onClick={() => onNavigate("products")} aria-label="Open products"><ArrowUpRight size={16} /></button></div>
            {overview.lowStock.length ? <div className="stock-watch-list">{overview.lowStock.map((product) => <div key={product.id}><span><Package size={15} />{product.name || `Product ${product.id}`}</span><strong className={Number(product.stock_quantity) === 0 ? "out-of-stock" : "low-stock-count"}>{Number(product.stock_quantity || 0)} left</strong></div>)}</div> : <div className="stock-ok"><BadgeCheck size={17} /> No low-stock items in the current list</div>}
          </section>
          <button type="button" className="overview-referral-card" onClick={() => onNavigate("referrals")}><span className="referral-card-icon"><Gift size={19} /></span><span className="referral-card-content"><small>REFERRAL PROGRAM</small><strong>{overview.referralsAvailable ? `${overview.referralCount} referrals · ${formatMoney(overview.referralCredit)}` : "Referral data not connected"}</strong><span>{overview.referralsAvailable ? "Store credit issued" : "Apply referral migrations to view"}</span></span><ArrowUpRight size={17} /></button>
          <div className="overview-quick-links"><span><Clock3 size={15} /> Live store snapshot</span><button onClick={() => onNavigate("analytics")}><CalendarDays size={15} /> Full analytics</button><button onClick={() => onNavigate("products")}><ArrowDownRight size={15} /> Manage inventory</button></div>
        </div>
      </div>
    </section>
  );
}
