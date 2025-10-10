// components/CategoriesAside.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import "../styles/category.css";

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

  return (
    <aside className="categories-aside">
      <h3 className="aside-title">Categories</h3>

      {loading && <p className="loading"></p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <ul className="categories-list">
          {/* All Categories */}
          <li
            className={`category-item ${selectedCategory === "All" ? "active" : ""}`}
            onClick={() => setSelectedCategory("All")}
          >
            All
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
                <button
                  className={`category-btn ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  aria-expanded={isExpanded}
                >
                  {cat.name}
                  {hasSub && (
                    <FontAwesomeIcon
                      icon={faChevronRight}
                      className={`chevron ${isExpanded ? "rotate" : ""}`}
                    />
                  )}
                </button>

                {hasSub && (
                  <ul className="subcategory-list">
                    {cat.subcategories.map((sub) => (
                      <li key={sub.id}>
                        <button
                          className={`subcategory-btn ${
                            selectedCategory === sub.id ? "active" : ""
                          }`}
                          onClick={() => setSelectedCategory(sub.id)}
                        >
                          {sub.name}
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
