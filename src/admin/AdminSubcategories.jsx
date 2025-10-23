// src/admin/AdminSubcategories.jsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Plus, Edit2, Trash2, Save, X, Folder } from "lucide-react";
import "../styles/AdminCategories.css";

export default function AdminSubcategories() {
  const { t } = useTranslation();
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    category_id: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Load subcategories with category info
      const { data: subcategoriesData, error: subcategoriesError } = await supabase
        .from("subcategories")
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .order("name");

      if (subcategoriesError) throw subcategoriesError;
      setSubcategories(subcategoriesData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.category_id) {
      alert("Please fill in all fields");
      return;
    }

    try {
      if (editingId) {
        // Update existing subcategory
        const { error } = await supabase
          .from("subcategories")
          .update({
            name: formData.name.trim(),
            category_id: formData.category_id
          })
          .eq("id", editingId);

        if (error) throw error;
        alert("Subcategory updated successfully!");
      } else {
        // Create new subcategory
        const { error } = await supabase
          .from("subcategories")
          .insert([{
            name: formData.name.trim(),
            category_id: formData.category_id
          }]);

        if (error) throw error;
        alert("Subcategory created successfully!");
      }

      setFormData({ name: "", category_id: "" });
      setEditingId(null);
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error("Error saving subcategory:", error);
      alert("Failed to save subcategory: " + error.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this subcategory? This will affect all products in this subcategory.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("subcategories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      alert("Subcategory deleted successfully!");
      loadData();
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      alert("Failed to delete subcategory: " + error.message);
    }
  }

  function handleEdit(subcategory) {
    setFormData({
      name: subcategory.name,
      category_id: subcategory.category_id
    });
    setEditingId(subcategory.id);
    setShowForm(true);
  }

  function handleCancel() {
    setFormData({ name: "", category_id: "" });
    setEditingId(null);
    setShowForm(false);
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading subcategories...</p>
      </div>
    );
  }

  return (
    <div className="admin-categories">
      <div className="categories-header">
        <h1><Folder className="inline-block mr-2" size={28} /> Manage Subcategories</h1>
        <button 
          className="btn-add" 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          {showForm ? "Cancel" : "Add Subcategory"}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="category-form-card">
          <h2>{editingId ? "Edit Subcategory" : "Add New Subcategory"}</h2>
          <form onSubmit={handleSubmit} className="category-form">
            <div className="form-group">
              <label>Parent Category *</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                required
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Subcategory Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter subcategory name"
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-save">
                <Save size={18} className="inline-block mr-1" />
                {editingId ? "Update" : "Create"}
              </button>
              <button type="button" onClick={handleCancel} className="btn-cancel">
                <X size={18} className="inline-block mr-1" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subcategories List */}
      <div className="categories-list">
        <h2>All Subcategories ({subcategories.length})</h2>
        
        {subcategories.length === 0 ? (
          <div className="empty-state">
            <Folder size={48} />
            <p>No subcategories found</p>
            <p className="empty-subtitle">Create your first subcategory to get started</p>
          </div>
        ) : (
          <div className="categories-grid">
            {subcategories.map(subcategory => (
              <div key={subcategory.id} className="category-card">
                <div className="category-info">
                  <h3>{subcategory.name}</h3>
                  <p className="category-parent">
                    Parent: {subcategory.categories?.name || "N/A"}
                  </p>
                </div>
                <div className="category-actions">
                  <button 
                    className="btn-edit" 
                    onClick={() => handleEdit(subcategory)}
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    className="btn-delete" 
                    onClick={() => handleDelete(subcategory.id)}
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
