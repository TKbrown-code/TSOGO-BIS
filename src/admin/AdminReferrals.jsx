import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, RefreshCw, Search, Users, Wallet, CircleDollarSign, ArrowUpRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import "../styles/AdminReferrals.css";

const money = (value) => `${Number(value || 0).toLocaleString()} XAF`;

function ReferralsSkeleton() {
  return <main className="admin-referrals referrals-skeleton" aria-busy="true" aria-label="Loading referral activity">
    <header className="referrals-heading"><div><i /><i /><i /></div><i /></header>
    <div className="referrals-skeleton-stats">{[0, 1, 2].map((item) => <i key={item} />)}</div>
    <section><div className="referrals-skeleton-toolbar"><i /><i /></div>{[0, 1, 2, 3, 4].map((item) => <i className="referrals-skeleton-row" key={item} />)}</section>
  </main>;
}

export default function AdminReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const loadReferrals = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("referrals")
      .select("id,referrer_user_id,created_at,commission_amount,commission_status")
      .order("created_at", { ascending: false })
      .limit(500);
    if (fetchError) {
      console.error("Error loading referrals:", fetchError);
      setError("Referral records are unavailable. Confirm the referral migrations have been applied and the admin referral policy is installed.");
    } else {
      setReferrals(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const rows = useMemo(() => referrals.filter((referral) => {
    const matchesQuery = `${referral.id} ${referral.referrer_user_id}`.toLowerCase().includes(query.trim().toLowerCase());
    const hasCredit = Number(referral.commission_amount) > 0;
    const matchesFilter = filter === "all" || (filter === "credited" ? hasCredit : !hasCredit);
    return matchesQuery && matchesFilter;
  }), [referrals, query, filter]);

  const stats = useMemo(() => ({
    total: referrals.length,
    creditedCount: referrals.filter((r) => Number(r.commission_amount) > 0).length,
    credited: referrals.reduce((sum, r) => sum + Number(r.commission_amount || 0), 0),
  }), [referrals]);

  if (loading) return <ReferralsSkeleton />;

  return (
    <section className="admin-referrals">
      <header className="referrals-heading">
        <div>
          <p className="dashboard-eyebrow">CUSTOMER GROWTH</p>
          <h1>Referrals</h1>
          <p>Track referral signups and the first order store credit they generated.</p>
        </div>
        <button type="button" className="dashboard-refresh" onClick={() => loadReferrals(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "is-refreshing" : ""} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </header>

      <div className="referral-stat-grid">
        <article><span className="referral-stat-icon"><Users size={19} /></span><div><small>Successful referrals</small><strong>{stats.total.toLocaleString()}</strong></div></article>
        <article><span className="referral-stat-icon"><Gift size={19} /></span><div><small>Earned first-order rewards</small><strong>{stats.creditedCount.toLocaleString()}</strong></div></article>
        <article><span className="referral-stat-icon"><Wallet size={19} /></span><div><small>Store credit issued</small><strong>{money(stats.credited)}</strong></div></article>
      </div>

      <div className="referrals-list-card">
        <div className="referrals-toolbar">
          <div><h2>Referral activity</h2><p>3% of the first product line is credited to the referrer’s store balance.</p></div>
          <div className="referral-controls">
            <label className="referral-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search referral or customer ID" /></label>
            <select aria-label="Filter referrals" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All referrals</option><option value="credited">Reward credited</option><option value="none">No reward yet</option>
            </select>
          </div>
        </div>

        {error && <div className="referrals-error" role="alert">{error}</div>}
        {rows.length === 0 ? (
          <div className="referrals-empty"><span className="empty-gift"><Gift size={22} /></span><strong>No referral activity found</strong><span>{query || filter !== "all" ? "Try changing your search or filter." : "Referral signups will appear here."}</span></div>
        ) : (
          <div className="referrals-table-wrap"><table className="referrals-table">
            <thead><tr><th>Referrer</th><th>Referral record</th><th>Joined</th><th>First-order reward</th><th>Reward status</th></tr></thead>
            <tbody>{rows.map((referral) => {
              const credited = Number(referral.commission_amount) > 0;
              return <tr key={referral.id}>
                <td><span className="referral-customer-avatar">{String(referral.referrer_user_id).slice(0, 1).toUpperCase()}</span><span className="referral-id">{String(referral.referrer_user_id).slice(0, 8)}…</span></td>
                <td><code>{String(referral.id).slice(0, 8)}…</code></td>
                <td>{new Date(referral.created_at).toLocaleDateString()}</td>
                <td><strong>{credited ? money(referral.commission_amount) : "—"}</strong></td>
                <td><span className={`referral-state ${credited ? "credited" : "waiting"}`}>{credited ? "Store credit added" : "Awaiting first paid order"}</span></td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
        {rows.length > 0 && <footer className="referrals-table-footer">Showing {rows.length} of {referrals.length} referral records <span><CircleDollarSign size={15} /> Non-withdrawable platform credit</span></footer>}
      </div>
      <div className="referrals-note"><ArrowUpRight size={16} /> Rewards are automatically added to the referrer’s store balance after their referral’s first successful payment. The balance can be used at checkout and cannot be withdrawn.</div>
    </section>
  );
}
