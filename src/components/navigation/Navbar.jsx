import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Camera, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useUserContext } from "../../context/useUserContext";
import { useCurrencyContext } from "../../context/CurrencyContext";
import { supabase } from "../../lib/supabase";
import { productDetailPath } from "../../utils/productRoutes";
import { useTranslation } from "react-i18next";
import BrandMonogram from "../../assets/nav-monogram.png";
import "../../styles/navbar-redesign.css";
import "../../styles/nav-fr-layout.css";

export default function Navbar() {
  const { cartItems, setCartOpen } = useCart();
  const { user } = useUserContext();
  const { convert, currency } = useCurrencyContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const searchRef = useRef(null);
  const accountMenuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const totalQty = cartItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  useEffect(() => {
    if (!searchQuery.trim()) { setSuggestions([]); setSearchLoading(false); return; }
    let active = true;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const term = searchQuery.trim().replace(/[(),]/g, " ");
      const { data, error } = await supabase.from("products")
        .select("id,name,description,price,product_images(image_url,is_primary)")
        .eq("status", "published")
        .or(`name.ilike.%${term}%,description.ilike.%${term}%`).limit(8);
      if (!active) return;
      setSuggestions(error ? [] : (data || []));
      setSearchLoading(false);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [searchQuery]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") { setSuggestions([]); setMenuOpen(false); setUserOpen(false); setSearchOpen(false); }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setUserOpen(false);
    };
    document.addEventListener("pointerdown", closeAccountMenu);
    return () => document.removeEventListener("pointerdown", closeAccountMenu);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);

  const closeMenu = () => { setMenuOpen(false); setUserOpen(false); };
  const selectProduct = (product) => {
    setSearchQuery(""); setSuggestions([]); setSearchOpen(false); closeMenu();
    navigate(productDetailPath(product));
  };
  const logout = async () => { await supabase.auth.signOut(); closeMenu(); navigate("/"); };

  return (
    <>
      {!location.pathname.startsWith("/ProductDetails/") && <div className="nav-announcement"><span>TSOGO-BIS</span><i /> {t("navbar.announcement")} <Link to="/about">{t("navbar.discover_story")} <ArrowUpRight size={13} /></Link></div>}
      <header className={`site-header ${location.pathname === "/shop" ? "shop-page-header" : ""} ${menuOpen ? "menu-is-open" : ""}`}>
        <Link to="/" className="brand-lockup" aria-label={t("navbar.home_aria")} onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true"><span className="brand-mark-ring"><img className="brand-mark-monogram" src={BrandMonogram} alt="" /></span></span>
          <span className="brand-wordmark">TSOGO<span>-</span>BIS<small>{t("navbar.tagline")}</small></span>
        </Link>
        <div className={`site-search ${searchOpen ? "is-open" : ""}`} ref={searchRef}>
          <Search size={17} strokeWidth={1.8} />
          <input aria-label={t("navbar.search_products")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("navbar.search_placeholder")} />
          <button type="button" className="site-image-search" aria-label={t("products.find_by_image")} title={t("products.find_by_image")} onClick={() => { setSearchQuery(""); setSearchOpen(false); setSuggestions([]); navigate("/shop", { state: { openImageFinder: true } }); }}><Camera size={17} strokeWidth={1.8} /></button>
          {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")} aria-label={t("common.clear")}><X size={15} /></button>}
          {(searchLoading || suggestions.length > 0 || (searchQuery && !searchLoading)) && <div className="search-results">
            {searchLoading ? <p className="search-message">{t("navbar.searching")}</p> : suggestions.length ? suggestions.map((product) => {
              const image = product.product_images?.find((item) => item.is_primary)?.image_url || product.product_images?.[0]?.image_url;
              return <button className="search-result" key={product.id} onClick={() => selectProduct(product)}>
                <span className="search-result-image">{image && <img src={image} alt="" />}</span><span>{product.name}<small>{convert(product.price, currency)} FCFA</small></span><ArrowUpRight size={15} />
              </button>;
            }) : <p className="search-message">{t("navbar.no_search_results", { query: searchQuery })}</p>}
          </div>}
        </div>
        <nav id="primary-navigation" className={`primary-nav ${menuOpen ? "menu-open" : ""}`} aria-label={t("navbar.main_navigation")}>
          <div className="mobile-nav-top"><span className="mobile-nav-label">{t("navbar.explore_brand")}</span><button onClick={closeMenu} aria-label={t("common.close")}><X size={20} /></button></div>
          <Link to="/shop" onClick={closeMenu}>{t("nav.shop")}</Link>
          <Link to="/about" onClick={closeMenu}>{t("navbar.our_story")}</Link>
          <Link to="/logistics" onClick={closeMenu}>{t("navbar.delivery")}</Link>
          <Link to="/track" onClick={closeMenu}>{t("nav.track")}</Link>
          <Link to="/contact" onClick={closeMenu}>{t("nav.contact")}</Link>
        </nav>
        <div className="header-actions">
          <button className="header-icon search-mobile-toggle" onClick={() => setSearchOpen(!searchOpen)} aria-label={searchOpen ? t("common.close") : t("navbar.toggle_search")}>{searchOpen ? <X size={19} /> : <Search size={19} />}</button>
          <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={t("navbar.open_bag", { count: totalQty })} aria-haspopup="dialog"><ShoppingBag size={19} strokeWidth={1.7} /><span>{t("nav.cart")}</span><b>{totalQty}</b></button>
          {user ? <div className="account-menu account-menu-header" ref={accountMenuRef}>
            <button
              className={`account-trigger account-trigger-circle ${userOpen ? "is-open" : ""}`}
              onClick={() => setUserOpen((open) => !open)}
              aria-label={t("navbar.open_account")}
              aria-expanded={userOpen}
              title={t("navbar.your_account")}
            >
              <UserRound size={18} strokeWidth={1.7} />
            </button>
            {userOpen && <div className="account-dropdown" role="menu">
              <div className="account-dropdown-user">{t("navbar.signed_in_as")}<strong>{user.email}</strong></div>
              <Link role="menuitem" to="/dashboard" onClick={closeMenu}>{t("nav.dashboard")}</Link>
              <Link role="menuitem" to="/orders" onClick={closeMenu}>{t("navbar.my_orders")}</Link>
              <Link role="menuitem" to="/dashboard?section=settings" onClick={closeMenu}>{t("navbar.profile_settings")}</Link>
              <button role="menuitem" onClick={logout}>{t("nav.logout")}</button>
            </div>}
          </div> : <button type="button" className="account-signin-button" onClick={() => navigate("/SignUp")} aria-label={t("auth.signin")}>{t("auth.signin")}</button>}
          <button className="header-icon menu-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? t("navbar.close_menu") : t("navbar.open_menu")} aria-expanded={menuOpen} aria-controls="primary-navigation">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {menuOpen && <button className="nav-scrim" aria-label={t("navbar.close_menu")} onClick={closeMenu} />}
      </header>
    </>
  );
}
