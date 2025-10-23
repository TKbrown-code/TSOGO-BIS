import React, { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faBars, faUser, faMagnifyingGlass, faTimes } from "@fortawesome/free-solid-svg-icons";
import { ShoppingCart } from "lucide-react";
import { useUserContext } from "../context/useUserContext";
import { useCurrencyContext } from "../context/CurrencyContext";
import { supabase } from "../lib/supabase";
import { getCachedImage, preloadAllImages } from "../utils/imageCache";

export default function Navbar() {
  const { cartItems, setCartOpen } = useCart();
  const totalQty = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useUserContext();
  const { convert, currency } = useCurrencyContext();
  const searchRef = useRef(null);

  // Fetch matching products from Supabase
  const handleSearchChange = async (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (!value.trim()) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        price,
        product_images(image_path, is_primary),
        category_id,
        subcategory_id,
        categories(name),
        subcategories(name)
      `)
      .or(`name.ilike.%${value}%,description.ilike.%${value}%`)
      .limit(15);

    if (error) {
      console.error("Search error:", error);
      setSearchLoading(false);
      return;
    }

    // Preload images for better UX
    await preloadAllImages(data);

    // Group by category and subcategory
    const grouped = data.reduce((acc, item) => {
      let groupName = item.categories?.name || "Other";
      
      // If product has subcategory, append it to the group name
      if (item.subcategories?.name) {
        groupName = `${groupName} > ${item.subcategories.name}`;
      }
      
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(item);
      return acc;
    }, {});

    setSuggestions(grouped);
    setSearchLoading(false);
  };


  const handleSuggestionClick = (productId, productName) => {
    setSearchQuery("");
    setSuggestions([]);
    setMenuOpen(false);
    setSearchOpen(false);
    navigate(`/ProductDetails/${productId}/${productName}`);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };

    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        setSuggestions([]);
        setSearchQuery("");
        setUserOpen(false);
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, []);


  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <span className="logo-text">TSOGO-BIS</span>
      </Link>

      {/* Search Toggle Button */}
      <div style={{display:"flex", gap:"10px"}}>
      <button 
        className="search-toggle-x" 
        onClick={() => setSearchOpen((prev) => !prev)}
        aria-label="Toggle search"
      >
        <FontAwesomeIcon icon={searchOpen ? faTimes : faMagnifyingGlass} />
      </button>

      <button 
        className="hamburger" 
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle menu"
      >
        <FontAwesomeIcon icon={faBars} />
      </button>
      </div>
      {/* Search Bar */}
      <div className={`searchbar-wrapper ${searchOpen ? "search-active" : ""}`} ref={searchRef}>
        <form className="searchbar" onSubmit={(e) => e.preventDefault()}>
          <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
          <input
            type="search"
            name="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
          {searchQuery && (
            <button 
              type="button" 
              className="clear-search"
              onClick={() => {
                setSearchQuery("");
                setSuggestions([]);
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </form>

        {/* Search Suggestions */}
        {searchLoading && (
          <div className="search-suggestions">
            <div className="search-loading">
              <div className="loading-spinner"></div>
              <span>Searching...</span>
            </div>
          </div>
        )}

        {!searchLoading && Object.keys(suggestions).length > 0 && (
          <div className="search-suggestions">
            <div className="suggestions-header">
              <span className="results-count">
                {Object.values(suggestions).flat().length} results found
              </span>
            </div>
            {Object.entries(suggestions).map(([category, products]) => (
              <div key={category} className="suggestion-group">
                <h4 className="suggestion-category">{category}</h4>
                <ul className="suggestion-list">
                  {products.map((p) => {
                    const imagePath = p.product_images?.find(img => img.is_primary)?.image_path || p.product_images?.[0]?.image_path;
                    const imageUrl = getCachedImage(imagePath);
                    return (
                      <li
                        key={p.id}
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(p.id, p.name)}
                      >
                        <div className="suggestion-image-wrapper">
                          <img
                            src={imageUrl}
                            alt={p.name}
                            className="suggestion-img"
                          />
                        </div>
                        <div className="suggestion-info">
                          <span className="suggestion-name">{p.name}</span>
                          <span className="suggestion-price">{convert(p.price, currency)} {currency}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {!searchLoading && searchQuery && Object.keys(suggestions).length === 0 && (
          <div className="search-suggestions">
            <div className="no-results">
              <span className="no-results-icon">No results</span>
              <p>No products found for "{searchQuery}"</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div 
          className="nav-overlay" 
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <ul className={`nav-menu ${menuOpen ? "active" : ""}`}>
        <li className="nav-close-btn-wrapper">
          <button 
            className="nav-close-btn" 
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </li>
        <li><button 
        className="search-toggle" 
        onClick={() => setSearchOpen((prev) => !prev)}
        aria-label="Toggle search"
      >
        <FontAwesomeIcon icon={searchOpen ? faTimes : faMagnifyingGlass} />
      </button>
      </li>
        <li className="nav-item">
          <Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>Home</Link>
        </li>
        <li className="nav-item">
          <Link to="/shop" className="nav-link" onClick={() => setMenuOpen(false)}>Shop</Link>
        </li>
        <li className="nav-item">
          <Link to="/about" className="nav-link" onClick={() => setMenuOpen(false)}>About</Link>
        </li>
        <li className="nav-item">
          <Link to="/logistics" className="nav-link" onClick={() => setMenuOpen(false)}>Logistics</Link>
        </li>
        <li className="nav-item">
          <Link to="/track" className="nav-link" onClick={() => setMenuOpen(false)}>Track</Link>
        </li>

        <li className="nav-item">
          <button 
            onClick={() => {
              setCartOpen(true);
              setMenuOpen(false);
            }} 
            className="cart-btn"
            aria-label="Open cart"
          >
            <span className="cart-icon"><ShoppingCart size={20} /></span>
            {totalQty > 0 && <span className="cart-badge">{totalQty}</span>}
          </button>
        </li>

        {user ? (
          <li className="nav-item user-dropdown">
            <button 
              className="user-btn" 
              onClick={() => setUserOpen((prev) => !prev)}
              aria-label="User menu"
            >
              <FontAwesomeIcon icon={faUser} />
              <FontAwesomeIcon icon={faChevronDown} className={`chevron ${userOpen ? "rotate" : ""}`} />
            </button>
            {userOpen && (
              <ul className="dropdown-menu">
                <li>
                  <Link to="/dashboard" onClick={() => { setUserOpen(false); setMenuOpen(false); }}>
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/orders" onClick={() => { setUserOpen(false); setMenuOpen(false); }}>
                    My Orders
                  </Link>
                </li>
                <li>
                  <Link to="/history" onClick={() => { setUserOpen(false); setMenuOpen(false); }}>
                    History
                  </Link>
                </li>
                <li>
                  <button className="dropdown-logout" onClick={() => { setUserOpen(false); setMenuOpen(false); }}>
                    Logout
                  </button>
                </li>
              </ul>
            )}
          </li>
        ) : (
          <li className="nav-item">
            <Link to="/signup" className="signup-btn" onClick={() => setMenuOpen(false)}>
              Sign Up
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
