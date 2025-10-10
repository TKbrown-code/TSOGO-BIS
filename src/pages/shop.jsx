// src/pages/Shop.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyContext } from "../context/CurrencyContext";
import { useCart } from "../context/CartContext";
import { getDownloadUrl } from "../hooks/productimages";
import "../styles/shop.css";
import NewArrivals from "../components/NewArrivals";
import TaggedProduct from "../components/TaggedProducts"

export default function Shop() {
  const { convert, currency } = useCurrencyContext();
  const { addToCart } = useCart();
  const [categoriesMap, setCategoriesMap] = useState({});
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState({});
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      // Step 1: fetch products
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*");

      if (productError) {
        console.error("Product fetch error:", productError);
        return;
      }

      setProducts(productData || []);

      // Step 2: fetch categories separately
      const { data: categoryData } = await supabase
        .from("categories")
        .select("name");

      if (categoryData) {
        setCategories([...new Set(categoryData.map((c) => c.name))]);
      }

      // Step 3: fetch product images
      const { data: imageData, error: imageError } = await supabase
        .from("product_images")
        .select("product_id, image_path, is_primary");

      if (imageError) {
        console.error("Image fetch error:", imageError);
        return;
      }

      // Step 4: build mapping product_id -> image_url
      const urls = {};
      await Promise.all(
        (imageData || []).map(async (img) => {
          if (!urls[img.product_id] || img.is_primary) {
            const url = await getDownloadUrl(img.image_path);
            urls[img.product_id] = url;
          }
        })
      );
      setImages(urls);
    };

    fetchProducts();
  }, []);

  // Filtering
  const filteredProducts = products.filter((p) => {
    const matchesCategory = activeCategory === "all";
    const matchesSearch =
      search.trim() === "" ||
      p.name?.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });


  const getCategoryName = (categoryId) => {
      if (!categoryId) return "Uncategorized";
      const cat = categoriesMap[categoryId];
      if (!cat) return "Unknown";
      if (cat.parent_id && categoriesMap[cat.parent_id]) {
        return `${categoriesMap[cat.parent_id].name} > ${cat.name}`;
      }
      return cat.name;
    };

  return (
    <>
    <NewArrivals/>
    <div className="shop-container">
      {/* Product Grid */}
      <div className="products">
        {filteredProducts.length === 0 ? (
          <p className="no-products">No products found.</p>
        ) : (
          filteredProducts.map((p) => (
            <div key={p.id} className="product-card">
                 <div className="product-image-wrapper">
              <img
                src={images[p.id] || "/placeholder.png"}
                alt={p.name}
                className="product-image"
              />
              </div>
              <div className="product-info">
                <h3>{p.name}</h3>
                <p className="product-Details">{p.description}</p>
                <span className="price">{convert(p.price, currency)} {currency}</span>
                 <span className="category-label">
                  {getCategoryName(p.category_id)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
</>
  );
}
