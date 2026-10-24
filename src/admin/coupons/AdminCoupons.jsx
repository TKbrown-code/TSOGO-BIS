import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useModalMessage } from "../../context/ModalMessageContext";
import { BadgePercent, CalendarDays, Download, Pencil, Plus, RefreshCw, Search, Tag, Trash2, Users } from "lucide-react";
import { exportCsv } from "../utils/exportCsv";
import "./AdminCoupons.css";

const emptyForm = { code: "", discount_type: "percent", discount_value: "10", minimum_amount: "0", scope: "general", category_id: "", subcategory_id: "", product_id: "", active: true, starts_at: "", expires_at: "" };
const formatMoney = (amount) => `${Number(amount || 0).toLocaleString()} XAF`;

export default function AdminCoupons() {
  const { showAlert, confirmDialog } = useModalMessage();
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [productFilter, setProductFilter] = useState("");
  const [uses, setUses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [couponResult, productResult, categoryResult, subcategoryResult] = await Promise.all([
      supabase.from("coupons").select("*,products(name),categories(name),subcategories(name)").order("created_at", { ascending: false }),
      supabase.from("products").select("id,name,category_id,subcategory_id").order("name"),
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("subcategories").select("id,name,category_id").order("name"),
    ]);
    const allUses = [];
    let useError = null;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("checkouts").select("checkout_id,user_id,user_name,email,coupon_code,coupon_discount,created_at").not("coupon_code", "is", null).order("created_at", { ascending: false }).range(offset, offset + 999);
      if (error) { useError = error; break; }
      allUses.push(...(data || []));
      if ((data || []).length < 1000) break;
    }
    const failed = couponResult.error || productResult.error || categoryResult.error || subcategoryResult.error || useError;
    if (failed) { setError(failed.message || "Coupon data could not be loaded."); }
    setCoupons(couponResult.data || []); setProducts(productResult.data || []); setCategories(categoryResult.data || []); setSubcategories(subcategoryResult.data || []); setUses(allUses); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const couponScopeLabel = useCallback((coupon) => coupon.product_id ? coupon.products?.name || `Product #${coupon.product_id}` : coupon.subcategory_id ? coupon.subcategories?.name || `Subcategory #${coupon.subcategory_id}` : coupon.category_id ? coupon.categories?.name || `Category #${coupon.category_id}` : "General · all products", []);
  const filteredCoupons = useMemo(() => coupons.filter((coupon) => `${coupon.code} ${couponScopeLabel(coupon)} ${coupon.product_id || ""} ${coupon.category_id || ""} ${coupon.subcategory_id || ""}`.toLowerCase().includes(query.trim().toLowerCase())), [coupons, query, couponScopeLabel]);
  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedId);
  const couponUses = uses.filter((use) => use.coupon_code?.toUpperCase() === selectedCoupon?.code?.toUpperCase());

  const startEdit = (coupon) => {
    setEditingId(coupon?.id || null);
    setProductFilter("");
    setForm(coupon ? { code: coupon.code, discount_type: coupon.discount_type, discount_value: String(coupon.discount_value), minimum_amount: String(coupon.minimum_amount || 0), scope: coupon.product_id ? "product" : coupon.subcategory_id ? "subcategory" : coupon.category_id ? "category" : "general", product_id: coupon.product_id ? String(coupon.product_id) : "", category_id: coupon.category_id ? String(coupon.category_id) : "", subcategory_id: coupon.subcategory_id ? String(coupon.subcategory_id) : "", active: coupon.active, starts_at: coupon.starts_at?.slice(0, 16) || "", expires_at: coupon.expires_at?.slice(0, 16) || "" } : emptyForm);
  };

  const saveCoupon = async (event) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    const value = Number(form.discount_value);
    if (code.length < 3 || value <= 0 || (form.discount_type === "percent" && value > 100)) return showAlert("Enter a valid code and discount value.", "Check coupon details", "warning");
    setSaving(true);
    const payload = { code, discount_type: form.discount_type, discount_value: value, minimum_amount: Math.max(0, Number(form.minimum_amount) || 0), product_id: form.scope === "product" && form.product_id ? Number(form.product_id) : null, category_id: form.scope === "category" && form.category_id ? Number(form.category_id) : null, subcategory_id: form.scope === "subcategory" && form.subcategory_id ? Number(form.subcategory_id) : null, active: form.active, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null, updated_at: new Date().toISOString() };
    const result = editingId ? await supabase.from("coupons").update(payload).eq("id", editingId) : await supabase.from("coupons").insert(payload);
    setSaving(false);
    if (result.error) return showAlert(result.error.message, "Coupon could not be saved", "error");
    setForm(emptyForm); setEditingId(null); await load(); showAlert("Coupon saved.", "Coupon updated", "success");
  };

  const deleteCoupon = async (coupon) => {
    const confirmed = await confirmDialog(`Delete coupon ${coupon.code}? Its past order records remain available.`, "Delete coupon", { confirmLabel: "Delete coupon", tone: "danger" });
    if (!confirmed) return;
    const { error: deleteError } = await supabase.from("coupons").delete().eq("id", coupon.id);
    if (deleteError) return showAlert(deleteError.message, "Coupon could not be deleted", "error");
    setSelectedId(null); await load();
  };

  const visibleSubcategories = subcategories.filter((item) => !form.category_id || String(item.category_id) === form.category_id);
  const visibleProducts = products.filter((product) => (!productFilter || `${product.id} ${product.name}`.toLowerCase().includes(productFilter.trim().toLowerCase())) && (!form.category_id || String(product.category_id) === form.category_id) && (form.scope !== "subcategory" || !form.subcategory_id || String(product.subcategory_id) === form.subcategory_id));

  return <main className="admin-coupons">
    <header className="admin-coupons-heading"><div><span>COMMERCE PROMOTIONS</span><h1>Coupons</h1><p>Target every product, a category, a subcategory, or one product. Product choices show their catalog ID.</p></div><div className="admin-coupon-heading-actions"><button type="button" onClick={() => exportCsv("tsogo-coupons.csv", coupons.map((coupon) => ({ ...coupon, scope: couponScopeLabel(coupon), uses: uses.filter((row) => row.coupon_code?.toUpperCase() === coupon.code.toUpperCase()).length })))} disabled={!coupons.length}><Download size={15} />Export coupons</button><button type="button" onClick={load} disabled={loading}><RefreshCw size={15} />Refresh</button></div></header>
    <section className="admin-coupon-metrics"><article><Tag size={18} /><span><b>{coupons.length}</b><small>Coupons</small></span></article><article><BadgePercent size={18} /><span><b>{coupons.filter((item) => item.active).length}</b><small>Active</small></span></article><article><Users size={18} /><span><b>{uses.length}</b><small>Recorded uses</small></span></article></section>
    {error && <p className="admin-coupon-error" role="alert">{error}<button onClick={load}>Retry</button></p>}
    <div className="admin-coupon-layout">
      <section className="admin-coupon-list"><header><div><h2>Coupon library</h2><p>{filteredCoupons.length} codes</p></div><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a coupon" /></label></header>
        {loading ? <p className="admin-coupon-empty">Loading coupons…</p> : !filteredCoupons.length ? <p className="admin-coupon-empty">Create the first coupon with the form.</p> : filteredCoupons.map((coupon) => {
          const usageCount = uses.filter((use) => use.coupon_code?.toUpperCase() === coupon.code.toUpperCase()).length;
          return <article key={coupon.id} className={`admin-coupon-row ${selectedId === coupon.id ? "is-selected" : ""}`}><button type="button" className="admin-coupon-select" onClick={() => setSelectedId(coupon.id)}><strong>{coupon.code}</strong><span>{couponScopeLabel(coupon)}</span><small>{coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `${formatMoney(coupon.discount_value)} off`} · {usageCount} uses</small></button><span className={`admin-coupon-status ${coupon.active ? "is-active" : ""}`}>{coupon.active ? "Active" : "Paused"}</span><button type="button" aria-label={`Edit ${coupon.code}`} onClick={() => startEdit(coupon)}><Pencil size={15} /></button><button type="button" aria-label={`Delete ${coupon.code}`} onClick={() => deleteCoupon(coupon)}><Trash2 size={15} /></button></article>;
        })}
      </section>
      <section className="admin-coupon-form-card"><header><div><span>{editingId ? "EDIT COUPON" : "NEW COUPON"}</span><h2>{editingId ? "Update code" : "Create a code"}</h2></div><button type="button" onClick={() => startEdit(null)}><Plus size={15} />New</button></header>
        <form onSubmit={saveCoupon}>
          <label>Coupon code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="WELCOME10" maxLength={40} required /></label>
          <div className="admin-coupon-form-grid"><label>Discount type<select value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value })}><option value="percent">Percentage</option><option value="fixed">Fixed XAF amount</option></select></label><label>Discount value<input type="number" min="0.01" max={form.discount_type === "percent" ? 100 : undefined} step="0.01" value={form.discount_value} onChange={(event) => setForm({ ...form, discount_value: event.target.value })} required /></label></div>
          <label>Applies to<select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value, category_id: "", subcategory_id: "", product_id: "" })}><option value="general">All products</option><option value="category">One category</option><option value="subcategory">One subcategory</option><option value="product">One product</option></select></label>
          {(form.scope === "category" || form.scope === "subcategory") && <label>Category<select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value, subcategory_id: "" })}><option value="">Choose category</option>{categories.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.name}</option>)}</select></label>}
          {form.scope === "subcategory" && <label>Subcategory<select required value={form.subcategory_id} onChange={(event) => setForm({ ...form, subcategory_id: event.target.value })}><option value="">Choose subcategory</option>{visibleSubcategories.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.name}</option>)}</select></label>}
          {form.scope === "product" && <><label>Filter products by category (optional)<select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value, product_id: "" })}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.name}</option>)}</select></label><label>Find product by ID or name<input value={productFilter} onChange={(event) => setProductFilter(event.target.value)} placeholder="Type a product ID or name"/></label><label>Product<select required value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })}><option value="">Choose product</option>{visibleProducts.map((product) => <option key={product.id} value={product.id}>#{product.id} · {product.name}</option>)}</select></label></>}
          <label>Minimum eligible subtotal (XAF)<input type="number" min="0" step="1" value={form.minimum_amount} onChange={(event) => setForm({ ...form, minimum_amount: event.target.value })} /></label>
          <div className="admin-coupon-form-grid"><label><CalendarDays size={14} />Starts at<input type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label><label><CalendarDays size={14} />Expires at<input type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></label></div>
          <label className="admin-coupon-active"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Available to customers</label>
          <button type="submit" className="admin-coupon-save" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create coupon"}</button>
        </form>
      </section>
    </div>
    {selectedCoupon && <section className="admin-coupon-usage"><header><div><span>REDEMPTION HISTORY</span><h2>Customers who used {selectedCoupon.code}</h2></div><button type="button" onClick={() => exportCsv(`${selectedCoupon.code.toLowerCase()}-users.csv`, couponUses)} disabled={!couponUses.length}><Download size={15} />Export users</button></header>{couponUses.length ? <div className="admin-coupon-usage-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Email</th><th>Discount</th><th>Used</th></tr></thead><tbody>{couponUses.map((use) => <tr key={use.checkout_id}><td>#{use.checkout_id}</td><td>{use.user_name || "Customer"}</td><td>{use.email || use.user_id || "—"}</td><td>{formatMoney(use.coupon_discount)}</td><td>{new Date(use.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="admin-coupon-empty">No customer has used this coupon yet.</p>}</section>}
  </main>;
}
