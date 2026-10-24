import React, { useState, useEffect, useRef } from "react";
import { useCart } from "../../context/CartContext";
import { supabase } from "../../lib/supabase";
import { Link } from "react-router-dom";
import ProductModal from "./ProductModal";
import "../../styles/products.css";
import { useCurrencyContext } from "../../context/CurrencyContext";
import { preloadAllImages } from "../../utils/imageCache";
import { useTranslation } from "react-i18next";
import FallBackImage from "../../assets/imagefallback.jpg";
import { productDetailPath } from "../../utils/productRoutes";

export default function Products({ selectedCategory }) {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { convert, currency } = useCurrencyContext();

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;
  const [imageStates, setImageStates] = useState({});
  const [productTage, setProductTags] = useState([]);
  const observerRef = useRef();

  const fetchproducttags = async (id) => {
    const { data: tags = [] } = await supabase.from("product_tags").select("*").eq("product_id", id);
    return tags || [];
  };

  useEffect(() => {
    const fetchCategories = async () => {
      const { data = [] } = await supabase.from("categories").select("*");
      const map = {};
      data.forEach(cat => (map[cat.id] = cat));
      setCategoriesMap(map);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMoreProducts();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px'
      }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [hasMore, loading, loadingMore, selectedCategory]);

  const loadMoreProducts = async () => {
    if (loading || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const nextPage = page + 1;
    
    try {
      let query = supabase
        .from("products")
        .select(`
          *,
          product_images (
            id,
            image_url,
            is_primary,
            created_at
          )
        `, { count: "exact" });

      if (selectedCategory && selectedCategory !== "All") {
        query = query.eq("category_id", selectedCategory);
      }

      const { data: newProductsData = [], count, error } = await query.range(
        (nextPage - 1) * limit,
        nextPage * limit - 1
      );
      
      if (error) throw error;

      const mapped = await Promise.all(newProductsData.map(async p => {
        const primaryImage = (p.product_images || []).find(img => img.is_primary)?.image_url || FallBackImage;
        const tags = await fetchproducttags(p.id);
        return { ...p, image_url: primaryImage, avg_rating: 0, tags };
      }));

      setProducts(prev => [...prev, ...mapped]);
      setPage(nextPage);
      
      // Check if there are more products to load
      const totalLoaded = products.length + mapped.length;
      setHasMore(totalLoaded < (count || totalLoaded));
      
    } catch (err) {
      console.error("Load more products error:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("products")
        .select(`
          *,
          product_images (
            id,
            image_url,
            is_primary,
            created_at
          )
        `, { count: "exact" });

      if (selectedCategory && selectedCategory !== "All") {
        query = query.eq("category_id", selectedCategory);
      }

      const { data: productsData = [], count, error } = await query.range(
        0,
        limit - 1
      );

      if (error) throw error;

      const mapped = await Promise.all(productsData.map(async p => {
        const primaryImage = (p.product_images || []).find(img => img.is_primary)?.image_url || FallBackImage;
        const tags = await fetchproducttags(p.id);
        return { ...p, image_url: primaryImage, avg_rating: 0, tags };
      }));

      setProducts(mapped);
      setPage(1);
      setHasMore(mapped.length < (count || mapped.length));
      
    } catch (err) {
      console.error("fetchProducts error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId) return "Uncategorized";
    const cat = categoriesMap[categoryId];
    return cat ? cat.name : "Unknown";
  };

  return (
    <div className="product-container">
      <div className="products">
        {products.map(product => {
          const avg = product.avg_rating || 0;
          const imageUrl = product.image_url || FallBackImage;
          const imageLoaded = imageStates[product.id]?.loaded || false;
          const imageError = imageStates[product.id]?.error || false;
          // ✅ Calculate star distribution
          const roundedToHalf = Math.round(avg * 2) / 2;
          const fullStars = Math.floor(roundedToHalf);
          const halfStar = roundedToHalf - fullStars === 0.5;
          const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

          const handleImageLoad = () => {
            setImageStates(prev => ({
              ...prev,
              [product.id]: { ...prev[product.id], loaded: true, error: false }
            }));
          };

          const handleImageError = (e) => {
            setImageStates(prev => ({
              ...prev,
              [product.id]: { ...prev[product.id], loaded: true, error: true }
            }));
            e.target.src = FallBackImage;
          };

          return (
            <Link key={product.id} to={productDetailPath(product)} className="product-link">
              <div className="product-card">
                <div className="product-image-wrapper">
                  <img 
                    src={imageUrl} 
                    alt={product.name}
                    className={`product-image ${imageLoaded ? 'loaded' : ''} ${imageError ? 'error' : ''}`}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />   
                  <div className="product-tags">
                    {product.tags && product.tags.map(tag => (
                      <span key={tag.id} className="product-tag">
                        {tag.tag === 'new_arrival' ? 'New' : tag.tag === 'promotion' ? 'Promotion' : tag.tag}
                      </span>
                    ))}
                  </div>   
                </div>

                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-Details">{product.description}</p>

                  <div className="price-rating">
                    <span className="current-price">{convert(product.price, currency)} {currency}</span>
                    <span className="product-rating">
                      {[...Array(fullStars)].map((_, i) => <span key={`f-${i}`}>★</span>)}
                      {halfStar && <span>★</span>}
                      {[...Array(emptyStars)].map((_, i) => <span key={`e-${i}`}>☆</span>)}
                      
                      <span className="avg"> {avg > 0 ? avg.toFixed(1) : "No reviews"}</span>
                      <span className="count"></span>
                    </span>
                  </div>

                  <div className="card-footer">
                    <span className="category-label">{getCategoryName(product.category_id)}</span>
                    <span className="category-label">{new Date(product.created_at).toISOString().split("T")[0]}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Loading states */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {loadingMore && (
        <div className="loading-more-container">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {/* Intersection Observer trigger */}
      {!loading && !loadingMore && hasMore && (
        <div ref={observerRef} className="scroll-trigger" />
      )}
      
      {/* End of products message */}
      {!hasMore && products.length > 0 && (
        <div className="end-message">
          <p>You've reached the end of the product catalog</p>
        </div>
      )}

      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} addToCart={addToCart} categoriesMap={categoriesMap} />}
    </div>
  );
}
