import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useCurrencyContext } from "../context/CurrencyContext";

export default function AdvancedFilters({ 
  onFiltersChange, 
  selectedCategory,
  isMobile = false 
}) {
  const { convert, currency } = useCurrencyContext();
  const [filters, setFilters] = useState({
    priceRange: [0, 1000],
    rating: 0,
    sortBy: 'name',
    sortOrder: 'asc',
    inStock: false,
    onSale: false
  });
  
  const [categories, setCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(!isMobile);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const fetchCategories = async () => {
    const { data = [] } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    setCategories(data);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePriceRangeChange = (min, max) => {
    setFilters(prev => ({
      ...prev,
      priceRange: [min, max]
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      priceRange: [0, 1000],
      rating: 0,
      sortBy: 'name',
      sortOrder: 'asc',
      inStock: false,
      onSale: false
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000) count++;
    if (filters.rating > 0) count++;
    if (filters.inStock) count++;
    if (filters.onSale) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className={`advanced-filters ${isMobile ? 'mobile' : ''}`}>
      {/* Mobile Header */}
      {isMobile && (
        <div className="filters-mobile-header">
          <button 
            className="filters-toggle"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
          >
            <span>Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            <span className={`chevron ${isOpen ? 'rotate' : ''}`}>▼</span>
          </button>
          
          {activeFiltersCount > 0 && (
            <button 
              className="clear-filters-btn"
              onClick={clearAllFilters}
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <div className="filters-header">
          <h3>Filters</h3>
          {activeFiltersCount > 0 && (
            <button 
              className="clear-filters-btn"
              onClick={clearAllFilters}
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Filters Content */}
      {(isOpen || !isMobile) && (
        <div className="filters-content">
          {/* Price Range */}
          <div className="filter-group">
            <label className="filter-label">Price Range</label>
            <div className="price-range">
              <div className="price-inputs">
                <input
                  type="number"
                  value={filters.priceRange[0]}
                  onChange={(e) => handlePriceRangeChange(Number(e.target.value), filters.priceRange[1])}
                  min="0"
                  max="1000"
                  className="price-input"
                  aria-label="Minimum price"
                />
                <span>to</span>
                <input
                  type="number"
                  value={filters.priceRange[1]}
                  onChange={(e) => handlePriceRangeChange(filters.priceRange[0], Number(e.target.value))}
                  min="0"
                  max="1000"
                  className="price-input"
                  aria-label="Maximum price"
                />
              </div>
              <div className="price-display">
                {convert(filters.priceRange[0], currency)} - {convert(filters.priceRange[1], currency)} {currency}
              </div>
            </div>
          </div>

          {/* Rating Filter */}
          <div className="filter-group">
            <label className="filter-label">Minimum Rating</label>
            <div className="rating-filter">
              {[4, 3, 2, 1].map(rating => (
                <button
                  key={rating}
                  className={`rating-option ${filters.rating === rating ? 'active' : ''}`}
                  onClick={() => handleFilterChange('rating', filters.rating === rating ? 0 : rating)}
                >
                  <span className="stars">
                    {[...Array(5)].map((_, i) => (
                      <span 
                        key={i} 
                        className={`star ${i < rating ? 'filled' : 'empty'}`}
                      >
                        {i < rating ? '★' : '☆'}
                      </span>
                    ))}
                  </span>
                  <span className="rating-text">& up</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="filter-select"
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="rating">Rating</option>
              <option value="created_at">Newest</option>
            </select>
            
            <div className="sort-order">
              <button
                className={`order-btn ${filters.sortOrder === 'asc' ? 'active' : ''}`}
                onClick={() => handleFilterChange('sortOrder', 'asc')}
              >
                ↑ Ascending
              </button>
              <button
                className={`order-btn ${filters.sortOrder === 'desc' ? 'active' : ''}`}
                onClick={() => handleFilterChange('sortOrder', 'desc')}
              >
                ↓ Descending
              </button>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="filter-group">
            <label className="filter-label">Availability</label>
            <div className="checkbox-filters">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={(e) => handleFilterChange('inStock', e.target.checked)}
                />
                <span className="checkmark"></span>
                In Stock Only
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.onSale}
                  onChange={(e) => handleFilterChange('onSale', e.target.checked)}
                />
                <span className="checkmark"></span>
                On Sale
              </label>
            </div>
          </div>

          {/* Quick Categories */}
          <div className="filter-group">
            <label className="filter-label">Quick Categories</label>
            <div className="quick-categories">
              {categories.slice(0, 6).map(category => (
                <button
                  key={category.id}
                  className={`quick-category ${selectedCategory === category.id ? 'active' : ''}`}
                  onClick={() => onFiltersChange({ ...filters, category: category.id })}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
