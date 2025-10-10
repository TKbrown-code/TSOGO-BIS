// src/admin/AdminProductForm.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminProductForm({ product = {}, onSaved, onCancel }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [tags, setTags] = useState([]); // selected tags
  const [loading, setLoading] = useState(false);

  const availableTags = ["promotion", "new_arrival", "bestseller", "featured"];

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (!error && data) setCategories(data);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setPrice(product.price || "");
      setCategoryName(product.categories?.name || "");
      setImages(product.images || []);
      setTags(product.product_tags?.map(t => t.tag) || []);
    }
  }, [product]);

  async function uploadFiles(productId, files) {
    if (!files?.length) return [];

    const uploadedImages = [];
    for (const file of files) {
      const filePath = `${productId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("products-images")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        console.error("Upload error:", uploadError.message);
        continue;
      }

      const { data } = supabase.storage
        .from("products-images")
        .getPublicUrl(filePath);

      const { data: imgRecord, error: insertError } = await supabase
        .from("product_images")
        .insert({
          product_id: productId,
          image_path: filePath,
          is_primary: images.length === 0 && uploadedImages.length === 0 ? true : false
        })
        .select()
        .single();

      if (insertError) console.error("Insert image record error:", insertError.message);

      uploadedImages.push({ ...imgRecord, publicUrl: data.publicUrl });
    }

    return uploadedImages;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name || !price) return alert("Name and price are required");
    setLoading(true);

    try {
      const category = categories.find(c => c.name === categoryName);
      const category_id = category ? category.id : null;

      let productId = product.id;

      if (productId) {
        await supabase.from("products").update({ name, description, price, category_id }).eq("id", productId);

        if (files.length) {
          const newImages = await uploadFiles(productId, files);
          setImages(prev => [...prev, ...newImages]);
        }

        // Update tags: delete old, insert new
        await supabase.from("product_tags").delete().eq("product_id", productId);
        for (const tag of tags) {
          await supabase.from("product_tags").insert({ product_id: productId, tag });
        }

      } else {
        const { data: newProduct, error: insertError } = await supabase.from("products")
          .insert({ name, description, price, category_id })
          .select()
          .single();

        if (insertError) throw insertError;
        productId = newProduct.id;

        if (files.length) {
          const newImages = await uploadFiles(productId, files);
          setImages(newImages);
        }

        for (const tag of tags) {
          await supabase.from("product_tags").insert({ product_id: productId, tag });
        }
      }

      onSaved?.();
    } catch (err) {
      console.error(err);
      alert("Save failed: " + err.message);
    } finally {
      setLoading(false);
      setFiles([]);
    }
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  return (
    <form onSubmit={handleSave} style={{ padding: 16, border: "1px solid #eee", borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />

        <select value={categoryName} onChange={e => setCategoryName(e.target.value)}>
          <option value="">Select Category</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <input placeholder="Price" type="number" value={price} onChange={e => setPrice(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />

        <div>
          <label>Tags:</label>
          <div style={{ display: "flex", gap: 8 }}>
            {availableTags.map(tag => (
              <label key={tag}>
                <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggleTag(tag)} />
                {tag.replace("_", " ").toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        {images.length > 0 && (
          <div>
            <label>Existing Images:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {images.map((img, i) => (
                <div key={img.id || i} style={{ position: "relative" }}>
                  <img src={img.publicUrl || img.image_path} alt={`img-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }} />
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: 0, right: 0 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label>Upload New Images:</label>
          <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files))} />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </form>
  );
}
