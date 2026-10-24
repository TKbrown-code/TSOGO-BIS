import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Camera, ImageOff, ImageUp, LoaderCircle, PackageSearch, Search, SlidersHorizontal, TicketPercent, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCurrencyContext } from "../context/CurrencyContext";
import "../styles/shop-filter-bar.css";

const PAGE_SIZE = 12;
const productFields = "id,slug,name,description,price,currency,stock_quantity,category_id,published_at,categories(name),product_images(image_url,alt_text,is_primary,sort_order)";

function buildProductQuery({ search, category, sort, promoScopes }) {
  let query = supabase.from("products").select(productFields, { count: "exact" }).eq("status", "published");
  if (promoScopes && !promoScopes.general) {
    const filters = [];
    if (promoScopes.categoryIds.length) filters.push(`category_id.in.(${promoScopes.categoryIds.join(",")})`);
    if (promoScopes.subcategoryIds.length) filters.push(`subcategory_id.in.(${promoScopes.subcategoryIds.join(",")})`);
    if (promoScopes.productIds.length) filters.push(`id.in.(${promoScopes.productIds.join(",")})`);
    if (!filters.length) return null;
    query = query.or(filters.join(","));
  }
  if (category !== "all") query = query.eq("category_id", category);

  const safeSearch = search.trim().replace(/[(),]/g, " ");
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);

  if (sort === "price-low") query = query.order("price", { ascending: true });
  else if (sort === "price-high") query = query.order("price", { ascending: false });
  else if (sort === "name") query = query.order("name", { ascending: true });
  else query = query.order("published_at", { ascending: false, nullsFirst: false });

  return query.order("id", { ascending: true });
}

function normalizeProduct(product) {
  const sortedImages = [...(product.product_images || [])].sort((a, b) => {
    if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1;
    return Number(a.sort_order || 0) - Number(b.sort_order || 0);
  });
  return { ...product, image: sortedImages.find((image) => image.image_url)?.image_url || "" };
}

function imageDifferenceHash(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 9; canvas.height = 8;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, 9, 8);
        const pixels = context.getImageData(0, 0, 9, 8).data;
        let hash = 0n;
        for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
          const left = (y * 9 + x) * 4; const right = left + 4;
          const leftGray = pixels[left] * .299 + pixels[left + 1] * .587 + pixels[left + 2] * .114;
          const rightGray = pixels[right] * .299 + pixels[right + 1] * .587 + pixels[right + 2] * .114;
          hash = (hash << 1n) | (leftGray > rightGray ? 1n : 0n);
        }
        resolve(hash);
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Image could not be read"));
    image.src = source;
  });
}

function hashDistance(left, right) {
  let value = left ^ right; let bits = 0;
  while (value) { bits += Number(value & 1n); value >>= 1n; }
  return bits;
}

async function findProductsByImage(file, onProgress) {
  const previewUrl = URL.createObjectURL(file);
  try {
    const targetHash = await imageDifferenceHash(previewUrl);
    const allProducts = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("products").select("id,slug,name,description,price,currency,stock_quantity,category_id,product_images(image_url,alt_text,is_primary,sort_order)").eq("status", "published").order("id").range(offset, offset + 499);
      if (error) throw error;
      allProducts.push(...(data || []));
      if ((data || []).length < 500) break;
      onProgress?.(Math.min(allProducts.length, 500));
    }
    const candidates = allProducts.map((product) => {
      const images = [...(product.product_images || [])].filter((image) => image.image_url).sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || Number(a.sort_order || 0) - Number(b.sort_order || 0));
      return { product, image: images[0] };
    }).filter((candidate) => candidate.image);
    let nextIndex = 0; let finished = 0;
    const matches = [];
    const worker = async () => {
      while (nextIndex < candidates.length) {
        const index = nextIndex++;
        const candidate = candidates[index];
        try {
          const hash = await imageDifferenceHash(candidate.image.image_url);
          matches.push({ product: normalizeProduct(candidate.product), image: candidate.image, distance: hashDistance(targetHash, hash) });
        } catch { /* Cross-origin or missing image: skip this candidate. */ }
        finished += 1;
        if (finished % 10 === 0 || finished === candidates.length) onProgress?.(finished, candidates.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, candidates.length) }, worker));
    return matches.sort((a, b) => a.distance - b.distance).slice(0, 6);
  } finally { URL.revokeObjectURL(previewUrl); }
}

