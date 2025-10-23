// src/admin/AdminReviews.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MessageSquare, Star, Search, Package, Trash2 } from "lucide-react";
import "../styles/AdminReviews.css";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRating, setFilterRating] = useState("");

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_reviews")
      .select(`
        *,
        product_id(id, name),
        user_id(user_id, full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading reviews:", error);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  }

  async function deleteReview(reviewId) {
    if (!confirm("Are you sure you want to delete this review?")) return;

    const { error } = await supabase
      .from("product_reviews")
      .delete()
      .eq("id", reviewId);

    if (error) {
      alert("Error deleting review: " + error.message);
    } else {
      setReviews(reviews.filter(r => r.id !== reviewId));
      alert("Review deleted successfully!");
    }
  }

  // Filter reviews
  const filteredReviews = reviews.filter(review => {
    const matchesSearch = 
      review.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.product_id?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRating = !filterRating || review.rating === parseInt(filterRating);
    return matchesSearch && matchesRating;
  });

  // Statistics
  const stats = {
    total: reviews.length,
    avgRating: reviews.length > 0 
      ? (reviews.reduce((sum, r) => sum + parseFloat(r.rating), 0) / reviews.length).toFixed(1)
      : 0,
    fiveStar: reviews.filter(r => r.rating === 5).length,
    fourStar: reviews.filter(r => r.rating === 4).length,
    threeStar: reviews.filter(r => r.rating === 3).length,
    twoStar: reviews.filter(r => r.rating === 2).length,
    oneStar: reviews.filter(r => r.rating === 1).length
  };

  return (
    <div className="admin-reviews">
      <div className="reviews-header">
        <div>
          <h1><Star className="inline-block mr-2" size={28} /> Reviews Management</h1>
          <p className="subtitle">Manage product reviews and ratings</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><MessageSquare size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Reviews</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Star size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.avgRating}</div>
            <div className="stat-label">Average Rating</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Star size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.fiveStar}</div>
            <div className="stat-label">5 Star Reviews</div>
          </div>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="rating-distribution">
        <h3>Rating Distribution</h3>
        <div className="distribution-bars">
          {[5, 4, 3, 2, 1].map(rating => {
            const count = reviews.filter(r => r.rating === rating).length;
            const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <div key={rating} className="distribution-row">
                <span className="rating-label">{rating} ⭐</span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="rating-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select value={filterRating} onChange={e => setFilterRating(e.target.value)}>
          <option value="">All Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>
        {(searchQuery || filterRating) && (
          <button
            onClick={() => {
              setSearchQuery("");
              setFilterRating("");
            }}
            className="btn-clear"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Reviews Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⭐</div>
          <h3>No reviews found</h3>
          <p>
            {searchQuery || filterRating
              ? "Try adjusting your filters"
              : "No reviews have been submitted yet"}
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="reviews-table">
            <thead>
              <tr>
                <th>Reviewer</th>
                <th>Product</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map(review => (
                <tr key={review.id}>
                  <td>
                    <div className="reviewer-cell">
                      <div className="reviewer-avatar">
                        {review.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{review.username}</strong>
                        {review.user_id?.email && (
                          <div className="reviewer-email">{review.user_id.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="product-cell">
                      <Package className="inline-block mr-1" size={14} /> {review.product_id?.name || `Product #${review.product_id}`}
                    </div>
                  </td>
                  <td>
                    <div className="rating-cell">
                      <div className="stars">{Array(Math.floor(review.rating)).fill(0).map((_, i) => <Star key={i} size={14} fill="gold" stroke="gold" />)}</div>
                      <span className="rating-number">{review.rating}</span>
                    </div>
                  </td>
                  <td>
                    <div className="comment-cell">
                      {review.comment}
                      {review.updated_at !== review.created_at && (
                        <span className="edited-badge">Edited</span>
                      )}
                    </div>
                  </td>
                  <td className="date-cell">
                    {new Date(review.created_at).toLocaleDateString()}
                    <div className="time-cell">
                      {new Date(review.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => deleteReview(review.id)}
                      className="btn-delete"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
