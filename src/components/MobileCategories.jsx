import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function MobileCategories({ selectedCategory, setSelectedCategory }) {
  const [categories, setCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data = [] } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      setCategories(data);
    };
    fetchCategories();
  }, []);

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setIsOpen(false);
  };

  return (
    <div className="mobile-categories">
      <button 
        className="mobile-categories-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Toggle categories"
      >
        <span>Categories</span>
        <span className={`chevron ${isOpen ? "rotate" : ""}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="mobile-categories-dropdown">
          <button
            className={`mobile-category-item ${selectedCategory === "All" ? "active" : ""}`}
            onClick={() => handleCategorySelect("All")}
          >
            All Products
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`mobile-category-item ${selectedCategory === category.id ? "active" : ""}`}
              onClick={() => handleCategorySelect(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
