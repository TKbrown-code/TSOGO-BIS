// src/admin/AdminProducts.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminProductFormEnhanced from "./AdminProductFormEnhanced";
import { Package, BarChart3, DollarSign, Search, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import "../styles/AdminProducts.css";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        category_id(id, name),
        product_tags(tag),
        product_images(id, image_path, is_primary)
      `)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else {
      // Get public URLs for images
      const productsWithImages = data?.map(product => {
        const images = product.product_images?.map(img => {
          const { data: urlData } = supabase.storage
            .from("products-images")
            .getPublicUrl(img.image_path);
          return { ...img, publicUrl: urlData.publicUrl };
        });
        return { ...product, images };
      });
      setProducts(productsWithImages || []);
    }

    setLoading(false);
  }

  async function loadCategories() {
    const { data } = await supabase.from("categories").select("*");
    if (data) setCategories(data);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert(error.message);
    else setProducts(p => p.filter(x => x.id !== id));
  }

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || p.category_id?.id === parseInt(filterCategory);
    const matchesTag = !filterTag || p.product_tags?.some(t => t.tag === filterTag);
    return matchesSearch && matchesCategory && matchesTag;
  });

  // Statistics
  const stats = {
    total: products.length,
    inStock: products.filter(p => p.in_Stock === "In Stock").length,
    outOfStock: products.filter(p => p.in_Stock === "Out of Stock").length,
    avgPrice: products.length > 0 
      ? (products.reduce((sum, p) => sum + parseFloat(p.price || 0), 0) / products.length).toFixed(2)
      : 0
  };

  return (
    <div className="admin-products">
      {/* Header */}
      <div className="products-header">
        <div>
          <h2><Package className="inline-block mr-2" size={28} /> Products Management</h2>
          <p className="subtitle">Manage your product catalog</p>
        </div>
        <button onClick={() => setEditing({})} className="btn-new-product">
          + New Product
        </button>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><BarChart3 size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Products</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.inStock}</div>
            <div className="stat-label">In Stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><XCircle size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.outOfStock}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><DollarSign size={24} /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.avgPrice} XAF</div>
            <div className="stat-label">Avg Price</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="">All Tags</option>
          <option value="promotion">Promotion</option>
          <option value="new_arrival">New Arrival</option>
          <option value="bestseller">Bestseller</option>
          <option value="featured">Featured</option>
        </select>
        {(searchQuery || filterCategory || filterTag) && (
          <button
            onClick={() => {
              setSearchQuery("");
              setFilterCategory("");
              setFilterTag("");
            }}
            className="btn-clear-filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Product Form Modal */}
      {editing && (
        <AdminProductFormEnhanced
          product={editing}
          onSaved={() => { setEditing(null); loadProducts(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Products Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Package size={48} /></div>
          <h3>No products found</h3>
          <p>
            {searchQuery || filterCategory || filterTag
              ? "Try adjusting your filters"
              : "Get started by creating your first product"}
          </p>
          {!searchQuery && !filterCategory && !filterTag && (
            <button onClick={() => setEditing({})} className="btn-new-product">
              + Create Product
            </button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Tags</th>
                <th>Options</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const tags = p.product_tags?.map(t => t.tag) || [];
                const primaryImage = p.images?.find(img => img.is_primary) || p.images?.[0];

                return (
                  <tr key={p.id}>
                    <td>
                      <img 
                        src={primaryImage?.publicUrl || "/placeholder.png"} 
                        alt={p.name}
                        className="table-product-image"
                      />
                    </td>
                    <td>
                      <div className="product-name-cell">
                        <strong>{p.name}</strong>
                        {p.description && (
                          <div className="product-description-preview">
                            {p.description.substring(0, 60)}
                            {p.description.length > 60 && "..."}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{p.category_id?.name || "—"}</td>
                    <td className="price-cell">{Number(p.price).toLocaleString()} XAF</td>
                    <td>
                      <span className={`stock-badge ${p.in_Stock === "In Stock" ? "in-stock" : "out-of-stock"}`}>
                        {p.in_Stock}
                      </span>
                    </td>
                    <td>
                      <div className="tags-cell">
                        {tags.length > 0 ? (
                          tags.map(tag => (
                            <span key={tag} className={`tag-badge ${tag}`}>
                              {tag.replace("_", " ")}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {p.options ? (
                        <span className="options-indicator">
                          {Object.keys(p.options).length} group(s)
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={() => setEditing(p)} className="btn-edit" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="btn-delete" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
