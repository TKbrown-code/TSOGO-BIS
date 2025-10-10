import React, { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabase";
import ProductModal from "./ProductModal";
import "../styles/products.css";
import { useCurrencyContext } from "../context/CurrencyContext";
import { preloadAllImages, getCachedImage } from "../utils/imageCache";
import { useTranslation } from "react-i18next";

export default function Products({ selectedCategory }) {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { convert, currency } = useCurrencyContext();

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;
  const [images, setImages] = useState({});
  const [rating, setRating] = useState(0);

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
  }, [page, selectedCategory]);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from("products")
        .select(`
          *,
          product_images!inner(image_path,is_primary),
          product_tags!inner(tag)
        `, { count: "exact" })
        .eq("product_tags.tag", "featured");

      if (selectedCategory && selectedCategory !== "All") {
        query = query.eq("category_id", selectedCategory);
      }

      const { data: productsData = [], count, error } = await query.range(
        (page - 1) * limit,
        page * limit - 1
      );
      if (error) throw error;

      const productRatings = {};
        productsData.forEach(p => {
        productRatings[p.id] = p.avg_rating || 0;
      });
      setRating(productRatings);

      // Batch fetch reviews
      const productIds = productsData.map(p => p.id).filter(Boolean);
      let reviewsData = [];
      if (productIds.length) {
        const { data: rdata = [], error: rerr } = await supabase
          .from("product_reviews")
          .select("product_id, rating")
          .in("product_id", productIds);
        if (rerr) {
          console.warn("reviews fetch error:", rerr);
        } else {
          reviewsData = rdata;
        }
      }

      const reviewsByProduct = reviewsData.reduce((acc, r) => {
        acc[r.product_id] = acc[r.product_id] || [];
        acc[r.product_id].push(r);
        return acc;
      }, {});

      const mapped = productsData.map(p => {
        const primaryImage = (p.product_images || []).find(img => img.is_primary)?.image_path || "/placeholder.png";
        const product_reviews = reviewsByProduct[p.id] || [];
        const avgRating = product_reviews.length
          ? Math.round((product_reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / product_reviews.length) * 10) / 10
          : 0;
        return { ...p, product_reviews, image_url: primaryImage, avg_rating: avgRating };
      });

      setProducts(mapped);
      setTotalPages(Math.max(1, Math.ceil((count || mapped.length) / limit)));

      // preload images
      const allImgs = mapped.flatMap(p => p.product_images || []);
      await preloadAllImages(allImgs);
      const urls = {};
      mapped.forEach(p => {
        urls[p.id] = p.image_url ? getCachedImage(p.image_url) : "/placeholder.png";
      });
      setImages(urls);

    } catch (err) {
      console.error("fetchProducts error:", err);
    }
  };

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
    <div className="home-container">
      <div className="product-header"><h2>{t("featured_products")}</h2></div>

      <div className="products">
        {products.map(product => {
          
          const avg = rating[product.id] || 0;

          // ✅ Calculate star distribution
          const roundedToHalf = Math.round(avg * 2) / 2;
          const fullStars = Math.floor(roundedToHalf);
          const halfStar = roundedToHalf - fullStars === 0.5;
          const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

          return (
            <div className="product-card" key={product.id} onClick={() => setSelectedProduct(product)}>
              <div className="product-image-wrapper">
                <img src={images[product.id] || "/placeholder.png"} alt={product.name} className="product-image" />
              </div>

              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="product-Details">{product.description}</p>

                <div className="price-rating">
                  <div className="price">
                  {product.new_price && <span className="new-price">{convert(product.new_price, currency)} {currency}</span>}
                    <span style={product.new_price && {color:"grey",textDecoration:"line-through",fontSize:"0.75rem"}} className="current-price">{convert(product.price, currency)} {currency}</span>
                  </div>
                  <span className="product-rating">
                    {[...Array(fullStars)].map((_, i) => <span key={`f-${i}`}>★</span>)}
                    {halfStar && <span>★</span>}
                    {[...Array(emptyStars)].map((_, i) => <span key={`e-${i}`}>☆</span>)}
                    
                    <span className="avg"> {avg > 0 ? avg.toFixed(1) : ""}</span>
                    <span className="count"> ({avg})</span>
                  </span>
                </div>

                <div className="card-footer">
                  <span className="category-label">{getCategoryName(product.category_id)}</span>
                  <span className="category-label">{new Date(product.created_at).toISOString().split("T")[0]}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => (
          <button key={i} className={`btn page-btn`} onClick={() => setPage(i + 1)}>{i + 1}</button>
        ))}
      </div>

      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} addToCart={addToCart} categoriesMap={categoriesMap} />}
    </div>
  );
}
