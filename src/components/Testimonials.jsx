import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faQuoteLeft, faUser, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import "../styles/testimonials.css";

export default function Testimonials() {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const fetchTestimonials = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("product_reviews")
          .select(`
            id,
            rating,
            comment,
            created_at,
            products (
              name,
              product_images (
                image_path,
                is_primary
              )
            ),
            profiles (
              username
            )
          `)
          .order("created_at", { ascending: false })
          .limit(12);

        if (error) throw error;

        console.log("Fetched reviews:", data?.length || 0);
        setReviews(data || []);
      } catch (err) {
        console.error("Testimonials fetch error:", err);
        setError(err.message || t('testimonials.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonials();
  }, []);

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <FontAwesomeIcon key={`full-${i}`} icon={faStar} className="star filled" />
      );
    }

    if (hasHalfStar) {
      stars.push(
        <FontAwesomeIcon key="half" icon={faStar} className="star half" />
      );
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <FontAwesomeIcon key={`empty-${i}`} icon={faStar} className="star empty" />
      );
    }

    return stars;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      const newScrollPosition = 
        direction === "left"
          ? scrollContainerRef.current.scrollLeft - scrollAmount
          : scrollContainerRef.current.scrollLeft + scrollAmount;
      
      scrollContainerRef.current.scrollTo({
        left: newScrollPosition,
        behavior: "smooth",
      });
    }
  };

  const getCardWidth = () => {
    if (window.innerWidth <= 480) {
      return window.innerWidth - 32; // Full width minus padding
    }
    return 380 + 24; // card width + gap for desktop
  };

  const scrollToIndex = (index) => {
    if (scrollContainerRef.current) {
      const cardWidth = getCardWidth();
      scrollContainerRef.current.scrollTo({
        left: index * cardWidth,
        behavior: "smooth",
      });
      setCurrentIndex(index);
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const cardWidth = getCardWidth();
      const index = Math.round(scrollLeft / cardWidth);
      setCurrentIndex(index);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [reviews]);

  if (loading) {
    return (
      <section className="testimonials-section">
        <div className="testimonials-container">
          <div className="testimonials-loading">{t('testimonials.loading')}</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="testimonials-section">
        <div className="testimonials-container">
          <div className="testimonials-error">{error}</div>
        </div>
      </section>
    );
  }

  if (!reviews.length) {
    return null;
  }

  return (
    <section className="testimonials-section">
      <div className="testimonials-container">
        <div className="testimonials-header">
          <h2 className="testimonials-title">{t('testimonials.title')}</h2>
          <p className="testimonials-subtitle">
            {t('testimonials.subtitle')}
          </p>
        </div>

        <div className="testimonials-slider-wrapper">
          <button 
            className="slider-btn slider-btn-left" 
            onClick={() => scroll("left")}
            aria-label={t('testimonials.previous')}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>

          <div className="testimonials-slider" ref={scrollContainerRef}>
            {reviews.map((review) => (
            <div key={review.id} className="testimonial-card">
              <div className="testimonial-quote">
                <FontAwesomeIcon icon={faQuoteLeft} />
              </div>

              <div className="testimonial-user">
                  <div className="user-avatar">
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <div className="user-info">
                    <h4 className="user-name">{review.profiles?.username || 'Anonymous'}</h4>
                    <p className="review-date">{formatDate(review.created_at)}</p>
                  </div>
                </div>

              <div className="testimonial-footer">
                <p className="testimonial-comment">{review.comment}</p>
                {review.products && (
                  <div className="reviewed-product">
                    <span className="product-label">{t('testimonials.reviewed')}</span>
                    <span className="product-name">{review.products.name}</span>
                  </div>
                )}
              </div>
              <div className="testimonial-rating">
                {renderStars(review.rating)}
                <span className="rating-number">{review.rating.toFixed(1)}</span>
              </div>
            </div>
          ))}
          </div>

          <button 
            className="slider-btn slider-btn-right" 
            onClick={() => scroll("right")}
            aria-label={t('testimonials.next')}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>

        {/* Pagination Dots */}
        {reviews.length > 1 && (
          <div className="slider-dots">
            {reviews.map((_, index) => (
              <button
                key={index}
                className={`dot ${currentIndex === index ? "active" : ""}`}
                onClick={() => scrollToIndex(index)}
                aria-label={t('testimonials.go_to_slide', { number: index + 1 })}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
