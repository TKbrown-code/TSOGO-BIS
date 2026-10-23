import { showSiteModal as alert } from "../utils/siteModal";
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
  
  // New fields for flexible options
  const [weight, setWeight] = useState("");
  const [shippedFrom, setShippedFrom] = useState("");
  const [inStock, setInStock] = useState("In Stock");
  
  // Single option group structure
  const [hasOptions, setHasOptions] = useState(false);
  const [optionGroupType, setOptionGroupType] = useState(""); // e.g., "colors", "sizes", "storage"
  const [options, setOptions] = useState([]); // Array of {id, name, price, weight, subOptions: [{id, name, price, weight}]}
  
  const [shippingMethodsJson, setShippingMethodsJson] = useState("");

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
      setWeight(product.weight || "");
      setShippedFrom(product.shipped_from || "");
      setInStock(product.in_Stock || "In Stock");
      
      // Parse existing options
      if (product.options && typeof product.options === 'object') {
        setHasOptions(true);
        const groupType = Object.keys(product.options)[0] || "";
        setOptionGroupType(groupType);
        
        if (groupType && typeof product.options[groupType] === 'object') {
          const parsedOptions = Object.entries(product.options[groupType]).map(([optName, optData]) => {
            const subOptions = [];
            
            // Parse sub-options as simple strings
            if (optData.subOptions && Array.isArray(optData.subOptions)) {
              optData.subOptions.forEach(subName => {
                subOptions.push({
                  id: Date.now() + Math.random(),
                  name: subName
                });
              });
            }
            
            return {
              id: Date.now() + Math.random(),
              name: optName,
              price: optData.extraPrice || 0,
              weight: optData.extraWeight || 0,
              subOptions
            };
          });
          setOptions(parsedOptions);
        }
      }
      
      setShippingMethodsJson(product.shipping_methods ? JSON.stringify(product.shipping_methods, null, 2) : "");
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
          storage_path: filePath,
          image_url: data.publicUrl,
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

      // Build options JSON
      let optionsData = null;
      if (hasOptions && optionGroupType && options.length > 0) {
        const optionsObject = {};
        
        options.forEach(opt => {
          if (!opt.name) return;
          
          const optData = {};
          
          // Add extraPrice if exists
          if (opt.price && parseInt(opt.price) !== 0) {
            optData.extraPrice = parseInt(opt.price) || 0;
          }
          
          // Add extra weight if exists
          if (opt.weight && parseFloat(opt.weight) !== 0) {
            optData.extraWeight = parseFloat(opt.weight) || 0;
          }
          
          // Add sub-options as simple string array
          if (opt.subOptions && opt.subOptions.length > 0) {
            optData.subOptions = opt.subOptions.map(sub => sub.name).filter(Boolean);
          }
          
          optionsObject[opt.name] = optData;
        });
        
        if (Object.keys(optionsObject).length > 0) {
          optionsData = {
            [optionGroupType]: optionsObject
          };
        }
      }
      
      // Parse shipping methods
      let shippingMethods = null;

      if (shippingMethodsJson.trim()) {
        try {
          const parsed = JSON.parse(shippingMethodsJson);
          // Convert all shipping prices to integers
          shippingMethods = {};
          for (const [method, price] of Object.entries(parsed)) {
            shippingMethods[method] = parseInt(price) || 0;
          }
        } catch (err) {
          alert("Invalid JSON in Shipping Methods field: " + err.message);
          setLoading(false);
          return;
        }
      }

      const productData = {
        name,
        description,
        price: parseInt(price) || 0,
        category_id,
        weight: weight ? parseFloat(weight) : null,
        shipped_from: shippedFrom || null,
        in_Stock: inStock,
        options: optionsData,
        shipping_methods: shippingMethods
      };

      let productId = product.id;

      if (productId) {
        const { error: updateError } = await supabase.from("products").update(productData).eq("id", productId);
        
        if (updateError) {
          console.error("Update error:", updateError);
          throw updateError;
        }

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
        const { data: newProduct, error: insertError} = await supabase.from("products")
          .insert(productData)
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
    <form onSubmit={handleSave} style={{ padding: 16, border: "1px solid #eee", borderRadius: 8, marginBottom: 16, maxHeight: "80vh", overflowY: "auto" }}>
      <h3 style={{ marginTop: 0 }}>{product.id ? "Edit Product" : "New Product"}</h3>
      
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Product Name *</label>
          <input 
            placeholder="e.g., iPhone 13 Pro" 
            value={name} 
            onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Category</label>
          <select 
            value={categoryName} 
            onChange={e => setCategoryName(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
          >
            <option value="">Select Category</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Price (XAF) *</label>
            <input 
              placeholder="50000" 
              type="number" 
              step="0.01"
              value={price} 
              onChange={e => setPrice(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Weight (kg)</label>
            <input 
              placeholder="0.5" 
              type="number" 
              step="0.01"
              value={weight} 
              onChange={e => setWeight(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Description</label>
          <textarea 
            placeholder="Product description..." 
            value={description} 
            onChange={e => setDescription(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Shipped From</label>
            <input 
              placeholder="e.g., China, USA" 
              value={shippedFrom} 
              onChange={e => setShippedFrom(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Stock Status</label>
            <select 
              value={inStock} 
              onChange={e => setInStock(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
            >
              <option value="In Stock">In Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Pre-Order">Pre-Order</option>
            </select>
          </div>
        </div>

        {/* Product Options */}
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 6, padding: 12, background: "#fafafa" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={hasOptions}
              onChange={e => setHasOptions(e.target.checked)}
            />
            <span style={{ fontWeight: 500 }}>This product has options (colors, sizes, models, etc.)</span>
          </label>
          
          {hasOptions && (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Option Group Type *</label>
                <input 
                  placeholder="e.g., colors, sizes, storage" 
                  value={optionGroupType} 
                  onChange={e => setOptionGroupType(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
                />
                <small style={{ color: "#666" }}>The type of options (e.g., "colors" for Blue, Red, Green)</small>
              </div>
              
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontWeight: 500 }}>Option Values</label>
                  <button 
                    type="button"
                    onClick={() => setOptions([...options, { id: Date.now(), name: "", price: 0, weight: 0, subOptions: [] }])}
                    style={{ padding: "4px 12px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                  >
                    + Add Value
                  </button>
                </div>
                <small style={{ color: "#666", display: "block", marginBottom: 8 }}>
                  Add multiple values for your option group (e.g., if group is "colors", add Blue, Red, Green)
                </small>
                
                {options.map((opt, optIndex) => (
                  <div key={opt.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 12, background: "white" }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, display: "grid", gap: 8 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#666" }}>Value Name</label>
                          <input 
                            placeholder="e.g., Blue, Large, 512GB" 
                            value={opt.name}
                            onChange={e => {
                              const newOpts = [...options];
                              newOpts[optIndex].name = e.target.value;
                              setOptions(newOpts);
                            }}
                            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#666" }}>Extra Price</label>
                            <input 
                              type="number"
                              placeholder="0" 
                              value={opt.price}
                              onChange={e => {
                                const newOpts = [...options];
                                newOpts[optIndex].price = e.target.value;
                                setOptions(newOpts);
                              }}
                              style={{ padding: 6, borderRadius: 4, border: "1px solid #ddd", fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#666" }}>Extra Weight</label>
                            <input 
                              type="number"
                              step="0.01"
                              placeholder="0" 
                              value={opt.weight}
                              onChange={e => {
                                const newOpts = [...options];
                                newOpts[optIndex].weight = e.target.value;
                                setOptions(newOpts);
                              }}
                              style={{ padding: 6, borderRadius: 4, border: "1px solid #ddd", fontSize: 13 }}
                            />
                          </div>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setOptions(options.filter((_, i) => i !== optIndex))}
                        style={{ padding: "8px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e0e0e0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 500 }}>Sub-Options (optional)</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const newOpts = [...options];
                            if (!newOpts[optIndex].subOptions) newOpts[optIndex].subOptions = [];
                            newOpts[optIndex].subOptions.push({ id: Date.now(), name: "" });
                            setOptions(newOpts);
                          }}
                          style={{ padding: "2px 8px", background: "#10b981", color: "white", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 12 }}
                        >
                          + Add Sub-Option
                        </button>
                      </div>
                      
                      {opt.subOptions.map((sub, subIndex) => (
                        <div key={sub.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                          <input 
                            placeholder="Name (e.g., Blue, White, Pink)" 
                            value={sub.name}
                            onChange={e => {
                              const newOpts = [...options];
                              newOpts[optIndex].subOptions[subIndex].name = e.target.value;
                              setOptions(newOpts);
                            }}
                            style={{ padding: 6, borderRadius: 4, border: "1px solid #ddd", fontSize: 13 }}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const newOpts = [...options];
                              newOpts[optIndex].subOptions = newOpts[optIndex].subOptions.filter((_, i) => i !== subIndex);
                              setOptions(newOpts);
                            }}
                            style={{ padding: "4px 8px", background: "#ef4444", color: "white", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 12 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Shipping Methods (JSON)</label>
          <textarea 
            placeholder={'{\n  "Standard": 500,\n  "Express": 1000\n}'} 
            value={shippingMethodsJson} 
            onChange={e => setShippingMethodsJson(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd", fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
          />
          <small style={{ color: "#666" }}>
            Enter shipping methods as JSON. Format: {`{"Method Name": price_per_kg}`}
          </small>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Tags</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableTags.map(tag => (
              <label key={tag} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: tags.includes(tag) ? "#dbeafe" : "#f3f4f6", borderRadius: 4, cursor: "pointer" }}>
                <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggleTag(tag)} />
                <span style={{ fontSize: 13 }}>{tag.replace("_", " ").toUpperCase()}</span>
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
                  <img src={img.image_url} alt={`img-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }} />
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
