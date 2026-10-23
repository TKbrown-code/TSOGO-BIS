import { showSiteModal as alert } from "../../utils/siteModal";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Check, FolderTree, Layers3, Package, Plus, RefreshCw, Search, Tag, Trash2, X } from "lucide-react";
import "./AdminCategories.css";

const emptyForm = { name: "", slug: "", description: "", category_id: "", is_active: true };
const slugify = (value) => value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminSubcategories() {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    const [categoriesResult, subcategoriesResult, productsResult] = await Promise.all([
      supabase.from("categories").select("id,name,slug,is_active").order("name"),
      supabase.from("subcategories").select("id,name,slug,description,category_id,sort_order,is_active,created_at").order("sort_order", { ascending: true }).order("name"),
      supabase.from("products").select("id,subcategory_id"),
    ]);
    if (categoriesResult.error || subcategoriesResult.error) {
      const error = categoriesResult.error || subcategoriesResult.error;
      console.error("Could not load categories and subcategories:", error);
      setLoadError(error.message || "Category data could not be loaded.");
      setCategories([]);
      setSubcategories([]);
    } else {
      if (productsResult.error) console.warn("Could not load subcategory product counts:", productsResult.error);
      const categoryById = Object.fromEntries((categoriesResult.data || []).map((category) => [category.id, category]));
      const productCounts = (productsResult.data || []).reduce((counts, product) => {
        if (product.subcategory_id != null) counts[product.subcategory_id] = (counts[product.subcategory_id] || 0) + 1;
        return counts;
      }, {});
      setCategories(categoriesResult.data || []);
      setSubcategories((subcategoriesResult.data || []).map((subcategory) => ({
        ...subcategory,
        parent_category: categoryById[subcategory.category_id],
        product_count: productCounts[subcategory.id] || 0,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function openCreate() {
    setEditingSubcategory(null);
    setForm({ ...emptyForm, category_id: categories[0]?.id ? String(categories[0].id) : "" });
    setEditorOpen(true);
  }

  function openEdit(subcategory) {
    setEditingSubcategory(subcategory);
    setForm({ name: subcategory.name || "", slug: subcategory.slug || slugify(subcategory.name || ""), description: subcategory.description || "", category_id: String(subcategory.category_id), is_active: subcategory.is_active !== false });
    setEditorOpen(true);
  }

  async function saveSubcategory(event) {
    event.preventDefault();
    const name = form.name.trim();
    const slug = slugify(form.slug || name);
    if (!name || !slug || !form.category_id) return alert("Choose a parent category and enter a subcategory name.");
    setSaving(true);
    const values = { name, slug, description: form.description.trim() || null, category_id: Number(form.category_id), is_active: form.is_active };
    const query = editingSubcategory
      ? supabase.from("subcategories").update(values).eq("id", editingSubcategory.id)
      : supabase.from("subcategories").insert(values);
    const { error } = await query;
    setSaving(false);
    if (error) return alert(`Could not save subcategory: ${error.message}`);
    setEditorOpen(false);
    await loadData();
  }

  async function toggleVisibility(subcategory) {
    const { error } = await supabase.from("subcategories").update({ is_active: !subcategory.is_active }).eq("id", subcategory.id);
    if (error) return alert(`Could not update subcategory: ${error.message}`);
    setSubcategories((current) => current.map((item) => item.id === subcategory.id ? { ...item, is_active: !subcategory.is_active } : item));
  }

  async function deleteSubcategory(subcategory) {
    if (!window.confirm(`Delete “${subcategory.name}”? Products assigned to it will keep their category and lose only this subcategory.`)) return;
    const { error } = await supabase.from("subcategories").delete().eq("id", subcategory.id);
    if (error) return alert(`Could not delete subcategory: ${error.message}`);
    setSubcategories((current) => current.filter((item) => item.id !== subcategory.id));
  }

  const visibleSubcategories = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return subcategories.filter((subcategory) => {
      const matchesSearch = !needle || [subcategory.name, subcategory.slug, subcategory.description, subcategory.parent_category?.name].some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesCategory = categoryFilter === "all" || String(subcategory.category_id) === categoryFilter;
      const matchesVisibility = visibilityFilter === "all" || (visibilityFilter === "active" ? subcategory.is_active : !subcategory.is_active);
      return matchesSearch && matchesCategory && matchesVisibility;
    });
  }, [subcategories, searchQuery, categoryFilter, visibilityFilter]);

  const stats = useMemo(() => ({
    total: subcategories.length,
    active: subcategories.filter((item) => item.is_active).length,
    products: subcategories.reduce((sum, item) => sum + item.product_count, 0),
    parents: new Set(subcategories.map((item) => item.category_id)).size,
  }), [subcategories]);

  return (
    <main className="admin-categories-page admin-subcategories-page">
      <header className="admin-categories-heading"><div><span className="admin-categories-eyebrow">CATALOG ORGANIZATION</span><h1>Subcategories</h1><p>Group products within their parent categories for a clearer, easier-to-browse shop.</p></div><div className="admin-categories-heading-actions"><button type="button" className="categories-refresh" onClick={loadData} disabled={loading}><RefreshCw size={15} className={loading ? "categories-spin" : ""} />Refresh</button><button type="button" className="categories-create" onClick={openCreate} disabled={!categories.length}><Plus size={16} />New subcategory</button></div></header>

      <section className="admin-categories-summary" aria-label="Subcategory summary"><article><span><FolderTree size={18} /></span><div><strong>{stats.total}</strong><small>Total subcategories</small></div></article><article><span className="is-active"><Check size={18} /></span><div><strong>{stats.active}</strong><small>Visible in shop</small></div></article><article><span className="is-products"><Layers3 size={18} /></span><div><strong>{stats.parents}</strong><small>Parent categories</small></div></article><article><span className="is-products"><Package size={18} /></span><div><strong>{stats.products}</strong><small>Products assigned</small></div></article></section>

      <section className="admin-categories-workspace"><header className="admin-categories-toolbar"><div><h2>Subcategory directory</h2><p>{visibleSubcategories.length} {visibleSubcategories.length === 1 ? "subcategory" : "subcategories"} shown</p></div><div className="admin-categories-filters"><label><Search size={16} /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by name or parent" aria-label="Search subcategories" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter parent category"><option value="all">All parent categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} aria-label="Filter visibility"><option value="all">All visibility</option><option value="active">Visible</option><option value="inactive">Hidden</option></select></div></header>
        {loadError && <div className="admin-categories-state is-error" role="alert"><p>Category data could not be loaded. {loadError}</p><button type="button" onClick={loadData}>Try again</button></div>}
        {loading ? <div className="admin-categories-loading" aria-label="Loading subcategories">{[0, 1, 2, 3].map((item) => <i key={item} />)}</div> : !loadError && visibleSubcategories.length === 0 ? <div className="admin-categories-state"><span><FolderTree size={22} /></span><h3>{subcategories.length ? "No matching subcategories" : categories.length ? "No subcategories yet" : "Create a parent category first"}</h3><p>{subcategories.length ? "Change your search or filters to find another subcategory." : categories.length ? "Add a subcategory to organize a parent category's products." : "Subcategories belong to a category. Create a category before adding one."}</p>{!subcategories.length && categories.length > 0 && <button type="button" onClick={openCreate}><Plus size={15} />Create subcategory</button>}</div> : !loadError && <div className="admin-category-list">{visibleSubcategories.map((subcategory) => <article className="admin-category-card" key={subcategory.id}><span className="admin-category-icon"><FolderTree size={19} /></span><div className="admin-category-info"><div className="admin-category-title"><h3>{subcategory.name}</h3><span className={`admin-category-visibility ${subcategory.is_active ? "is-visible" : "is-hidden"}`}>{subcategory.is_active ? "Visible" : "Hidden"}</span></div><p>{subcategory.description || "No description added yet."}</p><div className="admin-category-meta"><span className="subcategory-parent-label"><Layers3 size={13} />{subcategory.parent_category?.name || "Parent category unavailable"}</span><code>/{subcategory.parent_category?.slug ? `${subcategory.parent_category.slug}/` : ""}{subcategory.slug}</code><span><Package size={13} />{subcategory.product_count} {subcategory.product_count === 1 ? "product" : "products"}</span></div></div><div className="admin-category-actions"><button type="button" className="category-toggle" aria-pressed={subcategory.is_active} onClick={() => toggleVisibility(subcategory)}>{subcategory.is_active ? "Hide" : "Show"}</button><button type="button" className="category-edit" onClick={() => openEdit(subcategory)}>Edit</button><button type="button" className="category-delete" aria-label={`Delete ${subcategory.name}`} onClick={() => deleteSubcategory(subcategory)}><Trash2 size={15} /></button></div></article>)}</div>}
      </section>

      {editorOpen && <div className="admin-category-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}><section className="admin-category-modal" role="dialog" aria-modal="true" aria-labelledby="subcategory-modal-title"><header><div><span className="admin-categories-eyebrow">CATALOG SETTINGS</span><h2 id="subcategory-modal-title">{editingSubcategory ? "Edit subcategory" : "Create subcategory"}</h2><p>Choose its parent category and keep the name easy to browse.</p></div><button type="button" aria-label="Close" onClick={() => setEditorOpen(false)}><X size={18} /></button></header><form onSubmit={saveSubcategory}><label>Parent category<select required value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}><option value="">Choose a parent category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Subcategory name<input required maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: editingSubcategory ? current.slug : slugify(event.target.value) }))} placeholder="e.g. Storage" /></label><label>URL slug<input required maxLength={100} value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="storage" /></label><label>Description <small>Optional</small><textarea rows={3} maxLength={240} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="A short introduction to this subcategory" /></label><label className="category-active-option"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /><span><strong>Show in shop</strong><small>Customers can browse this subcategory.</small></span></label><footer><button type="button" className="category-modal-cancel" onClick={() => setEditorOpen(false)}>Cancel</button><button type="submit" className="category-modal-save" disabled={saving}>{saving ? "Saving…" : editingSubcategory ? "Save changes" : "Create subcategory"}</button></footer></form></section></div>}
    </main>
  );
}
