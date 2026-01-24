// src/pages/Shop.jsx - Enhanced with Search and Filters
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useCurrencyContext } from "../context/CurrencyContext";
import { getDownloadUrl } from "../hooks/productimages";
import { ShoppingBag, Search, Folder, RefreshCw, DollarSign } from "lucide-react";
import "../styles/shop.css";
import NewArrivals from "../components/NewArrivals";
import TaggedProduct from "../components/TaggedProducts"

export default function Shop() {
  const { t } = useTranslation();
  const { convert, currency } = useCurrencyContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [images, setImages] = useState({});
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);

  // Fetch products and categories
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch products with categories and subcategories
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(`
          *,
          categories(id, name),
          product_images(image_path)
        `);

      if (productError) {
        console.error("Product fetch error:", productError);
        setLoading(false);
        return;
      }

      // Process images and products
      const processedProducts = productData.map(product => {
        // Get the first image from product_images array
        const firstImage = product.product_images && product.product_images.length > 0 
          ? product.product_images[0].image_path 
          : null;
        
        return {
          ...product,
          image: firstImage
        };
      });
      
      // Try to fetch subcategories separately to avoid breaking if column doesn't exist
      let productsWithSubcategories = productData || [];
      try {
        const { data: productsWithSubs } = await supabase
          .from("products")
          .select(`
            id,
            subcategory_id,
            subcategories(id, name)
          `);
        
        if (productsWithSubs) {
          // Merge subcategory data into products
          productsWithSubcategories = processedProducts.map(product => {
            const subData = productsWithSubs.find(p => p.id === product.id);
            return {
              ...product,
              subcategory_id: subData?.subcategory_id,
              subcategories: subData?.subcategories
            };
          });
        } else {
          productsWithSubcategories = processedProducts;
        }
      } catch (err) {
        console.warn("Subcategories not available:", err);
        // Continue without subcategories
      }

      // Create image mapping for easy lookup
      const imageMap = {};
      productsWithSubcategories.forEach(product => {
        if (product.image) {
          imageMap[product.id] = product.image;
        }
      });
      setImages(imageMap);
      
      setProducts(productsWithSubcategories);

      // Fetch categories
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (!categoryError) {
        setCategories(categoryData || []);
      }
      
      // Fetch subcategories
      const { data: subcategoryData, error: subcategoryError } = await supabase
        .from("subcategories")
        .select("*")
        .order("name");

      if (!subcategoryError) {
        setSubcategories(subcategoryData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Get search query from URL params
  useEffect(() => {
    const query = searchParams.get("search");
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);
  
  // Filter subcategories when category changes
  useEffect(() => {
    if (selectedCategory !== "all") {
      const filtered = subcategories.filter(sub => sub.category_id === parseInt(selectedCategory));
      setFilteredSubcategories(filtered);
    } else {
      setFilteredSubcategories([]);
    }
    setSelectedSubcategory("all"); // Reset subcategory when category changes
  }, [selectedCategory, subcategories]);

  // Filter and sort products
  useEffect(() => {
    let filtered = [...products];

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category_id === parseInt(selectedCategory));
    }
    
    // Filter by subcategory
    if (selectedSubcategory !== "all") {
      filtered = filtered.filter(p => p.subcategory_id === parseInt(selectedSubcategory));
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price-high":
          return parseFloat(b.price) - parseFloat(a.price);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory, selectedSubcategory, sortBy]);

  const handleProductClick = (productId, productName) => {
    navigate(`/ProductDetails/${productId}/${productName}`);
  };

  return (
    <div className="shop-page">
        <div className="shop-header">
          <h1 className="shop-title"><ShoppingBag className="inline-block mr-2" size={28} /> {t('products.shop_all')}</h1>
          <p className="shop-subtitle">{t('products.shop_subtitle')}</p>
        </div>

        <div className="shop-container-centered">
          {/* Filters Bar */}
          <div className="shop-filters-bar">
            <div className="filter-group">
              <input
                type="text"
                placeholder={t('products.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="filter-search-input"
              />
            </div>

            <div className="filter-group">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="filter-category-select"
              >
                <option value="all">{t('products.all_categories')} ({products.length})</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({products.filter(p => p.category_id === cat.id).length})
                  </option>
                ))}
              </select>
            </div>

            {filteredSubcategories.length > 0 && (
              <div className="filter-group">
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  className="filter-category-select"
                >
                  <option value="all">All Subcategories</option>
                  {filteredSubcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({products.filter(p => p.subcategory_id === sub.id).length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="filter-group">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-sort-select"
              >
                <option value="name">{t('products.name_az')}</option>
                <option value="price-low">{t('products.price_low')}</option>
                <option value="price-high">{t('products.price_high')}</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="shop-results-info">
            <p className="results-count">
              {t('products.showing')} <strong>{filteredProducts.length}</strong> {t('products.of')} <strong>{products.length}</strong> {t('products.products')}
            </p>
          </div>

          {/* Products Grid */}
          <div className="shop-content-centered">

            {loading ? (
              <div className="shop-loading">
                <div className="spinner"></div>
                <p>{t('products.loading')}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="no-products">
                <div className="no-products-icon">📦</div>
                <h3>{t('products.no_products')}</h3>
                <p>{t('products.try_adjusting')}</p>
              </div>
            ) : (
              <div className="products-grid-4col">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="product-card"
                    onClick={() => handleProductClick(p.id, p.name)}
                  >
                    <div className="product-image-wrapper">
                      <img
                        src={images[p.id] || "/placeholder.png"}
                        alt={p.name}
                        className="product-image"
                      />
                      {p.in_Stock === false && (
                        <div className="out-of-stock-badge">{t('product.out_of_stock')}</div>
                      )}
                    </div>
                    <div className="product-info">
                      <h3 className="product-name">{p.name}</h3>
                      <p className="product-description">
                        {p.description?.substring(0, 80)}
                        {p.description?.length > 80 ? "..." : ""}
                      </p>
                      <div className="product-footer">
                        <span className="product-price">
                          {convert(p.price, currency)} {currency}
                        </span>
                        {p.categories && (
                          <span className="product-category">
                            {p.categories.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
