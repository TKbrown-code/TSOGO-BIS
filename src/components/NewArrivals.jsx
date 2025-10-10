import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import ProductModal from "./ProductModal";
import "../styles/newArrivals.css";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";

/**
 * NewArrivals
 * - displays products with is_new_arrival = true
 * - infinite scroll, lazy images, skeletons, quick view modal, add-to-cart
 */
export default function NewArrivals({ initialLimit = 8 }) {
  const { addToCart } = useCart();
  const { convert, currency } = useCurrencyContext();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const limit = initialLimit;
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categoriesMap, setCategoriesMap] = useState({});
  

  const observerRef = useRef();

  const fetchPage = useCallback(async (p = 0) => {
    try {
      if (p === 0) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const from = p * limit;
      const to = from + limit - 1;

      // fetch only new arrivals, newest first
      const { data, error: fetchError } = await supabase
  .from("products")
  .select(`
    *,
    product_images(image_path, is_primary),
    product_tags(tag)
  `, { count: "exact" })
  .eq("product_tags.tag", "new_arrival")
  .order("created_at", { ascending: false })
  .range(from, to);


      if (fetchError) throw fetchError;

      if (p === 0) setItems(data || []);
      else setItems((prev) => [...prev, ...(data || [])]);

      // if fewer than limit returned -> no more
      if (!data || data.length < limit) setHasMore(false);
    } catch (err) {
      console.error("NewArrivals fetch error:", err);
      setError("Failed to load new arrivals.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit]);

  useEffect(() => {
    // initial load
    fetchPage(0);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // infinite scroll: load next page when sentinel intersects
  useEffect(() => {
    if (!hasMore) return;
    const node = observerRef.current;
    if (!node) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !loadingMore && !loading) {
          const nextPage = page + 1;
          fetchPage(nextPage);
          setPage(nextPage);
        }
      });
    }, { rootMargin: "200px" });

    obs.observe(node);
    return () => obs.disconnect();
  }, [observerRef, hasMore, page, fetchPage, loadingMore, loading]);

  // optimistic add-to-cart with mini quantity
  const handleAddToCart = async (product, qty = 1) => {
    try {
      // optional: show tiny loading state per card (not implemented here)
      await addToCart({ ...product, quantity: qty });
      // optional: success toast (implement your modal/toast)
      // openToast(`${product.name} added to cart`);
    } catch (err) {
      console.error("Add to cart error:", err);
      // show error toast
    }
  };

  // Skeleton placeholder repeated
  const SkeletonCard = () => (
    <div className="na-card skeleton" aria-hidden>
      <div className="na-image skeleton-box" />
      <div className="na-body">
        <div className="s-line short" />
        <div className="s-line" />
        <div className="s-line tiny" />
      </div>
    </div>
  );

 const [imageUrls, setImageUrls] = useState({});

useEffect(() => {
  async function loadImages() {
    if (!items.length) return;
    await preloadAllImages(items);
    const urls = {};
    items.forEach((product) => {
      const primaryImage = product.product_images?.find((img) => img.is_primary);
      if (primaryImage) {
        urls[product.id] = getCachedImage(primaryImage.image_path);
      }
    });
    setImageUrls(urls);
  }

  loadImages();
}, [items]);

useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (!error) {
        const map = {};
        data.forEach((cat) => (map[cat.id] = cat));
        setCategoriesMap(map);
      }
    };
    fetchCategories();
  }, []);

  return (
    <section className="new-arrivals" aria-labelledby="new-arrivals-heading">
      <div className="na-header">
        <h2 id="new-arrivals-heading">New Arrivals</h2>
        <p className="na-sub">Fresh picks added recently — handpicked for you.</p>
      </div>

      {loading && (
        <div className="na-grid">
          {Array.from({ length: limit }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && error && (
        <div className="na-error" role="alert">{error}</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="na-empty">No new arrivals at the moment. Check back soon.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="na-grid">
            {items.map((p) => {
              const img = p.image_urls?.[0] || "";
              return (
                <article
                  key={p.id}
                  className="na-card"
                  tabIndex={0}
                  aria-labelledby={`na-title-${p.id}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelectedProduct(p);
                  }}
                >
                  <div className="na-image-wrapper" role="img" aria-label={p.name}>
                    <img
                        src={imageUrls[p.id] || "/placeholder.png"}
                        alt={p.name}
                        className="product-image"
                    />
                    <span className="na-badge">New</span>
                    <div className="na-overlay">
                      <button
                        className="na-quickview"
                        aria-label={`Quick view ${p.name}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedProduct(p); }}
                      >
                        Quick View
                      </button>
                    </div>
                  </div>

                  <div className="na-body">
                    <h3 id={`na-title-${p.id}`} className="na-title">{p.name}</h3>
                    <p className="na-desc">{p.description ? p.description.slice(0, 100) + (p.description.length > 100 ? "…" : "") : "—"}</p>
                    <div className="na-meta">
                      <span className="na-price">
                        {convert(Number(p.price || 0), currency)} {currency}
                      </span>
                      <div className="na-actions">
                        <button
                          className="btn na-add"
                          onClick={(e) => { e.stopPropagation(); handleAddToCart(p, 1); }}
                          aria-label={`Add ${p.name} to cart`}
                        >
                          Add
                        </button>
                        <a className="btn na-view" href={`/ProductDetails/${p.product_tags?.[0]?.tag || "no-tag"}/${p.id}/${p.name}`} onClick={(e) => e.stopPropagation()}>
                          View
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="na-footer">
            {loadingMore ? <div className="loader">Loading more…</div> : null}
            {!hasMore && <div className="na-end">End of new arrivals</div>}
            <div ref={observerRef} className="na-sentinel" aria-hidden />
          </div>
        </>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          addToCart={(prod) => { handleAddToCart(prod, prod.quantity || 1); }}
          categoriesMap={categoriesMap}
        />
      )}
    </section>
  );
}
