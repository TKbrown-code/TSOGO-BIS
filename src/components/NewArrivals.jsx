import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import { Link } from "react-router-dom";
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
      // First, get products with new_arrival tag
      const { data: taggedProducts, error: tagError } = await supabase
        .from("product_tags")
        .select("product_id")
        .eq("tag", "new_arrival");

      if (tagError) throw tagError;

      const productIds = taggedProducts?.map(t => t.product_id) || [];

      // If no tagged products, return empty
      if (productIds.length === 0) {
        if (p === 0) setItems([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // Now fetch products with those IDs
      const { data, error: fetchError } = await supabase
        .from("products")
        .select(`
          *,
          product_images(image_path, is_primary),
          categories(name)
        `)
        .in("id", productIds)
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

  // Skeleton placeholder
  const SkeletonCard = () => (
    <div className="na-card skeleton-card" aria-hidden>
      <div className="skeleton-image" />
      <div className="na-body">
        <div className="skeleton-text skeleton-title" />
        <div className="skeleton-text skeleton-desc" />
        <div className="skeleton-text skeleton-desc" />
        <div className="skeleton-text skeleton-price" />
        <div className="skeleton-footer">
          <div className="skeleton-text skeleton-category" />
          <div className="skeleton-text skeleton-date" />
        </div>
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

  const getCategoryName = (categoryId) => {
    if (!categoryId) return "Uncategorized";
    const cat = categoriesMap[categoryId];
    if (!cat) return "Unknown";
    if (cat.parent_id && categoriesMap[cat.parent_id]) {
      return `${categoriesMap[cat.parent_id].name} > ${cat.name}`;
    }
    return cat.name;
  };

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
            {items.map((p) => (
              <Link
                to={`/ProductDetails/${p.id}/${p.name.replace(/\s+/g, '-')}`}
                className="na-card"
                key={p.id}
              >
                <div className="na-image-wrapper">
                  <img
                    src={imageUrls[p.id] || "/placeholder.png"}
                    alt={p.name}
                    className="na-image"
                  />
                  <span className="na-badge">New</span>
                </div>

                <div className="na-body">
                  <h3 className="na-title">{p.name}</h3>
                  <p className="na-desc">
                    {p.description ? p.description.slice(0, 100) + (p.description.length > 100 ? "…" : "") : "—"}
                  </p>
                  <div className="na-price">
                    {convert(Number(p.price || 0), currency)} {currency}
                  </div>
                  
                  <div className="card-footer">
                    <span className="category-label">{getCategoryName(p.category_id)}</span>
                    <span className="category-label">{new Date(p.created_at).toISOString().split("T")[0]}</span>
                  </div>
                </div>
              </Link>
            ))}
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
