import React, { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faBars, faUser, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useUserContext } from "../context/useUserContext";
import { supabase } from "../lib/supabase";
import { getCachedImage, preloadAllImages } from "../utils/imageCache";

export default function Navbar() {
  const { cartItems, setCartOpen } = useCart();
  const totalQty = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();
  const { user } = useUserContext();
  const searchRef = useRef(null);

  // Fetch matching products from Supabase
 const handleSearchChange = async (e) => {
  const value = e.target.value;
  setSearchQuery(value);

  if (!value.trim()) {
    setSuggestions([]);
    return;
  }

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      price,
      product_images(image_path, is_primary),
      category_id,
      categories(name)
    `)
    .ilike("name", `%${value}%`)
    .limit(15);

  if (error) {
    console.error("Search error:", error);
    return;
  }

  // Preload images for better UX
  await preloadAllImages(data);

  // Group by category
  const grouped = data.reduce((acc, item) => {
    const catName = item.categories?.name || "Autres";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(item);
    return acc;
  }, {});

  setSuggestions(grouped);
};


const handleSuggestionClick = (productId) => {
  setSearchQuery("");
  setSuggestions([]);
  navigate(`/shop/${productId}`);
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
      <div className="logo">TSOGO-BIS</div>

      <button className="hamburger" onClick={() => setMenuOpen((prev) => !prev)}>
        <FontAwesomeIcon icon={faBars} />
      </button>

      {/* Searchbar */}
      <div className="searchbar-wrapper">
        <form className="searchbar" onSubmit={(e) => e.preventDefault()}>
          <input
            type="search"
            name="search"
            placeholder="Search items..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <button type="submit">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </button>
        </form>
  <div className="searchbar--sujest-wrapper" ref={searchRef}>
        {Object.keys(suggestions).length > 0 && (
  <div className="search-suggestions">
    {Object.entries(suggestions).map(([category, products]) => (
      <div key={category} className="suggestion-group">
        <h4 className="suggestion-category">{category}</h4>
        <ul>
          {products.map((p) => {
            const imagePath = p.product_images?.[0]?.image_path;
            const imageUrl = getCachedImage(imagePath);
            return (
              <li
                key={p.id}
                className="suggestion-item"
                onClick={() => handleSuggestionClick(p.id)}
              >
                <img
                  src={imageUrl}
                  alt={p.name}
                  className="suggestion-img"
                />
                <div className="suggestion-info">
                  <span>{p.name}</span>
                  <small>${p.price}</small>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </div>
)}
</div>

      </div>

      <ul className={menuOpen ? "active" : ""}>
        <li><Link to="/">Shop</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/logistics">Logistics</Link></li>

        <li>
          <button onClick={() => setCartOpen(true)} className="cart-btn">
            🛒
            {totalQty > 0 && <span className="cart-badge">{totalQty}</span>}
          </button>
        </li>

        {user ? (
          <li className="user-dropdown">
            <button className="user-btn" onClick={() => setUserOpen((prev) => !prev)}>
              <FontAwesomeIcon icon={faUser} />{" "}
              <FontAwesomeIcon icon={faChevronDown} className={`chevron ${userOpen ? "rotate" : ""}`} />
            </button>
            {userOpen && (
              <ul className="dropdown-menu">
                <li><Link to="/dashboard">DashBoard</Link></li>
                <li><Link to="/orders">My Orders</Link></li>
                <li><Link to="/history">History</Link></li>
                <li><button className="dropdown-logout">Logout</button></li>
              </ul>
            )}
          </li>
        ) : (
          <li><Link to="/signup" className="user-btn">Sign Up</Link></li>
        )}
      </ul>
    </nav>
  );
}
