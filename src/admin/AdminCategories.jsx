import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/AdminCategories.css";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  // Load all categories from the categories table
  async function loadCategories() {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) return console.error("Load categories error:", error);
    setCategories(data || []);
  }

  // Add a new category
  async function addCategory() {
    if (!newCategory.trim()) return alert("Category name cannot be empty");

    const { error } = await supabase.from("categories").insert({ name: newCategory.trim() }).select();
    if (error) return alert(error.message);

    setNewCategory("");
    loadCategories();
  }

  // Delete a category
  async function deleteCategory(id, name) {
    if (!confirm(`Delete category "${name}"? This will not delete products.`)) return;

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return alert(error.message);

    loadCategories();
  }

  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
      <h3>Categories</h3>

      {categories.length === 0 && <p>No categories found.</p>}
      <ul>
        {categories.map((c) => (
          <li key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span>{c.name}</span>
            <button onClick={() => deleteCategory(c.id, c.name)} style={{ color: "red" }}>Delete</button>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input
          placeholder="New category"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button onClick={addCategory}>Add</button>
      </div>
    </div>
  );
}
