import { showSiteModal as alert } from "../utils/siteModal";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Check, ChevronDown, FolderTree, Layers3, Package, Plus, RefreshCw, Search, Tag, Trash2, X } from "lucide-react";
import "../styles/AdminCategories.css";

const emptyCategory = { name: "", slug: "", description: "", is_active: true };
const emptySubcategory = { name: "", slug: "", description: "", category_id: "", is_active: true };
const slugify = (value) => value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [editorType, setEditorType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyCategory);
  const [expanded, setExpanded] = useState({});

  async function loadCatalog() {
    setLoading(true);
    setLoadError("");
    const [categoriesResult, subcategoriesResult, productsResult] = await Promise.all([
      supabase.from("categories").select("id,name,slug,description,sort_order,is_active,created_at").order("sort_order", { ascending: true }).order("name"),
      supabase.from("subcategories").select("id,name,slug,description,category_id,sort_order,is_active,created_at").order("sort_order", { ascending: true }).order("name"),
      supabase.from("products").select("id,category_id,subcategory_id"),
    ]);
    const failure = categoriesResult.error || subcategoriesResult.error;
    if (failure) {
      console.error("Could not load category catalogue:", failure);
      setLoadError(failure.message || "Categories could not be loaded.");
      setCategories([]);
      setSubcategories([]);
    } else {
      if (productsResult.error) console.warn("Could not load category product counts:", productsResult.error);
      const categoryCounts = {};
      const subcategoryCounts = {};
      for (const product of productsResult.data || []) {
        if (product.category_id != null) categoryCounts[product.category_id] = (categoryCounts[product.category_id] || 0) + 1;
        if (product.subcategory_id != null) subcategoryCounts[product.subcategory_id] = (subcategoryCounts[product.subcategory_id] || 0) + 1;
      }
      const subcategoryRows = (subcategoriesResult.data || []).map((item) => ({ ...item, product_count: subcategoryCounts[item.id] || 0 }));
      setSubcategories(subcategoryRows);
      setCategories((categoriesResult.data || []).map((item) => {
        const children = subcategoryRows.filter((subcategory) => subcategory.category_id === item.id);
        return { ...item, product_count: categoryCounts[item.id] || 0, subcategory_count: children.length, subcategories: children };
      }));
    }
    setLoading(false);
  }

  useEffect(() => { loadCatalog(); }, []);

  function openCreateCategory() { setEditingItem(null); setForm(emptyCategory); setEditorType("category"); }
  function openEditCategory(category) { setEditingItem(category); setForm({ name: category.name || "", slug: category.slug || slugify(category.name || ""), description: category.description || "", is_active: category.is_active !== false }); setEditorType("category"); }
  function openCreateSubcategory(category) { setEditingItem(null); setForm({ ...emptySubcategory, category_id: String(category.id) }); setEditorType("subcategory"); }
  function openEditSubcategory(subcategory) { setEditingItem(subcategory); setForm({ name: subcategory.name || "", slug: subcategory.slug || slugify(subcategory.name || ""), description: subcategory.description || "", category_id: String(subcategory.category_id), is_active: subcategory.is_active !== false }); setEditorType("subcategory"); }

  async function saveItem(event) {
    event.preventDefault();
    const name = form.name.trim();
    const slug = slugify(form.slug || name);
    if (!name || !slug || (editorType === "subcategory" && !form.category_id)) return alert("Complete the required category fields.");
    setSaving(true);
    const values = { name, slug, description: form.description.trim() || null, is_active: form.is_active };
    const table = editorType === "category" ? "categories" : "subcategories";
    const payload = editorType === "subcategory" ? { ...values, category_id: Number(form.category_id) } : values;
    const query = editingItem ? supabase.from(table).update(payload).eq("id", editingItem.id) : supabase.from(table).insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) return alert(`Could not save ${editorType}: ${error.message}`);
    setEditorType(null);
    await loadCatalog();
  }

  async function toggleVisibility(type, item) {
    const table = type === "category" ? "categories" : "subcategories";
    const { error } = await supabase.from(table).update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) return alert(`Could not update visibility: ${error.message}`);
    if (type === "category") setCategories((current) => current.map((category) => category.id === item.id ? { ...category, is_active: !item.is_active } : category));
    else {
      const next = subcategories.map((subcategory) => subcategory.id === item.id ? { ...subcategory, is_active: !item.is_active } : subcategory);
      setSubcategories(next);
      setCategories((current) => current.map((category) => ({ ...category, subcategories: next.filter((subcategory) => subcategory.category_id === category.id) })));
    }
  }

  async function deleteItem(type, item) {
    const detail = type === "category" ? " Its subcategories will also be removed; products will remain." : " Products will keep their parent category.";
    if (!window.confirm(`Delete “${item.name}”?${detail}`)) return;
    const table = type === "category" ? "categories" : "subcategories";
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) return alert(`Could not delete ${type}: ${error.message}`);
    await loadCatalog();
  }

  const visibleCategories = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return categories.map((category) => {
      const children = category.subcategories.filter((subcategory) => {
        const matchesChild = !needle || [subcategory.name, subcategory.slug, subcategory.description].some((value) => String(value || "").toLowerCase().includes(needle));
        const matchesVisibility = visibilityFilter === "all" || (visibilityFilter === "active" ? subcategory.is_active : !subcategory.is_active);
        return matchesChild && matchesVisibility;
      });
      const matchesParent = !needle || [category.name, category.slug, category.description].some((value) => String(value || "").toLowerCase().includes(needle));
      const parentVisibility = visibilityFilter === "all" || (visibilityFilter === "active" ? category.is_active : !category.is_active);
      return { ...category, visibleSubcategories: matchesParent ? (visibilityFilter === "all" ? category.subcategories : category.subcategories.filter((item) => visibilityFilter === "active" ? item.is_active : !item.is_active)) : children, visible: (matchesParent && parentVisibility) || children.length > 0 };
    }).filter((category) => category.visible);
  }, [categories, searchQuery, visibilityFilter]);

  const stats = useMemo(() => ({
    totalCategories: categories.length,
    activeCategories: categories.filter((category) => category.is_active).length,
    totalSubcategories: subcategories.length,
    products: categories.reduce((sum, category) => sum + category.product_count, 0),
  }), [categories, subcategories]);

  return (
    <main className="admin-categories-page">
      <header className="admin-categories-heading"><div><span className="admin-categories-eyebrow">CATALOG ORGANIZATION</span><h1>Categories</h1><p>Manage your catalogue hierarchy in one place, from parent collections to product subcategories.</p></div><div className="admin-categories-heading-actions"><button type="button" className="categories-refresh" onClick={loadCatalog} disabled={loading}><RefreshCw size={15} className={loading ? "categories-spin" : ""} />Refresh</button><button type="button" className="categories-create" onClick={openCreateCategory}><Plus size={16} />New category</button></div></header>

      <section className="admin-categories-summary" aria-label="Catalogue summary"><article><span><Layers3 size={18} /></span><div><strong>{stats.totalCategories}</strong><small>Parent categories</small></div></article><article><span className="is-active"><Check size={18} /></span><div><strong>{stats.activeCategories}</strong><small>Visible categories</small></div></article><article><span className="is-products"><FolderTree size={18} /></span><div><strong>{stats.totalSubcategories}</strong><small>Subcategories</small></div></article><article><span className="is-products"><Package size={18} /></span><div><strong>{stats.products}</strong><small>Products in catalogue</small></div></article></section>

      <section className="admin-categories-workspace"><header className="admin-categories-toolbar"><div><h2>Category hierarchy</h2><p>{visibleCategories.length} {visibleCategories.length === 1 ? "category" : "categories"} shown · subcategories appear below each parent</p></div><div className="admin-categories-filters"><label><Search size={16} /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search categories and subcategories" aria-label="Search catalogue hierarchy" /></label><select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} aria-label="Filter visibility"><option value="all">All visibility</option><option value="active">Visible</option><option value="inactive">Hidden</option></select></div></header>

        {loadError && <div className="admin-categories-state is-error" role="alert"><p>Catalogue could not be loaded. {loadError}</p><button type="button" onClick={loadCatalog}>Try again</button></div>}
        {loading ? <div className="admin-categories-loading" aria-label="Loading catalogue">{[0, 1, 2, 3].map((item) => <i key={item} />)}</div> : !loadError && visibleCategories.length === 0 ? <div className="admin-categories-state"><span><Layers3 size={22} /></span><h3>{categories.length ? "No matching categories" : "No categories yet"}</h3><p>{categories.length ? "Adjust your search or visibility filter." : "Create a category to begin organizing your products."}</p>{!categories.length && <button type="button" onClick={openCreateCategory}><Plus size={15} />Create category</button>}</div> : !loadError && <div className="admin-category-list admin-category-hierarchy">{visibleCategories.map((category) => {
          const children = category.visibleSubcategories;
          const isExpanded = expanded[category.id] !== false;
          return <section className="admin-category-group" key={category.id}>
            <article className="admin-category-card admin-parent-category"><button type="button" className="category-expand" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category.name}`} aria-expanded={isExpanded} onClick={() => setExpanded((current) => ({ ...current, [category.id]: !isExpanded }))}><ChevronDown size={18} /></button><span className="admin-category-icon"><Tag size={19} /></span><div className="admin-category-info"><div className="admin-category-title"><h3>{category.name}</h3><span className={`admin-category-visibility ${category.is_active ? "is-visible" : "is-hidden"}`}>{category.is_active ? "Visible" : "Hidden"}</span></div><p>{category.description || "No description added yet."}</p><div className="admin-category-meta"><code>/{category.slug}</code><span><FolderTree size={13} />{category.subcategory_count} {category.subcategory_count === 1 ? "subcategory" : "subcategories"}</span><span><Package size={13} />{category.product_count} {category.product_count === 1 ? "product" : "products"}</span></div></div><div className="admin-category-actions"><button type="button" className="category-add-child" onClick={() => openCreateSubcategory(category)}><Plus size={14} />Subcategory</button><button type="button" className="category-toggle" aria-pressed={category.is_active} onClick={() => toggleVisibility("category", category)}>{category.is_active ? "Hide" : "Show"}</button><button type="button" className="category-edit" onClick={() => openEditCategory(category)}>Edit</button><button type="button" className="category-delete" aria-label={`Delete ${category.name}`} onClick={() => deleteItem("category", category)}><Trash2 size={15} /></button></div></article>
            {isExpanded && <div className="admin-subcategory-children">{children.length ? children.map((subcategory) => <article className="admin-subcategory-child" key={subcategory.id}><span className="subcategory-branch" aria-hidden="true" /><span className="admin-subcategory-icon"><FolderTree size={16} /></span><div className="admin-category-info"><div className="admin-category-title"><h4>{subcategory.name}</h4><span className={`admin-category-visibility ${subcategory.is_active ? "is-visible" : "is-hidden"}`}>{subcategory.is_active ? "Visible" : "Hidden"}</span></div><p>{subcategory.description || "No description added yet."}</p><div className="admin-category-meta"><code>/{category.slug}/{subcategory.slug}</code><span><Package size={13} />{subcategory.product_count} {subcategory.product_count === 1 ? "product" : "products"}</span></div></div><div className="admin-category-actions"><button type="button" className="category-toggle" aria-pressed={subcategory.is_active} onClick={() => toggleVisibility("subcategory", subcategory)}>{subcategory.is_active ? "Hide" : "Show"}</button><button type="button" className="category-edit" onClick={() => openEditSubcategory(subcategory)}>Edit</button><button type="button" className="category-delete" aria-label={`Delete ${subcategory.name}`} onClick={() => deleteItem("subcategory", subcategory)}><Trash2 size={15} /></button></div></article>) : <div className="admin-subcategory-empty"><FolderTree size={15} />No subcategories under this category yet.</div>}</div>}
          </section>;
        })}</div>}
      </section>

      {editorType && <div className="admin-category-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorType(null); }}><section className="admin-category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><header><div><span className="admin-categories-eyebrow">CATALOG SETTINGS</span><h2 id="category-modal-title">{editingItem ? `Edit ${editorType}` : `Create ${editorType}`}</h2><p>{editorType === "category" ? "Set up a parent collection for your products." : "Add a child collection within its parent category."}</p></div><button type="button" aria-label="Close" onClick={() => setEditorType(null)}><X size={18} /></button></header>
        <form onSubmit={saveItem}>{editorType === "subcategory" && <label>Parent category<select required value={form.category_id} disabled={Boolean(editingItem?.product_count)} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}><option value="">Choose a parent category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{Boolean(editingItem?.product_count) && <small>Parent cannot change while products are assigned. Move those products first.</small>}</label>}<label>{editorType === "category" ? "Category name" : "Subcategory name"}<input required maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: editingItem ? current.slug : slugify(event.target.value) }))} placeholder={editorType === "category" ? "e.g. Home essentials" : "e.g. Storage"} /></label><label>URL slug<input required maxLength={100} value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="home-essentials" /></label><label>Description <small>Optional</small><textarea rows={3} maxLength={240} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="A short introduction for shoppers" /></label><label className="category-active-option"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /><span><strong>Show in shop</strong><small>Customers can browse this {editorType}.</small></span></label><footer><button type="button" className="category-modal-cancel" onClick={() => setEditorType(null)}>Cancel</button><button type="submit" className="category-modal-save" disabled={saving}>{saving ? "Saving…" : editingItem ? "Save changes" : `Create ${editorType}`}</button></footer></form>
      </section></div>}
    </main>
  );
}
