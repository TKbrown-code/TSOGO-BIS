import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { showSiteModal } from "../../utils/siteModal";
import { Check, Clock3, MessageSquareText, Package, RefreshCw, Search, ShieldCheck, Star, X } from "lucide-react";
import "./AdminReviews.css";

const statusLabels = { pending: "Needs review", published: "Published", rejected: "Rejected" };
const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id,product_id,user_id,order_item_id,rating,title,body,status,created_at,updated_at,products(name)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading reviews:", error);
      setLoadError(error.message || "Reviews could not be loaded.");
      setReviews([]);
      setLoading(false);
      return;
    }

    const rows = data || [];
    const userIds = [...new Set(rows.map((review) => review.user_id).filter(Boolean))];
    let profilesById = {};
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id,display_name")
        .in("user_id", userIds);
      if (!profilesError) profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.user_id, profile]));
    }
    setReviews(rows.map((review) => ({ ...review, reviewer: profilesById[review.user_id] || null })));
    setLoading(false);
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  async function setReviewStatus(review, status) {
    if (review.status === status) return;
    setBusyId(review.id);
    const { error } = await supabase.from("product_reviews").update({ status }).eq("id", review.id);
    if (error) {
      console.error("Could not update review status:", error);
      showSiteModal(`Could not update this review: ${error.message}`, "Review update failed", "error");
    } else {
      setReviews((current) => current.map((item) => item.id === review.id ? { ...item, status, updated_at: new Date().toISOString() } : item));
    }
    setBusyId(null);
  }

  const stats = useMemo(() => {
    const count = reviews.length;
    return {
      total: count,
      pending: reviews.filter((review) => review.status === "pending").length,
      published: reviews.filter((review) => review.status === "published").length,
      average: count ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / count).toFixed(1) : "0.0",
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const searchTarget = [review.title, review.body, review.products?.name, review.reviewer?.display_name, review.user_id].join(" ").toLowerCase();
      return (!query || searchTarget.includes(query))
        && (statusFilter === "all" || review.status === statusFilter)
        && (ratingFilter === "all" || Number(review.rating) === Number(ratingFilter));
    });
  }, [reviews, search, statusFilter, ratingFilter]);

  return (
    <main className="admin-reviews-page">
      <header className="reviews-page-heading">
        <div><span className="reviews-eyebrow">CUSTOMER VOICE</span><h1>Product reviews</h1><p>Review customer feedback and decide which submissions appear in the shop.</p></div>
        <button type="button" className="reviews-refresh" onClick={loadReviews} disabled={loading}><RefreshCw size={15} className={loading ? "reviews-spin" : ""} />Refresh reviews</button>
      </header>

      <section className="reviews-summary" aria-label="Review summary">
        <article><span className="reviews-summary-icon"><MessageSquareText size={18} /></span><div><strong>{stats.total}</strong><small>Total reviews</small></div></article>
        <article><span className="reviews-summary-icon is-pending"><Clock3 size={18} /></span><div><strong>{stats.pending}</strong><small>Awaiting moderation</small></div></article>
        <article><span className="reviews-summary-icon is-published"><ShieldCheck size={18} /></span><div><strong>{stats.published}</strong><small>Visible in the shop</small></div></article>
        <article><span className="reviews-summary-icon is-rating"><Star size={18} /></span><div><strong>{stats.average}<span className="reviews-out-of"> / 5</span></strong><small>Average rating</small></div></article>
      </section>

      <section className="reviews-workspace">
        <header className="reviews-toolbar">
          <div><h2>Review inbox</h2><p>{filteredReviews.length} {filteredReviews.length === 1 ? "review" : "reviews"} shown</p></div>
          <div className="reviews-filters">
            <label className="reviews-search"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reviews or products" aria-label="Search reviews" /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter review status"><option value="all">All statuses</option><option value="pending">Needs review</option><option value="published">Published</option><option value="rejected">Rejected</option></select>
            <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} aria-label="Filter review rating"><option value="all">All ratings</option>{[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating} stars</option>)}</select>
          </div>
        </header>

        {loadError ? <div className="reviews-state is-error" role="alert"><span><X size={20} /></span><h3>Reviews unavailable</h3><p>{loadError}</p><button type="button" onClick={loadReviews}>Try again</button></div>
          : loading ? <div className="reviews-loading" aria-label="Loading reviews">{[0, 1, 2].map((item) => <i key={item} />)}</div>
            : filteredReviews.length === 0 ? <div className="reviews-state"><span><MessageSquareText size={22} /></span><h3>{reviews.length ? "No matching reviews" : "No reviews yet"}</h3><p>{reviews.length ? "Adjust the search or filters to find another review." : "Customer feedback will appear here when it is submitted."}</p></div>
              : <div className="reviews-list">{filteredReviews.map((review) => {
                const name = review.reviewer?.display_name || "Customer";
                const initial = name.charAt(0).toUpperCase();
                return <article className="admin-review-card" key={review.id}>
                  <header className="admin-review-card-head">
                    <div className="admin-review-identity"><span className="admin-review-avatar">{initial}</span><div><strong>{name}</strong><small>Review #{review.id} · {dateLabel(review.created_at)}</small></div></div>
                    <span className={`review-status-badge is-${review.status || "pending"}`}>{statusLabels[review.status] || "Needs review"}</span>
                  </header>
                  <div className="admin-review-content">
                    <div className="admin-review-product"><Package size={15} /><span>{review.products?.name || `Product #${review.product_id}`}</span><span className="admin-review-order">Order item #{review.order_item_id}</span></div>
                    <div className="admin-review-rating" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= Number(review.rating) ? "currentColor" : "none"} />)}<strong>{Number(review.rating).toFixed(1)}</strong></div>
                    {review.title && <h3>{review.title}</h3>}
                    <p className="admin-review-body">{review.body || <span className="reviews-no-comment">No written comment was provided.</span>}</p>
                  </div>
                  <footer className="admin-review-actions">
                    <span className="admin-review-customer-id">Customer ID · {review.user_id ? `${review.user_id.slice(0, 8)}…` : "Unavailable"}</span>
                    <div>
                      {review.status !== "published" && <button type="button" className="review-action is-approve" onClick={() => setReviewStatus(review, "published")} disabled={busyId === review.id}><Check size={15} />Publish</button>}
                      {review.status !== "rejected" && <button type="button" className="review-action is-reject" onClick={() => setReviewStatus(review, "rejected")} disabled={busyId === review.id}><X size={15} />Reject</button>}
                      {review.status !== "pending" && <button type="button" className="review-action is-reset" onClick={() => setReviewStatus(review, "pending")} disabled={busyId === review.id}><Clock3 size={15} />Return to pending</button>}
                    </div>
                  </footer>
                </article>;
              })}</div>}
      </section>
    </main>
  );
}
