import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useModalMessage } from "../../context/ModalMessageContext";
import { supabase } from "../../lib/supabase";
import AdminProductFormEnhanced from "./AdminProductFormEnhanced";
import { ArrowUpRight, Boxes, CheckCircle2, CircleDollarSign, Edit3, ExternalLink, Filter, Package, Plus, RefreshCw, Search, Trash2, XCircle, Download } from "lucide-react";
import { exportCsv } from "../utils/exportCsv";
import "./AdminProducts.css";
import Fallbackimage from "../../assets/imagefallback.jpg";

function getStock(product) {
  if (product.stock_quantity !== null && product.stock_quantity !== undefined) {
    const quantity = Number(product.stock_quantity) || 0;
    return { quantity, state: quantity < 1 ? "out" : quantity <= 5 ? "low" : "in" };
  }
  const oldStatus = String(product.in_Stock ?? "").toLowerCase();
  return { quantity: null, state: oldStatus === "true" || oldStatus === "in stock" ? "in" : "out" };
}

function productRoute(product) {
  return `/ProductDetails/${product.id}/${encodeURIComponent(product.name || "product")}`;
}

export default function AdminProducts() {
  const { confirmDialog, showAlert } = useModalMessage();
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterStock, setFilterStock] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [categories, setCategories] = useState([]);

  const loadProducts = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    const [productResult, categoryResult] = await Promise.all([
      supabase.from("products").select("*,category_id(id,name),product_tags(tag),product_images(id,image_url,storage_path,is_primary)").order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name").order("name", { ascending: true }),
    ]);
    if (productResult.error) {
      console.error("Error loading products:", productResult.error);
      setError("Products could not be loaded. Check your connection and admin access, then refresh.");
    } else {
      setProducts((productResult.data || []).map((product) => ({
        ...product,
        images: (product.product_images || []).map((image) => ({ ...image, publicUrl: image.image_url })),
      })));
    }
    if (categoryResult.error) console.error("Error loading product categories:", categoryResult.error);
    else setCategories(categoryResult.data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const stockSummary = useMemo(() => products.reduce((summary, product) => {
    const stock = getStock(product);
    if (stock.state === "in") summary.inStock++;
    if (stock.state === "out") summary.outOfStock++;
    if (stock.state === "low") summary.lowStock++;
    return summary;
  }, { inStock: 0, outOfStock: 0, lowStock: 0 }), [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const tags = product.product_tags?.map((item) => item.tag) || [];
      const categoryId = product.category_id && typeof product.category_id === "object" ? product.category_id.id : product.category_id;
      const searchText = `${product.name || ""} ${product.description || ""} ${product.category_id?.name || ""}`.toLowerCase();
      const stock = getStock(product);
      return (!normalizedQuery || searchText.includes(normalizedQuery))
        && (!filterCategory || String(categoryId) === filterCategory)
        && (!filterTag || tags.includes(filterTag))
        && (!filterStock || stock.state === filterStock);
    });
    return filtered.sort((a, b) => {
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "price-high") return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === "stock-low") return (getStock(a).quantity ?? 999999) - (getStock(b).quantity ?? 999999);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [products, searchQuery, filterCategory, filterTag, filterStock, sortBy]);

  const clearFilters = () => { setSearchQuery(""); setFilterCategory(""); setFilterTag(""); setFilterStock(""); };

  async function handleDelete(product) {
    const confirmed = await confirmDialog(`Delete “${product.name}”? This will remove it from the storefront.`, "Delete product", { confirmLabel: "Delete product", cancelLabel: "Keep product", tone: "danger" });
    if (!confirmed) return;
    const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
    if (deleteError) {
      showAlert(deleteError.message, "Could not delete product", "error");
      return;
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
    showAlert("Product removed from the catalog.", "Product deleted", "success");
  }

  const activeFilters = Boolean(searchQuery || filterCategory || filterTag || filterStock);

  return (
    <main className="admin-products">
      <header className="products-heading">
        <div><span className="products-eyebrow">CATALOG MANAGEMENT</span><h1>Products</h1><p>Keep your catalog, inventory, and storefront listings in sync.</p></div>
        <div className="products-heading-actions">
          <button type="button" className="products-refresh" onClick={() => exportCsv("tsogo-products.csv", products.map((product) => ({ ...product, images: product.images?.map((image) => image.publicUrl || image.image_url), product_tags: product.product_tags?.map((item) => item.tag) })))} disabled={!products.length}><Download size={15} />Export products</button>
          <button type="button" className="products-refresh" onClick={() => loadProducts(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "is-refreshing" : ""} />{refreshing ? "Refreshing" : "Refresh"}</button>
          <button type="button" onClick={() => setEditing({})} className="btn-new-product"><Plus size={17} />Add product</button>
        </div>
      </header>

      <section className="products-summary" aria-label="Catalog summary">
        <article><span className="products-summary-icon"><Package size={18} /></span><div><small>Catalog products</small><strong>{products.length.toLocaleString()}</strong></div></article>
        <article><span className="products-summary-icon green"><CheckCircle2 size={18} /></span><div><small>Available</small><strong>{stockSummary.inStock.toLocaleString()}</strong></div></article>
        <article><span className="products-summary-icon amber"><Boxes size={18} /></span><div><small>Running low</small><strong>{stockSummary.lowStock.toLocaleString()}</strong></div></article>
        <article><span className="products-summary-icon red"><XCircle size={18} /></span><div><small>Out of stock</small><strong>{stockSummary.outOfStock.toLocaleString()}</strong></div></article>
      </section>

      <section className="products-catalog-panel">
        <div className="catalog-panel-heading"><div><h2>Catalog</h2><p>{filteredProducts.length} of {products.length} products</p></div><span className="catalog-count-icon"><CircleDollarSign size={18} /></span></div>
        <div className="products-filters">
          <label className="products-search"><Search size={17} /><input type="search" placeholder="Search products, descriptions, or categories" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
          <select aria-label="Filter by category" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select aria-label="Filter by collection tag" value={filterTag} onChange={(event) => setFilterTag(event.target.value)}><option value="">All collections</option><option value="promotion">Promotion</option><option value="new_arrival">New arrival</option><option value="bestseller">Bestseller</option><option value="featured">Featured</option></select>
          <select aria-label="Filter by stock" value={filterStock} onChange={(event) => setFilterStock(event.target.value)}><option value="">All stock</option><option value="in">Available</option><option value="low">Running low</option><option value="out">Out of stock</option></select>
          <select aria-label="Sort products" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="price-high">Price: high to low</option><option value="stock-low">Stock: low to high</option></select>
          {activeFilters && <button type="button" onClick={clearFilters} className="clear-product-filters"><Filter size={14} />Clear filters</button>}
        </div>
      </section>

      {editing && <AdminProductFormEnhanced product={editing} onSaved={() => { setEditing(null); loadProducts(true); }} onCancel={() => setEditing(null)} />}

      {error && <div className="products-error" role="alert">{error}<button type="button" onClick={() => loadProducts(true)}>Try again</button></div>}

      {loading ? <div className="products-skeleton-grid" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index}><i /><span /><span /><b /></div>)}</div>
        : filteredProducts.length === 0 ? <section className="products-empty"><span><Package size={25} /></span><h3>{products.length ? "No products match these filters" : "Your catalog is ready to begin"}</h3><p>{products.length ? "Adjust your search or filters to see more products." : "Add your first product to start building the storefront."}</p>{products.length ? <button type="button" className="products-empty-action" onClick={clearFilters}>Clear filters</button> : <button type="button" className="btn-new-product" onClick={() => setEditing({})}><Plus size={16} />Add your first product</button>}</section>
          : <section className="products-card-grid" aria-label="Product catalog">{filteredProducts.map((product) => {
            const primaryImage = product.images?.find((image) => image.is_primary) || product.images?.[0];
            const tags = product.product_tags?.map((item) => item.tag) || [];
            const stock = getStock(product);
            const category = product.category_id?.name || "Uncategorized";
            return <article className="catalog-product-card" key={product.id}>
              <Link className="catalog-product-image" to={productRoute(product)} aria-label={`View ${product.name} in the storefront`}><img src={primaryImage?.publicUrl || Fallbackimage} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.src = Fallbackimage; }} /><span className={`catalog-stock-pill ${stock.state}`}>{stock.state === "out" ? "Out of stock" : stock.state === "low" ? `Low · ${stock.quantity} left` : stock.quantity === null ? "Available" : `${stock.quantity} in stock`}</span><span className="catalog-view-overlay">View storefront <ExternalLink size={14} /></span></Link>
              <div className="catalog-product-body"><div className="catalog-product-meta"><span>{category}</span><span>SKU · {product.id}</span></div><Link to={productRoute(product)} className="catalog-product-title">{product.name}</Link><p className="catalog-product-description">{product.description || "No product description has been added yet."}</p><div className="catalog-product-bottom"><strong>{Number(product.price || 0).toLocaleString()} <small>XAF</small></strong><span className={`catalog-stock-label ${stock.state}`}><i />{stock.state === "out" ? "Unavailable" : stock.state === "low" ? "Low stock" : "In stock"}</span></div>{tags.length > 0 && <div className="catalog-product-tags">{tags.map((tag) => <span key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>}<div className="catalog-product-actions"><Link to={productRoute(product)} className="catalog-view-link">Preview product <ArrowUpRight size={14} /></Link><div><button type="button" className="catalog-edit-button" onClick={() => setEditing(product)} aria-label={`Edit ${product.name}`} title="Edit product"><Edit3 size={15} /></button><button type="button" className="catalog-delete-button" onClick={() => handleDelete(product)} aria-label={`Delete ${product.name}`} title="Delete product"><Trash2 size={15} /></button></div></div></div>
            </article>;
          })}</section>}
    </main>
  );
}
