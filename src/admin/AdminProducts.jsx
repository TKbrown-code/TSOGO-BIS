// src/admin/AdminProducts.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminProductForm from "./AdminProductForm";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        categories(name),
        product_tags(tag)
      `)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setProducts(data || []);

    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert(error.message);
    else setProducts(p => p.filter(x => x.id !== id));
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Products</h2>
        <button onClick={() => setEditing({})}>New Product</button>
      </div>

      {editing && (
        <AdminProductForm
          product={editing}
          onSaved={() => { setEditing(null); loadProducts(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? <p>Loading...</p> : (
        <div style={{ display: "grid", gap: 12 }}>
          {products.map(p => {
            const tags = p.product_tags?.map(t => t.tag) || [];
            const isPromotion = tags.includes("promotion");
            const isNewArrival = tags.includes("new_arrival");
            const isBestseller = tags.includes("bestseller");
            const isFeatured = tags.includes("featured");

            return (
              <div key={p.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, display: "flex", gap: 12, alignItems: "center" }}>
                <img src={(p.images && p.images[0]?.publicUrl) || "/placeholder.png"} alt={p.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }} />
                
                <div style={{ flex: 1 }}>
                  <strong>{p.name}</strong>
                  <div>${Number(p.price).toFixed(2)} • {p.categories?.name || "Uncategorized"}</div>
                  <small style={{ color: "#666" }}>{p.description}</small>

                  <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                    {isNewArrival && <span className="badge new-arrival">New Arrival</span>}
                    {isPromotion && <span className="badge promotion">Promotion</span>}
                    {isBestseller && <span className="badge bestseller">Bestseller</span>}
                    {isFeatured && <span className="badge featured">Featured</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(p)}>Edit</button>
                  <button onClick={() => handleDelete(p.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
