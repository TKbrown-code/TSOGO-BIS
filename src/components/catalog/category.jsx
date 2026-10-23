// components/CategoriesAside.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import "../../styles/category.css";

export default function CategoriesAside({ selectedCategory, setSelectedCategory }) {
  const [categories, setCategories] = useState([]);
  const [expanded, setExpanded] = useState(null); // track which category is expanded
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, subcategories(id, name)");

      if (error) {
        console.error("Error fetching categories:", error.message);
        setError("Failed to load categories");
      } else {
        setCategories(data);
      }
      setLoading(false);
    };

    fetchCategories();
  }, []);

  const toggleExpand = (id) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const handleCategoryClick = (categoryId, hasSub) => {
    setSelectedCategory(categoryId);
    if (hasSub) {
      toggleExpand(categoryId);
    }
  };

  return (
    <aside className="categories-aside">
      <div className="aside-header">
        <h3 className="aside-title">Categories</h3>
        {!loading && !error && (
          <span className="category-count">{categories.length} categories</span>
        )}
      </div>

      {loading && (
        <div className="loading-state">
          <div className="skeleton-item"></div>
          <div className="skeleton-item"></div>
          <div className="skeleton-item"></div>
          <div className="skeleton-item"></div>
        </div>
      )}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && (
        <ul className="categories-list">
          {/* All Categories */}
          <li className="category-item">
            <button
              className={`category-btn all-btn ${selectedCategory === "All" ? "active" : ""}`}
              onClick={() => setSelectedCategory("All")}
            >
              <span className="category-name">All Products</span>
            </button>
          </li>

          {/* Categories */}
          {categories.map((cat) => {
            const isExpanded = expanded === cat.id;
            const hasSub = cat.subcategories && cat.subcategories.length > 0;
            const isActive =
              selectedCategory === cat.id ||
              cat.subcategories?.some((sub) => sub.id === selectedCategory);

            return (
              <li
                key={cat.id}
                className={`category-group ${isExpanded ? "expanded" : ""}`}
              >
                <div className="category-item">
                  <button
                    className={`category-btn ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      if (hasSub) toggleExpand(cat.id);
                    }}
                    aria-expanded={isExpanded}
                  >
                    <span className={`category-name ${isActive ? "active" : ""}`}>{cat.name}</span>
                    <div className="category-meta">
                      {hasSub && (
                        <span className="sub-count">{cat.subcategories.length}</span>
                      )}
                      {hasSub && (
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          className={`chevron ${isExpanded ? "rotate" : ""}`}
                        />
                      )}
                    </div>
                  </button>
                </div>

                {hasSub && isExpanded && (
                  <ul className="subcategory-list">
                    {cat.subcategories.map((sub) => (
                      <li key={sub.id} className="subcategory-item">
                        <button
                          className={`subcategory-btn ${
                            selectedCategory === sub.id ? "active" : ""
                          }`}
                          onClick={() => setSelectedCategory(sub.id)}
                        >
                          <span className="subcategory-dot"></span>
                          <span className="subcategory-name">{sub.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