function ProductImage({ product, t }) {
  const [failed, setFailed] = useState(false);
  if (!product.image || failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#eeece5] text-[#8b887d]" aria-label={t("products.image_unavailable_for", { name: product.name })}>
        <ImageOff size={27} strokeWidth={1.4} />
        <span className="text-[10px] font-semibold uppercase tracking-[.16em]">{t("products.image_unavailable")}</span>
      </div>
    );
  }
  return (
    <img
      src={product.image}
      alt={product.product_images?.find((image) => image.is_primary)?.alt_text || product.name}
      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function ProductCard({ product, formatPrice, outOfStockLabel, t }) {
  return (
    <Link
      to={`/ProductDetails/${product.id}/${encodeURIComponent(product.slug || product.name)}`}
      className="group min-w-0 overflow-hidden rounded-sm border border-[#e9e6de] bg-white text-[#27352e] no-underline transition duration-200 hover:-translate-y-1 hover:border-[#d8d0c2] hover:shadow-[0_18px_45px_rgba(30,42,35,.09)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8e7658]"
    >
      <div className="relative aspect-[4/4.7] overflow-hidden bg-[#eeece5]">
        <ProductImage product={product} t={t} />
        <span className="absolute left-3 top-3 bg-[#faf9f5]/95 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[.12em] text-[#675f52]">
          {Number(product.stock_quantity) > 0 ? t("products.in_collection") : outOfStockLabel}
        </span>
      </div>
      <div className="p-3.5 sm:p-4">
        <div className="mb-2 flex min-h-4 items-center justify-between gap-2">
          {product.categories?.name
            ? <span className="truncate text-[9px] font-semibold uppercase tracking-[.13em] text-[#8d7657]">{product.categories.name}</span>
            : <span className="text-[9px] font-semibold uppercase tracking-[.13em] text-[#8d7657]">{t("products.brand_edit")}</span>}
          <ArrowRight size={14} className="shrink-0 text-[#8d7657] transition-transform group-hover:translate-x-1" />
        </div>
        <h2 className="line-clamp-2 min-h-10 text-[15px] leading-5 text-[#26352e] sm:text-base">{product.name}</h2>
        <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-[1.55] text-[#7c8078]">{product.description || t("products.default_description")}</p>
        <div className="mt-4 border-t border-[#efede8] pt-3 text-sm font-semibold tracking-[.01em] text-[#735e44]">{formatPrice(product.price)} FCFA</div>
      </div>
    </Link>
  );
}

export default function Shop() {
  const { t } = useTranslation();
  const { convert } = useCurrencyContext();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [promotionsOnly, setPromotionsOnly] = useState(false);
  const [promoScopes, setPromoScopes] = useState(null);
  const [visualFinderOpen, setVisualFinderOpen] = useState(false);
  const [visualPreview, setVisualPreview] = useState("");
  const [visualResults, setVisualResults] = useState([]);
  const [visualMessage, setVisualMessage] = useState("");
  const [visualSearching, setVisualSearching] = useState(false);
  const [visualProgress, setVisualProgress] = useState("");
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const visualPreviewRef = useRef("");
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const sentinelRef = useRef(null);
  const requestIdRef = useRef(0);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const filterKey = useMemo(() => JSON.stringify([debouncedSearch, category, sort, promotionsOnly, promoScopes]), [debouncedSearch, category, sort, promotionsOnly, promoScopes]);
  const filterKeyRef = useRef(filterKey);
  filterKeyRef.current = filterKey;

  useEffect(() => {
    if (location.state?.openImageFinder) setVisualFinderOpen(true);
  }, [location.key, location.state]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      const { data, error: categoryError } = await supabase
        .from("categories")
        .select("id,name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (active && !categoryError) setCategories(data || []);
    };
    loadCategories();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    setSearch(urlSearch);
    setDebouncedSearch(urlSearch.trim());
  }, [searchParams]);

  useEffect(() => () => { if (visualPreviewRef.current) URL.revokeObjectURL(visualPreviewRef.current); }, []);

  async function searchByImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setVisualMessage(t("products.image_search_invalid")); return; }
    if (file.size > 12 * 1024 * 1024) { setVisualMessage(t("products.image_search_too_large")); return; }
    if (visualPreviewRef.current) URL.revokeObjectURL(visualPreviewRef.current);
    visualPreviewRef.current = URL.createObjectURL(file);
    setVisualPreview(visualPreviewRef.current);
    setVisualSearching(true); setVisualResults([]); setVisualMessage(""); setVisualProgress(t("products.image_search_preparing"));
    try {
      const matches = await findProductsByImage(file, (done, total) => setVisualProgress(total ? t("products.image_search_progress", { done, total }) : t("products.image_search_loading")));
      setVisualResults(matches);
      setVisualMessage(matches.length ? (matches[0].distance <= 24 ? t("products.image_search_matches") : t("products.image_search_closest")) : t("products.image_search_none"));
    } catch (searchError) {
      console.error("Visual product search failed:", searchError);
      setVisualMessage(t("products.image_search_failed"));
    } finally { setVisualSearching(false); setVisualProgress(""); }
  }

  useEffect(() => {
    let active = true;
    const requestId = ++requestIdRef.current;
    offsetRef.current = 0;
    hasMoreRef.current = false;
    loadingMoreRef.current = false;
    setProducts([]);
    setTotalCount(0);
    setHasMore(false);
    setError("");
    setLoading(true);
    setLoadingMore(false);

    const loadFirstPage = async () => {
      let promotionScopes = null;
      if (promotionsOnly) {
        const { data: promotionRows, error: promotionError } = await supabase.from("coupons").select("product_id,category_id,subcategory_id").eq("active", true);
        if (promotionError) throw promotionError;
        const currentPromotions = promotionRows || [];
        promotionScopes = {
          general: currentPromotions.some((row) => !row.product_id && !row.category_id && !row.subcategory_id),
          categoryIds: [...new Set(currentPromotions.map((row) => row.category_id).filter(Boolean))],
          subcategoryIds: [...new Set(currentPromotions.map((row) => row.subcategory_id).filter(Boolean))],
          productIds: [...new Set(currentPromotions.map((row) => row.product_id).filter(Boolean))],
        };
        setPromoScopes(promotionScopes);
      } else setPromoScopes(null);
      const productQuery = buildProductQuery({ search: debouncedSearch, category, sort, promoScopes: promotionsOnly ? promotionScopes : null });
      if (!productQuery) { setProducts([]); setTotalCount(0); setHasMore(false); setLoading(false); return; }
      const { data, error: queryError, count } = await productQuery
        .range(0, PAGE_SIZE - 1);
      if (!active || requestId !== requestIdRef.current) return;
      if (queryError) {
        setError(t("products.load_failed_copy"));
        setLoading(false);
        return;
      }

      const firstPage = (data || []).map(normalizeProduct);
      const nextOffset = firstPage.length;
      const moreAvailable = nextOffset < (count || 0);
      setProducts(firstPage);
      setTotalCount(count || 0);
      offsetRef.current = nextOffset;
      hasMoreRef.current = moreAvailable;
      setHasMore(moreAvailable);
      setLoading(false);
    };

    loadFirstPage().catch((loadError) => {
      if (!active || requestId !== requestIdRef.current) return;
      setError(t("products.load_failed_copy"));
      setLoading(false);
    });

    return () => { active = false; };
  }, [debouncedSearch, category, sort, promotionsOnly, retryCount]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    const requestId = requestIdRef.current;
    const requestedFilterKey = filterKeyRef.current;
    const offset = offsetRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError("");

    try {
      const productQuery = buildProductQuery({ search: debouncedSearch, category, sort, promoScopes: promotionsOnly ? promoScopes : null });
      if (!productQuery) { setProducts([]); setTotalCount(0); setHasMore(false); return; }
      const { data, error: queryError, count } = await productQuery
        .range(offset, offset + PAGE_SIZE - 1);
      if (requestId !== requestIdRef.current || requestedFilterKey !== filterKeyRef.current) return;
      if (queryError) throw queryError;

      const nextPage = (data || []).map(normalizeProduct);
      const nextOffset = offset + nextPage.length;
      const moreAvailable = nextOffset < (count || 0);
      setProducts((current) => [...current, ...nextPage]);
      setTotalCount(count || 0);
      offsetRef.current = nextOffset;
      hasMoreRef.current = moreAvailable;
      setHasMore(moreAvailable);
    } catch (loadError) {
      if (requestId === requestIdRef.current && requestedFilterKey === filterKeyRef.current) {
        setError(t("products.load_more_failed"));
      }
    } finally {
      loadingMoreRef.current = false;
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [debouncedSearch, category, sort, promotionsOnly, promoScopes]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: "420px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const handleSearchChange = (event) => {
    const nextSearch = event.target.value;
    setSearch(nextSearch);
    const nextParams = new URLSearchParams(searchParams);
    if (nextSearch.trim()) nextParams.set("search", nextSearch.trim());
    else nextParams.delete("search");
    setSearchParams(nextParams, { replace: true });
  };

  const formatPrice = (price) => `${convert(price)}`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] bg-[#faf9f6] px-4 pb-20 pt-8 text-[#26352e] sm:px-7 sm:pt-12 lg:px-12">
      <section className="mx-auto mb-8 max-w-6xl border-b border-[#e8e5de] pb-7 sm:mb-10 sm:pb-9">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="mb-3 block text-[10px] font-bold uppercase tracking-[.2em] text-[#8a7051]">{t("products.brand_collection")}</span>
            <h1 className="font-[Georgia] text-4xl font-normal leading-tight tracking-[-.04em] sm:text-5xl">{t("products.shop_all")}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#777b73]">{t("products.shop_subtitle")}</p>
          </div>
          <div className="text-xs tracking-wide text-[#777b73]">
            {loading ? t("products.finding_favourites") : t("products.result_count", { visible: products.length, total: totalCount })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl" aria-label={t("products.shop_aria")}>
        <div className="shop-filter-bar mb-6 rounded-sm border border-[#e8e5de] bg-white p-3 sm:p-4">
          <label className="shop-filter-search relative block min-w-0">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#898b84]" />
            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder={t("products.search_placeholder")}
              className="h-11 w-full rounded-sm border border-[#e5e2da] bg-[#fcfbf9] pl-10 pr-12 text-sm text-[#26352e] outline-none transition placeholder:text-[#96988f] focus:border-[#9a8060] focus:ring-2 focus:ring-[#9a8060]/15"
            />
            <button type="button" onClick={() => setVisualFinderOpen((open) => !open)} aria-expanded={visualFinderOpen} aria-label={t("products.find_by_image")} title={t("products.find_by_image")} className="shop-filter-camera absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#526157] transition hover:bg-[#eeece5] hover:text-[#26352e]"><Camera size={17}/></button>
          </label>
          <button type="button" className={`shop-filter-action inline-flex h-11 items-center justify-center gap-2 border px-3 text-xs font-semibold transition ${promotionsOnly ? "border-[#26352e] bg-[#26352e] text-white" : "border-[#e5e2da] bg-[#fcfbf9] text-[#47534b] hover:border-[#9a8060]"}`} onClick={() => setPromotionsOnly((current) => !current)} aria-pressed={promotionsOnly}><TicketPercent size={15}/>{t("products.promotions_filter")}</button>
          <label className="shop-filter-category relative block min-w-0">
            <SlidersHorizontal size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#898b84]" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("products.category_filter")} className="h-11 w-full appearance-none rounded-sm border border-[#e5e2da] bg-[#fcfbf9] pl-10 pr-9 text-sm text-[#47534b] outline-none focus:border-[#9a8060] focus:ring-2 focus:ring-[#9a8060]/15">
              <option value="all">{t("products.all_categories")}</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#898b84]">⌄</span>
          </label>
          <label className="shop-filter-sort relative block min-w-0">
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t("products.sort_by")} className="h-11 w-full appearance-none rounded-sm border border-[#e5e2da] bg-[#fcfbf9] px-3.5 pr-9 text-sm text-[#47534b] outline-none focus:border-[#9a8060] focus:ring-2 focus:ring-[#9a8060]/15">
              <option value="newest">{t("products.newest")}</option>
              <option value="name">{t("products.name_az")}</option>
              <option value="price-low">{t("products.price_low")}</option>
              <option value="price-high">{t("products.price_high")}</option>
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#898b84]">⌄</span>
          </label>
        </div>

        {visualFinderOpen && <section className="mb-6 border border-[#e8e5de] bg-white p-4 sm:p-5" aria-label={t("products.find_by_image")}><header className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-[Georgia] text-xl">{t("products.find_by_image")}</h2><p className="mt-1 text-xs leading-5 text-[#777b73]">{t("products.image_search_help")}</p></div><button type="button" onClick={() => setVisualFinderOpen(false)} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center border border-[#e5e2da] text-[#47534b]"><X size={16}/></button></header><input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { searchByImage(event.target.files?.[0]); event.target.value = ""; }}/><input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { searchByImage(event.target.files?.[0]); event.target.value = ""; }}/><div className="flex flex-wrap gap-2"><button type="button" onClick={() => cameraInputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 bg-[#26352e] px-4 text-xs font-semibold text-white"><Camera size={15}/>{t("products.use_camera")}</button><button type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 border border-[#dcd7ce] px-4 text-xs font-semibold text-[#26352e]"><ImageUp size={15}/>{t("products.upload_image")}</button></div>{visualPreview&&<img src={visualPreview} alt={t("products.image_search_preview")} className="mt-4 h-24 w-24 rounded border border-[#e5e2da] object-cover"/>}{visualSearching&&<p className="mt-3 inline-flex items-center gap-2 text-xs text-[#777b73]" role="status"><LoaderCircle size={15} className="animate-spin"/>{visualProgress}</p>}{visualMessage&&<p className="mt-3 text-sm text-[#526157]" role="status">{visualMessage}</p>}{visualResults.length>0&&<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{visualResults.map(({product,distance})=><Link key={product.id} onClick={()=>setVisualFinderOpen(false)} to={`/ProductDetails/${product.id}/${encodeURIComponent(product.slug||product.name)}`} className="overflow-hidden border border-[#e8e5de] text-[#26352e] no-underline"><img src={product.image} alt={product.name} className="aspect-square w-full object-cover"/><span className="block p-2"><b className="block truncate text-xs">{product.name}</b><small className="text-[#8a7051]">#{product.id} · {distance<=24?t("products.image_match"):t("products.image_close_match")}</small></span></Link>)}</div>}</section>}

        {error && (
          <div role="alert" className="mb-5 flex flex-col gap-3 border border-[#ead6cf] bg-[#fcf4f1] px-4 py-3 text-sm text-[#794b3d] sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => { setError(""); if (products.length) loadMore(); else setRetryCount((count) => count + 1); }} className="w-fit font-semibold underline underline-offset-4">{t("common.try_again")}</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading products" aria-busy="true">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden border border-[#e9e6de] bg-white"><div className="aspect-[4/4.7] animate-pulse bg-[#eeece5]" /><div className="space-y-3 p-4"><div className="h-3 w-1/3 animate-pulse bg-[#eeece5]" /><div className="h-4 w-4/5 animate-pulse bg-[#eeece5]" /><div className="h-3 w-2/3 animate-pulse bg-[#eeece5]" /></div></div>)}
          </div>
        ) : products.length === 0 && error ? (
          <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-[#dcd8cf] bg-white px-5 text-center">
            <PackageSearch size={34} strokeWidth={1.3} className="mb-4 text-[#9a8060]" />
            <h2 className="font-[Georgia] text-2xl font-normal text-[#26352e]">{t("products.load_failed_title")}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#777b73]">{t("products.load_failed_copy")}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-[#dcd8cf] bg-white px-5 text-center">
            <PackageSearch size={34} strokeWidth={1.3} className="mb-4 text-[#9a8060]" />
            <h2 className="font-[Georgia] text-2xl font-normal text-[#26352e]">{t("products.no_products")}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#777b73]">{t("products.try_adjusting")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => <ProductCard key={product.id} product={product} formatPrice={formatPrice} outOfStockLabel={t("product.out_of_stock")} t={t} />)}
            </div>
            <div ref={sentinelRef} className="h-3" aria-hidden="true" />
            <div className="flex min-h-24 flex-col items-center justify-center gap-3 pt-4 text-center">
              {loadingMore ? (
                <div role="status" className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[.14em] text-[#777b73]"><LoaderCircle size={16} className="animate-spin text-[#8d7657]" /> {t("products.loading_more")}</div>
              ) : hasMore ? (
                <button type="button" onClick={loadMore} className="inline-flex min-h-11 items-center gap-2 border border-[#c9c2b5] bg-transparent px-5 text-xs font-semibold uppercase tracking-[.11em] text-[#334139] transition hover:border-[#26352e] hover:bg-[#26352e] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8e7658]">
                  {t("products.load_more")} <ArrowRight size={15} />
                </button>
              ) : (
                <p className="text-xs tracking-wide text-[#81847c]">{t("products.all_loaded", { count: totalCount })}</p>
              )}
              {products.length > 0 && <span className="text-[10px] tracking-wide text-[#999a92]">{t("products.pagination_showing", { visible: products.length, total: totalCount })}</span>}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
