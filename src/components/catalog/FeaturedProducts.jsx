import React, { useEffect, useState } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCart } from "../../context/CartContext";
import { useUserContext } from "../../context/useUserContext";
import "../../styles/featured-products.css";
import "../../styles/featured-products-fixes.css";
import { useModalMessage } from "../../context/ModalMessageContext";
import { useTranslation } from "react-i18next";
import { productDetailPath } from "../../utils/productRoutes";

const formatXaf = (price) => `${new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(Number(price || 0))} FCFA`;

export default function FeaturedProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, setCartOpen } = useCart();
  const { user } = useUserContext();
  const navigate = useNavigate();
  const { openMessage, closeMessage } = useModalMessage();
  const { t } = useTranslation();

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      const { data, error } = await supabase.from("products")
        .select("id,slug,name,description,price,currency,stock_quantity,created_at,product_images(image_url,is_primary,sort_order)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(12);
      if (active) {
        setProducts(error ? [] : (data || []).map((product) => ({
          ...product,
          imageUrl: product.product_images?.find((image) => image.is_primary)?.image_url || product.product_images?.[0]?.image_url,
        })));
        setLoading(false);
      }
    };
    loadProducts();
    return () => { active = false; };
  }, []);

  const addProduct = async (product) => {
    if (!user) {
      openMessage({
        title: t("featured.sign_in_title"),
        message: t("featured.sign_in_message"),
        type: "warning",
        footer: <>
          <button className="modalbtn modalbtn-secondary" onClick={closeMessage}>{t("featured.maybe_later")}</button>
          <button className="modalbtn" onClick={() => { closeMessage(); navigate("/SignUp"); }}>{t("nav.login")}</button>
        </>,
      });
      return;
    }
    const added = await addToCart(product);
    if (added) setCartOpen(true);
  };

  return (
    <section className="featured-products" aria-labelledby="featured-products-title">
      <div className="featured-heading">
        <div><span className="home-eyebrow">{t("featured.kicker")}</span><h2 id="featured-products-title">{t("featured.title")}</h2><p>{t("featured.subtitle")}</p></div>
        <Link to="/shop" className="featured-view-all">{t("featured.view_all")} <ArrowRight size={16} /></Link>
      </div>
      {loading ? <div className="featured-loading" aria-label={t("products.loading")}><span /><span /><span /><span /></div> : products.length ? (
        <div className="featured-grid">
          {products.map((product, index) => (
            <article className="featured-card" key={product.id}>
              <Link className="featured-image" to={productDetailPath(product)} aria-label={t("featured.view_product", { name: product.name })}>
                {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading={index > 1 ? "lazy" : "eager"} /> : <span className="featured-image-placeholder">TSOGO-BIS</span>}
                <span className="featured-tag">{new Date(product.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000 ? t("featured.just_added") : t("featured.title")}</span>
              </Link>
              <div className="featured-card-copy">
                <div><Link to={productDetailPath(product)} className="featured-name">{product.name}</Link><p>{formatXaf(product.price)}</p></div>
                <button className="featured-add" onClick={() => addProduct(product)} disabled={Number(product.stock_quantity) < 1} aria-label={t("featured.add_to_bag", { name: product.name })} title={Number(product.stock_quantity) < 1 ? t("product.out_of_stock") : t("featured.add_to_bag_short")}>
                  <ShoppingBag size={17} strokeWidth={1.7} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="featured-empty"><h3>{t("featured.empty_title")}</h3><p>{t("featured.empty_copy")}</p><Link to="/shop" className="featured-view-all">{t("home_page.explore_shop")} <ArrowRight size={16} /></Link></div>}
    </section>
  );
}
