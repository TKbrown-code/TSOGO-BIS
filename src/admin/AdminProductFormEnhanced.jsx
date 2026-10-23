import { showSiteModal as alert } from "../utils/siteModal";
// src/admin/AdminProductFormEnhanced.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FileText, DollarSign, Truck, Palette, Image, Tag, X, Plus, Save, Upload, ImagePlus, Star } from "lucide-react";
import "../styles/AdminProductForm.css";

export default function AdminProductFormEnhanced({ product = {}, onSaved, onCancel }) {
  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [weight, setWeight] = useState("");
  const [shippedFrom, setShippedFrom] = useState("");
  const [inStock, setInStock] = useState("In Stock");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [tags, setTags] = useState([]);
  
  // Images
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(null);
  const [primaryExistingImageId, setPrimaryExistingImageId] = useState(null);
  
  // Options builder - single option group
  const [hasOptions, setHasOptions] = useState(false);
  const [optionGroupType, setOptionGroupType] = useState(""); // e.g., "colors", "sizes"
  const [options, setOptions] = useState([]); // Array of {id, name, price, weight, subOptions: []}
  
  // Shipping methods
  const [shippingMethods, setShippingMethods] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const availableTags = ["promotion", "new_arrival", "bestseller", "featured"];

  // Load categories and subcategories
  useEffect(() => {
    const fetchData = async () => {
      const { data: categoriesData, error: catError } = await supabase.from("categories").select("*");
      if (!catError && categoriesData) setCategories(categoriesData);
      
      const { data: subcategoriesData, error: subError } = await supabase.from("subcategories").select("*");
      if (!subError && subcategoriesData) setSubcategories(subcategoriesData);
    };
    fetchData();
  }, []);
  
  // Filter subcategories when category changes
  useEffect(() => {
    if (categoryId) {
      const filtered = subcategories.filter(sub => sub.category_id === parseInt(categoryId));
      setFilteredSubcategories(filtered);
    } else {
      setFilteredSubcategories([]);
    }
  }, [categoryId, subcategories]);

  // Load product data
  useEffect(() => {
    if (product?.id) {
      setName(product.name || "");
      setDescription(product.description || "");
      setPrice(product.price || "");
      // category_id/subcategory_id may be returned as an object (when joined) or as a primitive id.
      const resolvedCategoryId = product.category_id && typeof product.category_id === 'object'
        ? product.category_id.id
        : product.category_id || "";
      const resolvedSubcategoryId = product.subcategory_id && typeof product.subcategory_id === 'object'
        ? product.subcategory_id.id
        : product.subcategory_id || "";

      setCategoryId(resolvedCategoryId);
      setSubcategoryId(resolvedSubcategoryId);
      setWeight(product.weight || "");
      setShippedFrom(product.shipped_from || "");
      setInStock(product.in_Stock === false || Number(product.stock_quantity) === 0 ? "Out of Stock" : "In Stock");
      setStockQuantity(String(product.stock_quantity ?? 0));
      setTags(product.product_tags?.map(t => t.tag) || []);
      setImages(product.images || []);
      setFiles([]);
      setRemovedImages([]);
      setPrimaryExistingImageId(product.images?.find((image) => image.is_primary)?.id ?? null);
      setPrimaryImageIndex(null);
      
      // Parse options
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
      
      // Parse shipping methods
      if (product.shipping_methods) {
        const methods = Object.entries(product.shipping_methods).map(([name, price]) => ({
          id: Date.now() + Math.random(),
          name,
          pricePerKg: price
        }));
        setShippingMethods(methods);
      }
    }
  }, [product]);

  useEffect(() => {
    const previews = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFilePreviews(previews);
    return () => previews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onCancel?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onCancel]);


  // Build options JSON
  const buildOptionsJson = () => {
    if (!hasOptions || !optionGroupType || options.length === 0) return null;
    
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
      return {
        [optionGroupType]: optionsObject
      };
    }
    
    return null;
  };

  // Build shipping methods JSON
  const buildShippingMethodsJson = () => {
    if (shippingMethods.length === 0) return null;
    
    const methods = {};
    shippingMethods.forEach(method => {
      if (method.name && method.pricePerKg) {
        methods[method.name] = parseInt(method.pricePerKg) || 0;
      }
    });
    
    return Object.keys(methods).length > 0 ? methods : null;
  };


  // Add shipping method
  const addShippingMethod = () => {
    setShippingMethods([...shippingMethods, {
      id: Date.now(),
      name: "",
      pricePerKg: ""
    }]);
  };

  // Remove shipping method
  const removeShippingMethod = (id) => {
    setShippingMethods(shippingMethods.filter(m => m.id !== id));
  };

  // Update shipping method
  const updateShippingMethod = (id, field, value) => {
    setShippingMethods(shippingMethods.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  // Upload files
  async function uploadFiles(productId, files) {
    if (!files?.length) return [];

    const uploadedImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${productId}/${Date.now()}_${i}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("products-images")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("products-images")
        .getPublicUrl(filePath);

      const { data: imgRecord, error: insertError } = await supabase
        .from("product_images")
        .insert({
          product_id: productId,
          storage_path: filePath,
          image_url: data.publicUrl,
          is_primary: i === primaryImageIndex
        })
        .select()
        .single();

      if (insertError) {
        await supabase.storage.from("products-images").remove([filePath]);
        throw insertError;
      }

      uploadedImages.push({ ...imgRecord, publicUrl: data.publicUrl });
    }

    return uploadedImages;
  }

  function handleImageFiles(fileList) {
    const selected = Array.from(fileList || []);
    const validFiles = selected.filter((file) => {
      if (!file.type.startsWith("image/")) {
        alert(`${file.name} is not an image file.`, "Unsupported file", "warning");
        return false;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert(`${file.name} is larger than 8 MB. Choose a smaller image.`, "Image is too large", "warning");
        return false;
      }
      return true;
    });
    if (!validFiles.length) return;
    if (primaryExistingImageId === null && primaryImageIndex === null) setPrimaryImageIndex(files.length);
    setFiles((current) => [...current, ...validFiles]);
  }

  function removeNewImage(index) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    if (primaryImageIndex === index) setPrimaryImageIndex(files.length > 1 ? (index === 0 ? 0 : index - 1) : null);
    else if (primaryImageIndex !== null && primaryImageIndex > index) setPrimaryImageIndex(primaryImageIndex - 1);
  }

  function removeExistingImage(image) {
    const next = images.filter((item) => item.id !== image.id);
    setImages(next);
    if (primaryExistingImageId === image.id) {
      setPrimaryExistingImageId(next[0]?.id ?? null);
      if (!next.length && files.length) setPrimaryImageIndex(0);
    }
    if (image.id) setRemovedImages((current) => [...current, image]);
  }

  // Toggle tag
  const toggleTag = (tag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // Handle save
  async function handleSave(e) {
    e.preventDefault();
    if (!name || !price) return alert("Name and price are required");
    setLoading(true);

    try {
      // Ensure category_id and subcategory_id are primitives (bigint) not objects or JSON strings
      const resolvedCategory = categoryId && typeof categoryId === 'object'
        ? categoryId.id
        : categoryId;
      const resolvedSubcategory = subcategoryId && typeof subcategoryId === 'object'
        ? subcategoryId.id
        : subcategoryId;

      const productData = {
        name,
        description,
        price: parseInt(price) || 0,
        category_id: resolvedCategory ? parseInt(resolvedCategory) : null,
        subcategory_id: resolvedSubcategory ? parseInt(resolvedSubcategory) : null,
        weight: weight ? parseFloat(weight) : null,
        shipped_from: shippedFrom || null,
        in_Stock: inStock === "In Stock",
        stock_quantity: inStock === "Out of Stock" ? 0 : Math.max(0, Number.parseInt(stockQuantity, 10) || 0),
        options: buildOptionsJson(),
        shipping_methods: buildShippingMethodsJson()
      };

      console.log("Product data being saved:", JSON.stringify(productData, null, 2));

      let productId = product.id;

      if (productId) {
        // Update existing product
        const { error: updateError } = await supabase.from("products").update(productData).eq("id", productId);
        
        if (updateError) {
          console.error("Update error:", updateError);
          throw updateError;
        }

        if (removedImages.length) {
          const { error: imageDeleteError } = await supabase.from("product_images").delete().in("id", removedImages.map((image) => image.id));
          if (imageDeleteError) throw imageDeleteError;
          const storagePaths = removedImages.map((image) => image.storage_path).filter(Boolean);
          if (storagePaths.length) {
            const { error: storageError } = await supabase.storage.from("products-images").remove(storagePaths);
            if (storageError) console.error("Could not remove one or more image files:", storageError.message);
          }
        }

        const { error: resetPrimaryError } = await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
        if (resetPrimaryError) throw resetPrimaryError;
        if (primaryExistingImageId && images.some((image) => image.id === primaryExistingImageId)) {
          const { error: primaryUpdateError } = await supabase.from("product_images").update({ is_primary: true }).eq("id", primaryExistingImageId);
          if (primaryUpdateError) throw primaryUpdateError;
        }

        if (files.length) {
          const newImages = await uploadFiles(productId, files);
          setImages((prev) => [...prev, ...newImages]);
        }

        // Update tags
        await supabase.from("product_tags").delete().eq("product_id", productId);
        for (const tag of tags) {
          await supabase.from("product_tags").insert({ product_id: productId, tag });
        }

      } else {
        // Create new product
        const { data: newProduct, error: insertError } = await supabase.from("products")
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

      alert("Product saved successfully!");
      setFiles([]);
      onSaved?.();
    } catch (err) {
      console.error(err);
      alert("Save failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="product-form-modal">
      <div className="product-form-container" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <div className="form-header">
          <div className="form-heading-copy"><span className="form-heading-kicker">CATALOG EDITOR</span><h2 id="product-form-title">{product.id ? "Edit product" : "Create new product"}</h2><p>Manage product details, pricing, inventory, and storefront images.</p></div>
          <button type="button" onClick={onCancel} className="close-btn" aria-label="Close product editor" title="Close"><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} className="product-form">
          {/* Basic Information */}
          <section className="form-section">
            <h3><FileText className="inline-block mr-2" size={20} /> Basic Information</h3>
            
            <div className="form-group">
              <label>Product Name *</label>
              <input 
                type="text"
                placeholder="e.g., iPhone 13 Pro"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={categoryId} onChange={e => {
                  setCategoryId(e.target.value);
                  setSubcategoryId(""); // Reset subcategory when category changes
                }}>
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Subcategory</label>
                <select 
                  value={subcategoryId} 
                  onChange={e => setSubcategoryId(e.target.value)}
                  disabled={!categoryId || filteredSubcategories.length === 0}
                >
                  <option value="">Select Subcategory (Optional)</option>
                  {filteredSubcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Stock Status</label>
                <select value={inStock} onChange={e => {
                  setInStock(e.target.value);
                  if (e.target.value === "Out of Stock") setStockQuantity("0");
                }}>
                  <option value="In Stock">In Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Pre-Order">Pre-Order</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="product-stock-quantity">Available quantity</label>
                <input
                  id="product-stock-quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={stockQuantity}
                  onChange={(e) => {
                    const nextQuantity = e.target.value;
                    setStockQuantity(nextQuantity);
                    if (Number(nextQuantity) > 0) setInStock("In Stock");
                    else if (nextQuantity === "0") setInStock("Out of Stock");
                  }}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Product description..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
              />
            </div>
          </section>

          {/* Pricing & Shipping */}
          <section className="form-section">
            <h3><DollarSign className="inline-block mr-2" size={20} /> Pricing & Shipping</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Base Price (XAF) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="50000"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.5"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Shipped From</label>
                <input
                  type="text"
                  placeholder="e.g., China, USA"
                  value={shippedFrom}
                  onChange={e => setShippedFrom(e.target.value)}
                />
              </div>
            </div>

            {/* Shipping Methods */}
            <div className="subsection">
              <div className="subsection-header">
                <h4><Truck className="inline-block mr-2" size={18} /> Shipping Methods</h4>
                <button type="button" onClick={addShippingMethod} className="btn-add">
                  <Plus size={15} /> Add method
                </button>
              </div>

              {shippingMethods.map(method => (
                <div key={method.id} className="option-item">
                  <input
                    type="text"
                    placeholder="Method name (e.g., Standard)"
                    value={method.name}
                    onChange={e => updateShippingMethod(method.id, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price per kg"
                    value={method.pricePerKg}
                    onChange={e => updateShippingMethod(method.id, 'pricePerKg', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeShippingMethod(method.id)}
                    className="btn-remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Product Options */}
          <section className="form-section">
            <h3><Palette className="inline-block mr-2" size={20} /> Product Options</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={hasOptions}
                  onChange={e => setHasOptions(e.target.checked)}
                />
                <span>This product has options (colors, sizes, models, etc.)</span>
              </label>
            </div>

            {hasOptions && (
              <div className="options-builder">
                <div className="form-group">
                  <label>Option Group Type *</label>
                  <input
                    type="text"
                    placeholder="e.g., colors, sizes, storage"
                    value={optionGroupType}
                    onChange={e => setOptionGroupType(e.target.value)}
                  />
                  <p className="help-text">
                    The type of options (e.g., "colors" for Blue, Red, Green)
                  </p>
                </div>

                <div className="subsection-header">
                  <label>Option Values</label>
                  <button 
                    type="button" 
                    onClick={() => setOptions([...options, { id: Date.now(), name: "", price: 0, weight: 0, subOptions: [] }])}
                    className="btn-add"
                  >
                    + Add Value
                  </button>
                </div>
                <p className="help-text">
                  Add multiple values for your option group (e.g., if group is "colors", add Blue, Red, Green)
                </p>

                {options.map((opt, optIndex) => (
                  <div key={opt.id} className="option-group">
                    <div className="option-group-header">
                      <span className="group-number">Value {optIndex + 1}</span>
                      <button
                        type="button"
                        onClick={() => setOptions(options.filter((_, i) => i !== optIndex))}
                        className="btn-remove"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="form-group">
                      <label>Value Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Blue, Large, 512GB"
                        value={opt.name}
                        onChange={e => {
                          const newOpts = [...options];
                          newOpts[optIndex].name = e.target.value;
                          setOptions(newOpts);
                        }}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Extra Price</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={opt.price}
                          onChange={e => {
                            const newOpts = [...options];
                            newOpts[optIndex].price = e.target.value;
                            setOptions(newOpts);
                          }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Extra Weight</label>
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
                        />
                      </div>
                    </div>

                    <div className="sub-options">
                      <div className="subsection-header">
                        <h5>Sub-Options (optional)</h5>
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = [...options];
                            if (!newOpts[optIndex].subOptions) newOpts[optIndex].subOptions = [];
                            newOpts[optIndex].subOptions.push({ id: Date.now(), name: "" });
                            setOptions(newOpts);
                          }}
                          className="btn-add-small"
                        >
                          + Add Sub-Option
                        </button>
                      </div>
                      <p className="help-text" style={{ fontSize: '12px', marginBottom: '8px' }}>
                        Simple values like colors or finishes (e.g., Blue, White, Pink)
                      </p>

                      {opt.subOptions && opt.subOptions.map((sub, subIndex) => (
                        <div key={sub.id} className="sub-option-item" style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <span className="sub-number">{subIndex + 1}</span>
                          <input
                            type="text"
                            placeholder="Name (e.g., Blue, White, Pink)"
                            value={sub.name}
                            onChange={e => {
                              const newOpts = [...options];
                              newOpts[optIndex].subOptions[subIndex].name = e.target.value;
                              setOptions(newOpts);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = [...options];
                              newOpts[optIndex].subOptions = newOpts[optIndex].subOptions.filter((_, i) => i !== subIndex);
                              setOptions(newOpts);
                            }}
                            className="btn-remove-small"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Images */}
          <section className="form-section">
            <h3><Image className="inline-block mr-2" size={20} /> Product Images</h3>
            
            {images.length > 0 && (
              <div className="existing-images">
                <label>Existing Images</label>
                <div className="images-grid">
                  {images.map((img, i) => (
                    <div key={img.id || i} className={`image-item existing-image-item ${primaryExistingImageId === img.id ? "selected-primary" : ""}`}>
                      <img src={img.publicUrl || img.image_url} alt={`Product image ${i + 1}`} />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img)}
                        className="btn-remove-image"
                        aria-label={`Remove image ${i + 1}`}
                      >
                        <X size={14} />
                      </button>
                      {primaryExistingImageId === img.id ? <span className="primary-badge"><Star size={11} fill="currentColor" /> Primary image</span> : <button type="button" className="image-make-primary" onClick={() => { setPrimaryExistingImageId(img.id); setPrimaryImageIndex(null); }}><Star size={12} />Make primary</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="product-image-upload">Add product images</label>
              <label className="image-dropzone" htmlFor="product-image-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleImageFiles(event.dataTransfer.files); }}>
                <span className="image-dropzone-icon"><Upload size={19} /></span>
                <span className="image-dropzone-copy"><strong>Choose images or drag them here</strong><small>PNG, JPG, WEBP · Up to 8 MB each</small></span>
                <span className="image-browse-button">Browse images</span>
              </label>
              <input
                id="product-image-upload"
                className="image-file-input"
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => { handleImageFiles(event.target.files); event.target.value = ""; }}
              />
              {files.length > 0 && (
                <div className="new-image-preview-section">
                  <div className="new-image-preview-heading"><strong><ImagePlus size={15} /> New image previews</strong><span>{files.length} selected</span></div>
                  <div className="images-grid new-images-grid">
                    {filePreviews.map(({ file, url }, index) => <article className={`image-item new-image-item ${primaryImageIndex === index ? "selected-primary" : ""}`} key={`${file.name}-${file.lastModified}-${index}`}>
                      <img src={url} alt={`Preview of ${file.name}`} />
                      <button type="button" onClick={() => removeNewImage(index)} className="btn-remove-image" aria-label={`Remove ${file.name}`}><X size={14} /></button>
                      {primaryImageIndex === index ? <span className="primary-badge"><Star size={11} fill="currentColor" /> Primary image</span> : <button type="button" className="image-make-primary" onClick={() => { setPrimaryImageIndex(index); setPrimaryExistingImageId(null); }}><Star size={12} />Make primary</button>}
                      <div className="new-image-file-caption"><strong>{file.name}</strong><span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span></div>
                    </article>)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Tags */}
          <section className="form-section">
            <h3><Tag className="inline-block mr-2" size={20} /> Tags</h3>
            <div className="tags-grid">
              {availableTags.map(tag => (
                <label key={tag} className={`tag-item ${tags.includes(tag) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={tags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  <span>{tag.replace("_", " ").toUpperCase()}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-save">
              <Save size={16} />{loading ? "Saving…" : "Save product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
