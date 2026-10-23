import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ImageOff, LoaderCircle, PackageSearch, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCurrencyContext } from "../context/CurrencyContext";

const PAGE_SIZE = 12;
const productFields = "id,slug,name,description,price,currency,stock_quantity,category_id,published_at,categories(name),product_images(image_url,alt_text,is_primary,sort_order)";

function buildProductQuery({ search, category, sort }) {
  let query = supabase.from("products").select(productFields, { count: "exact" }).eq("status", "published");
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
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
  const filterKey = useMemo(() => JSON.stringify([debouncedSearch, category, sort]), [debouncedSearch, category, sort]);
  const filterKeyRef = useRef(filterKey);
  filterKeyRef.current = filterKey;

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
      const { data, error: queryError, count } = await buildProductQuery({ search: debouncedSearch, category, sort })
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
  }, [debouncedSearch, category, sort, retryCount]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    const requestId = requestIdRef.current;
    const requestedFilterKey = filterKeyRef.current;
    const offset = offsetRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError("");

    try {
      const { data, error: queryError, count } = await buildProductQuery({ search: debouncedSearch, category, sort })
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
  }, [debouncedSearch, category, sort]);

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
        <div className="mb-6 grid grid-cols-1 gap-3 rounded-sm border border-[#e8e5de] bg-white p-3 sm:grid-cols-[minmax(240px,1fr)_minmax(180px,240px)_minmax(180px,220px)] sm:p-4">
          <label className="relative block min-w-0">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#898b84]" />
            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder={t("products.search_placeholder")}
              className="h-11 w-full rounded-sm border border-[#e5e2da] bg-[#fcfbf9] pl-10 pr-3 text-sm text-[#26352e] outline-none transition placeholder:text-[#96988f] focus:border-[#9a8060] focus:ring-2 focus:ring-[#9a8060]/15"
            />
          </label>
          <label className="relative block min-w-0">
            <SlidersHorizontal size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#898b84]" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t("products.category_filter")} className="h-11 w-full appearance-none rounded-sm border border-[#e5e2da] bg-[#fcfbf9] pl-10 pr-9 text-sm text-[#47534b] outline-none focus:border-[#9a8060] focus:ring-2 focus:ring-[#9a8060]/15">
              <option value="all">{t("products.all_categories")}</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#898b84]">⌄</span>
          </label>
          <label className="relative block min-w-0">
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t("products.sort_by")} className="h-11 w-full appearance-none rounded-sm border border-[#e5e2da] bg-[#fcfbf9] px-3.5 pr-9 text-sm text-[#47534b] outline-none focus:border-[#9a8060] focus:ring-2 focus:ring-[#9a8060]/15">
              <option value="newest">{t("products.newest")}</option>
              <option value="name">{t("products.name_az")}</option>
              <option value="price-low">{t("products.price_low")}</option>
              <option value="price-high">{t("products.price_high")}</option>
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#898b84]">⌄</span>
          </label>
        </div>

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
