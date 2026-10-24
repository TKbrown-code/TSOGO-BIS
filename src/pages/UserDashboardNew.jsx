// src/pages/UserDashboardNew.jsx - Complete User Dashboard with Sidebar
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useUserContext } from "../context/useUserContext";
import { useNavigate, Navigate, useSearchParams, Link } from "react-router-dom";
import { Home, BarChart3, ShoppingCart, ShoppingBag, FileText, LogOut, DollarSign, Package, Star, Settings, CheckCircle, Clock, Plus, Minus, Menu, X, Gift, Copy, Check, Search, ArrowUpRight, Download, Cookie } from "lucide-react";
import { jsPDF } from "jspdf";
import "../styles/UserDashboardNew.css";
import "../styles/dashboard-invoice.css";
import BrandMonogram from "../assets/nav-monogram.png";
import ProductImageFallback from "../assets/imagefallback.jpg";
import { useModalMessage } from "../context/ModalMessageContext";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import NotificationCenter from "../components/shared/NotificationCenter";
import ProfileAvatar from "../components/shared/ProfileAvatar";
import ProfileImageUploader from "../components/shared/ProfileImageUploader";

export default function UserDashboardNew() {
  const { user, profile, loading } = useUserContext();
  const { t, i18n } = useTranslation();
  const { refreshCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showAlert } = useModalMessage();
  
  // Active section
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    const section = searchParams.get("section");
    if (["settings", "referrals"].includes(section)) setActiveSection(section);
  }, [searchParams]);
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);
  useEffect(() => {
    const language = i18n.resolvedLanguage?.slice(0, 2);
    if (["en", "fr", "zh"].includes(language)) {
      setFormData((current) => ({ ...current, language }));
    }
  }, [i18n.resolvedLanguage]);
  const [dataLoading, setDataLoading] = useState(true);
  const [productNames, setProductNames] = useState({});
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");

  // User data from all tables
  const [userData, setUserData] = useState({
    profile: null,
    orders: [],
    cart: [],
    cartHistory: [],
    reviews: [],
    referrals: [],
    referralWallet: []
  });

  // Statistics
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
    cartItems: 0,
    reviewsGiven: 0
  });

  // Settings form
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    language: i18n.resolvedLanguage?.slice(0, 2) || "fr"
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadAllUserData();
    }
  }, [user]);

  // Delivery changes are written to the checkout row by the admin workflow.
  // Subscribe only to this customer's rows and patch the visible order card.
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`customer-dashboard-orders:${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "checkouts",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const changedOrder = payload.new;
        if (!changedOrder?.checkout_id) return;
        setUserData((current) => {
          const hasOrder = current.orders.some((order) => order.checkout_id === changedOrder.checkout_id);
          return {
            ...current,
            orders: hasOrder
              ? current.orders.map((order) => order.checkout_id === changedOrder.checkout_id ? { ...order, ...changedOrder } : order)
              : [changedOrder, ...current.orders],
          };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Keep hooks stable while auth state changes, then redirect signed-out visitors.
  if (!loading && !user) {
    return <Navigate to="/SignUp" replace />;
  }

  async function loadAllUserData() {
    setDataLoading(true);

    try {
      // 1. Load Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // 2. Load Orders (checkouts) with product details
      const { data: ordersData } = await supabase
        .from("checkouts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const checkoutIds = (ordersData || []).map((order) => order.checkout_id).filter(Boolean);
      const { data: checkoutItemRows, error: checkoutItemsError } = checkoutIds.length
        ? await supabase.from("checkout_items")
          .select("checkout_id,product_id,quantity,price,size,color,shipping_method,shipping_fee")
          .in("checkout_id", checkoutIds)
        : { data: [], error: null };
      if (checkoutItemsError) console.warn("Could not load dashboard order items:", checkoutItemsError);

      const parsedOrderItems = (ordersData || []).flatMap((order) => {
        const items = Array.isArray(order.items) ? order.items : typeof order.items === "string"
          ? (() => { try { return JSON.parse(order.items); } catch { return []; } })()
          : [];
        return items.map((item) => ({ ...item, product_id: item.product_id?.id ?? item.product_id }));
      });
      const imageProductIds = [...new Set([
        ...(checkoutItemRows || []).map((item) => Number(item.product_id)).filter((id) => Number.isFinite(id) && id > 0),
        ...parsedOrderItems.map((item) => Number(item.product_id)).filter((id) => Number.isFinite(id) && id > 0),
      ])];
      const [imagesResult, orderProductsResult] = imageProductIds.length
        ? await Promise.all([
          supabase.from("product_images").select("product_id,image_url,is_primary").in("product_id", imageProductIds),
          supabase.from("products").select("id,name,description").in("id", imageProductIds),
        ])
        : [{ data: [], error: null }, { data: [], error: null }];
      const { data: orderProductImages, error: orderImagesError } = imagesResult;
      const { data: orderProducts, error: orderProductsError } = orderProductsResult;
      if (orderImagesError) console.warn("Could not load dashboard order product images:", orderImagesError);
      if (orderProductsError) console.warn("Could not load dashboard order product names:", orderProductsError);
      const productNamesById = (orderProducts || []).reduce((map, product) => ({ ...map, [product.id]: product.name }), {});
      const productDescriptionsById = (orderProducts || []).reduce((map, product) => ({ ...map, [product.id]: product.description || "" }), {});
      const imagesByProductId = (orderProductImages || []).reduce((map, image) => {
        (map[image.product_id] ||= []).push(image);
        return map;
      }, {});
      const itemRowsByCheckoutId = (checkoutItemRows || []).reduce((map, item) => {
        (map[item.checkout_id] ||= []).push(item);
        return map;
      }, {});

      // 3. Load Cart with full product details and images
      const { data: cartData } = await supabase
        .from("cart_items")
        .select(`
          *,
          product_id:products (
            id,
            name,
            price,
            stock_quantity,
            product_images (
              image_url,
              is_primary
            )
          )
        `)
        .eq("user_id", user.id);

      // 4. Load Cart History (basic data first)
      const { data: cartHistoryData } = await supabase
        .from("cart_history")
        .select("*")
        .eq("user_id", user.id)
        .order("action_at", { ascending: false })
        .limit(20);
      
      // Fetch product names for cart history
      if (cartHistoryData && cartHistoryData.length > 0) {
        const productIds = [...new Set(cartHistoryData.map(item => item.product_id))];
        const { data: productsData } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        
        const nameMap = {};
        if (productsData) {
          productsData.forEach(product => {
            nameMap[product.id] = product.name;
          });
        }
        setProductNames(nameMap);
      }
      
      // 5. Load Reviews with product details
      const { data: reviewsData } = await supabase
        .from("product_reviews")
        .select(`
          *,
          product_id (
            id,
            name,
            product_images (
              image_url,
              is_primary
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: referralsData, error: referralsError } = await supabase
        .from("referrals")
        .select("id, created_at, commission_amount, commission_status")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false });
      if (referralsError && referralsError.code !== "42P01") {
        console.error("Could not load referral summary:", referralsError);
      }
      const { data: referralWalletData, error: walletError } = await supabase
        .from("referral_wallet_ledger")
        .select("entry_type, amount")
        .eq("user_id", user.id);
      if (walletError && walletError.code !== "42P01") {
        console.error("Could not load referral store credit:", walletError);
      }

      const normalizedOrders = (ordersData || []).map((order) => {
        const snapshotItems = Array.isArray(order.items) ? order.items : typeof order.items === "string"
          ? (() => { try { return JSON.parse(order.items); } catch { return []; } })()
          : [];
        const checkoutItems = itemRowsByCheckoutId[order.checkout_id] || [];
        const sourceItems = snapshotItems.length ? snapshotItems : checkoutItems;
        return {
          ...order,
          items: sourceItems.map((item, index) => {
            const itemProductId = item.product_id?.id ?? item.product_id ?? checkoutItems[index]?.product_id;
            const itemImages = imagesByProductId[itemProductId] || [];
            const primaryImage = itemImages.find((image) => image.is_primary) || itemImages[0];
            return {
              ...item,
              product_id: itemProductId,
              name: item.name || item.product_name || item.product_id?.name || productNamesById[itemProductId] || checkoutItems[index]?.product_name,
              description: item.product_description || item.description || productDescriptionsById[itemProductId] || "",
              quantity: Number(item.quantity ?? checkoutItems[index]?.quantity) || 1,
              price: Number(item.price ?? item.unit_price ?? checkoutItems[index]?.price) || 0,
              size: item.size || checkoutItems[index]?.size,
              color: item.color || checkoutItems[index]?.color,
              shipping_method: item.shipping_method || checkoutItems[index]?.shipping_method,
              image_url: item.image_url || item.imageUrl || item.image || primaryImage?.image_url || null,
            };
          }),
        };
      });

      // Set user data
      setUserData({
        profile: profileData,
        orders: normalizedOrders,
        cart: cartData || [],
        cartHistory: cartHistoryData || [],
        reviews: reviewsData || [],
        referrals: referralsData || [],
        referralWallet: referralWalletData || []
      });

      // Set form data
      if (profileData) {
        setFormData({
          fullName: profileData.display_name || user.user_metadata?.display_name || "",
          phone: profileData.phone || "",
          language: profileData.preferred_language || i18n.resolvedLanguage?.slice(0, 2) || "fr"
        });
      }

      // Calculate statistics
      const totalOrders = normalizedOrders.length;
      const completedOrders = normalizedOrders.filter(o => ["paid", "completed"].includes(String(o.payment_status || o.status || "").toLowerCase())).length;
      const pendingOrders = normalizedOrders.filter(o => ["pending", "awaiting_payment", "awaiting payment"].includes(String(o.payment_status || o.status || "").toLowerCase())).length;
      const totalSpent = normalizedOrders.reduce((sum, o) => ["paid", "completed"].includes(String(o.payment_status || o.status || "").toLowerCase()) ? sum + (Number(o.total) || 0) : sum, 0);

      setStats({
        totalOrders,
        completedOrders,
        pendingOrders,
        totalSpent,
        cartItems: (cartData || []).reduce((count, item) => count + (Number(item.quantity) || 1), 0),
        reviewsGiven: reviewsData?.length || 0
      });

    } catch (error) {
      console.error("Error loading user data:", error);
    }

    setDataLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  async function copyReferralLink() {
    if (!user?.id) return;
    const encodedUserId = btoa(user.id).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    const userIdPrefix = user.id.replaceAll("-", "").slice(0, 7).toUpperCase();
    const link = `${window.location.origin}/referrals/${encodedUserId}/${userIdPrefix}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedReferralLink(true);
      window.setTimeout(() => setCopiedReferralLink(false), 2200);
    } catch (error) {
      console.error("Could not copy referral link:", error);
      showAlert(t("dashboard.referral_copy_error"), t("common.error"), "error");
    }
  }

  async function handleSaveProfile() {
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: formData.fullName.trim(),
        phone: formData.phone,
        preferred_language: formData.language
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("Profile update failed:", error);
      showAlert(t("dashboard.profile_save_error"), t("common.error"), "error");
    } else {
      await i18n.changeLanguage(formData.language);
      setUserData((current) => ({
        ...current,
        profile: { ...current.profile, display_name: formData.fullName.trim(), phone: formData.phone, preferred_language: formData.language },
      }));
      showAlert(t("dashboard.profile_saved"), t("common.success"));
    }

    setSaving(false);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      showAlert(t("dashboard.password_too_short"), t("common.error"), "warning");
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert(t("dashboard.password_mismatch"), t("common.error"), "warning");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error("Password update failed:", error);
      showAlert(t("dashboard.password_error"), t("common.error"), "error");
    } else {
      showAlert(t("dashboard.password_saved"), t("common.success"));
      setNewPassword("");
      setConfirmPassword("");
    }

    setSaving(false);
  }

  async function handleRemoveFromCart(cartId) {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", cartId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Cart item removal failed:", error);
      showAlert(t("dashboard.cart_remove_error"), t("common.error"), "error");
    } else {
      await Promise.all([loadAllUserData(), refreshCart()]);
    }
  }

  async function handleUpdateCartQuantity(cartId, newQuantity) {
    if (newQuantity < 1) return;

    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: newQuantity })
      .eq("id", cartId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Cart quantity update failed:", error);
      showAlert(t("dashboard.cart_update_error"), t("common.error"), "error");
    } else {
      await Promise.all([loadAllUserData(), refreshCart()]);
    }
  }

  const formatCurrency = (amount, language = i18n.resolvedLanguage) => {
    const locale = { en: "en-CM", fr: "fr-CM", zh: "zh-CN" }[language?.slice(0, 2)] || "fr-CM";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(Number(amount) || 0);
  };

  const formatDate = (dateString, language = i18n.resolvedLanguage) => {
    const locale = { en: "en-CM", fr: "fr-CM", zh: "zh-CN" }[language?.slice(0, 2)] || "fr-CM";
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const formatPaymentStatus = (status) => {
    const translated = {
      paid: t("orders.payment_completed"),
      pending: t("orders.awaiting_payment"),
      cancelled: t("orders.cancelled"),
      failed: t("payment_modal.failed_title"),
      expired: t("payment_modal.expired_title"),
      processing: t("orders.delivery_processing"),
      shipped: t("orders.delivery_shipped"),
      out_for_delivery: t("orders.delivery_out_for_delivery"),
      delivered: t("orders.delivery_delivered"),
    };
    return translated[status] || status || t("common.unknown");
  };

  const downloadInvoice = async (order) => {
    const invoiceLanguage = (userData.profile?.preferred_language || profile?.preferred_language || i18n.resolvedLanguage || "fr").slice(0, 2);
    const invoiceT = i18n.getFixedT(invoiceLanguage);
    const rawPaymentStatus = String(order.payment_status || order.status || "").toLowerCase();
    const localizedPaymentStatus = ({
      paid: invoiceT("orders.payment_completed"),
      pending: invoiceT("orders.awaiting_payment"),
      cancelled: invoiceT("orders.cancelled"),
      failed: invoiceT("payment_modal.failed_title"),
      expired: invoiceT("payment_modal.expired_title"),
      processing: invoiceT("orders.delivery_processing"),
      shipped: invoiceT("orders.delivery_shipped"),
      out_for_delivery: invoiceT("orders.delivery_out_for_delivery"),
      delivered: invoiceT("orders.delivery_delivered"),
    })[rawPaymentStatus] || order.payment_status || order.status || invoiceT("common.unknown");
    const invoiceText = {
      title: invoiceT("dashboard.invoice.title"),
      order: invoiceT("dashboard.invoice.order", { id: order.checkout_id }),
      date: invoiceT("dashboard.invoice.date", { date: formatDate(order.created_at, invoiceLanguage) }),
      payment: invoiceT("dashboard.invoice.payment", { status: localizedPaymentStatus }),
      address: invoiceT("dashboard.invoice.address", { address: order.address }),
      product: invoiceT("dashboard.invoice.product"),
      quantity: invoiceT("dashboard.invoice.quantity"),
      amount: invoiceT("dashboard.invoice.amount"),
      total: invoiceT("dashboard.invoice.total"),
      paymentStatus: invoiceT("dashboard.invoice.payment_status"),
      paid: invoiceT("dashboard.invoice.paid"),
      awaitingPayment: invoiceT("dashboard.invoice.awaiting_payment"),
      amountDue: invoiceT("dashboard.invoice.amount_due"),
      deliveryDue: invoiceT("dashboard.invoice.delivery_due"),
      customer: invoiceT("dashboard.invoice.customer"),
      phone: invoiceT("dashboard.invoice.phone"),
      addressLabel: invoiceT("dashboard.invoice.delivery_address"),
    };
    const invoiceCurrency = (amount) => formatCurrency(amount, invoiceLanguage);
    const imageToJpeg = async (url) => new Promise((resolve) => {
      if (!url) { resolve(null); return; }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
          canvas.getContext("2d").drawImage(image, 0, 0, 96, 96);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } catch { resolve(null); }
      };
      image.onerror = () => resolve(null);
      image.src = url;
    });
    const profilePath = userData.profile?.avatar_path || profile?.avatar_path;
    let customerPhoto = null;
    if (profilePath) {
      try {
        const { data } = await supabase.storage.from("profile-images").createSignedUrl(profilePath, 300);
        if (data?.signedUrl) customerPhoto = await imageToJpeg(data.signedUrl);
      } catch { /* A profile image is optional in the invoice. */ }
    }
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const left = 18;
    const right = 192;
    const ink = [36, 53, 46];
    const muted = [105, 113, 106];
    const line = [225, 221, 211];
    const isPaid = ["paid", "succeeded", "successful", "completed"].includes(rawPaymentStatus);
    const customerName = order.user_name || order.customer_name || userData.profile?.display_name || profile?.display_name || user?.user_metadata?.display_name || "Customer";
    const customerPhone = order.phone_number || order.customer_phone || userData.profile?.phone || profile?.phone || "";
    const drawHeader = () => {
      doc.setFillColor(...ink);
      doc.rect(0, 0, 210, 5, "F");
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("TSOGO-BIS", left, 19);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(invoiceText.title, right, 19, { align: "right" });
      doc.setDrawColor(...line);
      doc.line(left, 25, right, 25);
    };
    drawHeader();

    doc.setTextColor(...ink);
    doc.setFont("times", "normal");
    doc.setFontSize(23);
    doc.text(invoiceText.order, left, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(invoiceText.date, left, 48);
    doc.setFillColor(...(isPaid ? [231, 241, 233] : [250, 239, 222]));
    doc.roundedRect(155, 31, 37, 11, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...(isPaid ? [42, 105, 70] : [151, 97, 43]));
    doc.text(invoiceT(isPaid ? "dashboard.invoice.stamp_paid" : "dashboard.invoice.stamp_pending"), 173.5, 38, { align: "center" });

    // Customer and delivery details share a quiet, structured panel.
    doc.setFillColor(249, 248, 244);
    doc.setDrawColor(...line);
    doc.roundedRect(left, 56, right - left, 30, 2, 2, "FD");
    if (customerPhoto) {
      try { doc.addImage(customerPhoto, "JPEG", left + 4, 62, 18, 18, undefined, "FAST"); } catch { /* Optional profile photo. */ }
    }
    const buyerX = left + 27;
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(invoiceText.customer.toUpperCase(), buyerX, 64);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(String(customerName), 63), buyerX, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    if (customerPhone) doc.text(`${invoiceText.phone}: ${customerPhone}`, buyerX, 77);
    const addressText = order.address ? doc.splitTextToSize(invoiceText.address, 73) : [];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(invoiceText.addressLabel.toUpperCase(), 112, 64);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    if (addressText.length) doc.text(addressText, 112, 71);

    let y = 99;
    const tableHeader = () => {
      doc.setFillColor(...ink);
      doc.roundedRect(left, y, right - left, 10, 1.5, 1.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(invoiceText.product, left + 27, y + 6.5);
      doc.text(invoiceText.quantity, 157, y + 6.5, { align: "right" });
      doc.text(invoiceText.amount, right - 4, y + 6.5, { align: "right" });
      y += 10;
    };
    tableHeader();
    const items = Array.isArray(order.items) ? order.items : [];
    for (const [index, item] of items.entries()) {
      const name = item.name || item.product_name || "Product";
      const details = [item.color, item.size].filter(Boolean).join(" / ");
      const description = item.description || details;
      const nameLines = doc.splitTextToSize(String(name), 78);
      const detailLines = description ? doc.splitTextToSize(String(description), 78) : [];
      const rowHeight = Math.max(25, 8 + nameLines.length * 4.5 + Math.min(detailLines.length, 3) * 3.5);
      if (y + rowHeight + 52 > 276) { doc.addPage(); drawHeader(); y = 36; tableHeader(); }
      if (index % 2 === 0) { doc.setFillColor(250, 249, 246); doc.rect(left, y, right - left, rowHeight, "F"); }
      const imageData = await imageToJpeg(item.image_url);
      if (imageData) {
        try { doc.addImage(imageData, "JPEG", left + 3, y + (rowHeight - 19) / 2, 19, 19, undefined, "FAST"); } catch { /* Product images are optional. */ }
      }
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(nameLines, left + 27, y + 7);
      if (detailLines.length) {
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(detailLines.slice(0, 3), left + 27, y + 7 + nameLines.length * 4.5);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(String(Number(item.quantity) || 1), 157, y + 12, { align: "right" });
      doc.text(invoiceCurrency((Number(item.price) || 0) * (Number(item.quantity) || 1)), right - 4, y + 12, { align: "right" });
      doc.setDrawColor(...line);
      doc.line(left, y + rowHeight, right, y + rowHeight);
      y += rowHeight;
    }
    y += 12;
    const paid = isPaid;
    const dueNow = paid ? 0 : Number(order.amount_due ?? order.total) || 0;
    const deliveryDue = Number(order.shipping_due_on_delivery) || 0;
    const summaryHeight = deliveryDue > 0 ? 40 : 34;
    if (y + summaryHeight > 274) { doc.addPage(); drawHeader(); y = 38; }
    doc.setFillColor(249, 248, 244);
    doc.setDrawColor(...line);
    doc.roundedRect(103, y, right - 103, summaryHeight, 2, 2, "FD");
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(invoiceText.paymentStatus, 108, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(paid ? [42, 105, 70] : [151, 97, 43]));
    doc.text(paid ? invoiceText.paid : invoiceText.awaitingPayment, right - 5, y + 8, { align: "right" });
    doc.setDrawColor(...line);
    doc.line(108, y + 12, right - 5, y + 12);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(invoiceText.total, 108, y + 20);
    doc.setFontSize(12);
    doc.text(invoiceCurrency(order.total), right - 5, y + 20, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(invoiceText.amountDue, 108, y + 28);
    doc.setTextColor(...ink);
    doc.text(invoiceCurrency(dueNow), right - 5, y + 28, { align: "right" });
    if (deliveryDue > 0) {
      doc.setTextColor(...muted);
      doc.text(invoiceText.deliveryDue, 108, y + 35);
      doc.setTextColor(...ink);
      doc.text(invoiceCurrency(deliveryDue), right - 5, y + 35, { align: "right" });
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("TSOGO-BIS · Thoughtful finds, simply delivered", left, 282);
    doc.save(`TSOGO-BIS-invoice-${order.checkout_id}.pdf`);
  };

  if (loading || dataLoading) {
    return (
      <div className="user-dashboard-container">
        <div className="user-dashboard-loading">
          <div className="spinner"></div>
          <p>{t("dashboard.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`user-dashboard-container ${sidebarOpen ? "sidebar-is-open" : ""}`}>
      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? t("dashboard.close_menu") : t("dashboard.open_menu")}
        aria-expanded={sidebarOpen}
        aria-controls="customer-dashboard-sidebar"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside id="customer-dashboard-sidebar" className={`user-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link to="/" className="dashboard-brand" aria-label={t("navbar.home_aria")} onClick={() => setSidebarOpen(false)}>
          <span className="dashboard-brand-mark" aria-hidden="true"><img src={BrandMonogram} alt="" /></span>
          <span className="dashboard-brand-name">TSOGO<span>-</span>BIS<small>{t("navbar.tagline")}</small></span>
        </Link>
        <div className="sidebar-header">
          <ProfileAvatar userId={user?.id} avatarPath={userData.profile?.avatar_path} name={userData.profile?.display_name || user?.user_metadata?.display_name || user?.email || "U"} className="user-avatar" />
          <h3>{userData.profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || ""}</h3>
          <p>{user?.email}</p>
        </div>

        <nav className="sidebar-nav">
          <button
            className="btn-home"
            onClick={() => navigate("/")}
          >
            <span className="icon"><Home size={20} /></span>
            {t("dashboard.home")}
          </button>
          <button
            className={activeSection === "overview" ? "active" : ""}
            onClick={() => {
              setActiveSection("overview");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><BarChart3 size={20} /></span>
            {t("dashboard.overview")}
          </button>
          <button
            className={activeSection === "orders" ? "active" : ""}
            onClick={() => {
              setActiveSection("orders");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><ShoppingCart size={20} /></span>
            {t("dashboard.orders")}
          </button>
          <button
            className={activeSection === "cart" ? "active" : ""}
            onClick={() => {
              setActiveSection("cart");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><ShoppingBag size={20} /></span>
            {t("dashboard.cart")}
            {stats.cartItems > 0 && (
              <span className="badge">{stats.cartItems}</span>
            )}
          </button>
          <button
            className={activeSection === "reviews" ? "active" : ""}
            onClick={() => {
              setActiveSection("reviews");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><Star size={20} /></span>
            {t("dashboard.reviews")}
          </button>
          <button
            className={activeSection === "history" ? "active" : ""}
            onClick={() => {
              setActiveSection("history");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><FileText size={20} /></span>
            {t("dashboard.cart_history")}
          </button>
          <button
            className={activeSection === "settings" ? "active" : ""}
            onClick={() => {
              setActiveSection("settings");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><Settings size={20} /></span>
            {t("dashboard.settings")}
          </button>
          <button
            className={activeSection === "referrals" ? "active" : ""}
            onClick={() => {
              setActiveSection("referrals");
              setSidebarOpen(false);
            }}
          >
            <span className="icon"><Gift size={20} /></span>
            {t("dashboard.referrals")}
          </button>
        </nav>

        <button className="btn-signout" onClick={handleSignOut}>
          <span className="icon"><LogOut size={20} /></span>
          {t("dashboard.sign_out")}
        </button>
      </aside>

      {/* Main Content */}
      <main className="user-main-content">
        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="section-content">
            <section className="dashboard-welcome">
              <div>
                <span className="dashboard-eyebrow">TSOGO-BIS · {t("dashboard.overview")}</span>
                <h1>{t("dashboard.welcome_back", { name: (userData.profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "").split(" ")[0] })}</h1>
                <p>{t("dashboard.welcome_copy")}</p>
              </div>
              <div className="dashboard-welcome-actions">
                <NotificationCenter userId={user?.id} audience="customer" onOpen={() => { setActiveSection("orders"); setSidebarOpen(false); }} />
                <button type="button" className="dashboard-shop-cta" onClick={() => navigate("/shop")}>{t("dashboard.start_shopping")} <ArrowUpRight size={16} /></button>
              </div>
            </section>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><ShoppingCart size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalOrders}</div>
                  <div className="stat-label">{t("dashboard.total_orders")}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><CheckCircle size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.completedOrders}</div>
                  <div className="stat-label">{t("dashboard.completed")}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Clock size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.pendingOrders}</div>
                  <div className="stat-label">{t("dashboard.pending")}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><DollarSign size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{formatCurrency(stats.totalSpent)}</div>
                  <div className="stat-label">{t("dashboard.total_spent")}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><ShoppingBag size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.cartItems}</div>
                  <div className="stat-label">{t("dashboard.cart_items")}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Star size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.reviewsGiven}</div>
                  <div className="stat-label">{t("dashboard.reviews_given")}</div>
                </div>
              </div>
            </div>

            <section className="dashboard-referral-card">
              <div className="dashboard-referral-copy">
                <span className="dashboard-referral-icon"><Gift size={20} /></span>
                <div>
                  <h2>{t("dashboard.referral_invite_title")}</h2>
                  <p>{t("dashboard.referral_invite_copy")}</p>
                </div>
              </div>
              <button type="button" className="dashboard-referral-button" onClick={copyReferralLink} disabled={!user?.id}>
                {copiedReferralLink ? <Check size={16} /> : <Copy size={16} />}
                {copiedReferralLink ? t("dashboard.referral_copied") : t("dashboard.referral_copy_link")}
              </button>
            </section>

            <section className="dashboard-shortcuts" aria-label={t("dashboard.quick_actions")}>
              <button type="button" onClick={() => setActiveSection("orders")}><ShoppingCart size={18} /><span>{t("dashboard.orders")}</span><ArrowUpRight size={15} /></button>
              <button type="button" onClick={() => setActiveSection("cart")}><ShoppingBag size={18} /><span>{t("dashboard.cart")}</span><b>{stats.cartItems}</b></button>
              <button type="button" onClick={() => setActiveSection("reviews")}><Star size={18} /><span>{t("dashboard.reviews")}</span><b>{stats.reviewsGiven}</b></button>
              <button type="button" onClick={() => setActiveSection("settings")}><Settings size={18} /><span>{t("dashboard.settings")}</span><ArrowUpRight size={15} /></button>
            </section>

            <div className="recent-section">
              <div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">{t("dashboard.order_activity")}</span><h2>{t("dashboard.recent_orders")}</h2></div><button type="button" className="dashboard-text-action" onClick={() => setActiveSection("orders")}>{t("dashboard.view_all_orders")} <ArrowUpRight size={15} /></button></div>
              {userData.orders.slice(0, 5).length === 0 ? (
                <div className="empty-state">
                  <p>{t("dashboard.no_orders_copy")}</p>
                  <button onClick={() => navigate("/shop")}>{t("dashboard.start_shopping")}</button>
                </div>
              ) : (
                <div className="orders-list">
                  {userData.orders.slice(0, 5).map(order => (
                    <div onClick={() => navigate("/orders")} key={order.checkout_id} className="order-card-mini" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate("/orders"); }}>
                      <div className="order-header">
                        <strong>{t("dashboard.order_number", { id: order.checkout_id })}</strong>
                        <span className={`status-badge ${order.payment_status || order.status}`}>
                          {formatPaymentStatus(order.payment_status || order.status)}
                        </span>
                      </div>
                      <div className="recent-order-content">
                        <div className="recent-order-products">
                          {(order.items || []).length ? (order.items || []).slice(0, 3).map((item, index) => {
                            const optionDetails = [item.color, item.size].filter(Boolean).join(" · ");
                            const productName = item.name || item.product_name || item.product_id?.name || t("common.unknown");
                            return <div className="recent-order-product" key={`${order.checkout_id}-${item.product_id?.id || item.product_id || "item"}-${index}`}>
                              <img className="recent-order-product-image" src={item.image_url || ProductImageFallback} alt={productName} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = ProductImageFallback; }} />
                              <span className="recent-order-product-copy"><strong>{productName}</strong><small>{optionDetails ? `${optionDetails} · ` : ""}× {Number(item.quantity) || 1}</small></span>
                              <span className="recent-order-product-price">{formatCurrency((Number(item.price ?? item.unit_price) || 0) * (Number(item.quantity) || 1))}</span>
                            </div>;
                          }) : <div className="recent-order-no-items">{t("dashboard.no_item_details")}</div>}
                          {(order.items || []).length > 3 && <small className="recent-order-more">+ {(order.items || []).length - 3} {t("dashboard.more_items")}</small>}
                        </div>
                        <div className="recent-order-summary">
                          <span>{formatDate(order.created_at)}</span>
                          {(order.delivery_status || order.items?.[0]?.shipping_method || order["method of shipping"]) && <small>{order.delivery_status ? t(`orders.delivery_${order.delivery_status}`, { defaultValue: order.delivery_status }) : order.items?.[0]?.shipping_method || order["method of shipping"]}</small>}
                          <strong className="order-total">{formatCurrency(order.total)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "referrals" && (
          <div className="section-content">
            <h1>{t("dashboard.referrals")}</h1>
            <section className="dashboard-referral-panel">
              <div className="dashboard-referral-panel-heading">
                <span className="dashboard-referral-icon"><Gift size={22} /></span>
                <div>
                  <h2>{t("dashboard.referral_invite_title")}</h2>
                  <p>{t("dashboard.referral_invite_copy")}</p>
                </div>
              </div>
              <label className="dashboard-referral-label" htmlFor="dashboard-referral-link">{t("dashboard.referral_your_link")}</label>
              <div className="dashboard-referral-link-row">
                <input id="dashboard-referral-link" readOnly value={user?.id ? `${window.location.origin}/referrals/${btoa(user.id).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}/${user.id.replaceAll("-", "").slice(0, 7).toUpperCase()}` : ""} />
                <button type="button" className="dashboard-referral-button" onClick={copyReferralLink} disabled={!user?.id}>
                  {copiedReferralLink ? <Check size={16} /> : <Copy size={16} />}
                  {copiedReferralLink ? t("dashboard.referral_copied") : t("dashboard.referral_copy_link")}
                </button>
              </div>
              <p className="dashboard-referral-terms">{t("dashboard.referral_terms")}</p>
              <div className="dashboard-referral-metrics">
                <div><span>{t("dashboard.referral_people")}</span><strong>{userData.referrals.length}</strong></div>
                <div><span>{t("dashboard.referral_commission")}</span><strong>{formatCurrency(userData.referrals.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0))}</strong></div>
                <div><span>{t("dashboard.referral_pending")}</span><strong>{formatCurrency(userData.referralWallet.reduce((sum, row) => sum + ((row.entry_type === "spent" ? -1 : 1) * Number(row.amount || 0)), 0))}</strong></div>
              </div>
            </section>
          </div>
        )}

        {/* Orders Section */}
        {activeSection === "orders" && (
          <div className="section-content">
            <div className="dashboard-page-heading"><div><span className="dashboard-eyebrow">{t("dashboard.order_activity")}</span><h1>{t("dashboard.orders")}</h1></div><span className="dashboard-order-count">{userData.orders.length}</span></div>

            {userData.orders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Package size={48} /></div>
                <h3>{t("dashboard.no_orders_yet")}</h3>
                <p>{t("dashboard.orders_empty_copy")}</p>
                <button onClick={() => navigate("/shop")}>{t("dashboard.browse_products")}</button>
              </div>
            ) : (
              <>
              <div className="dashboard-order-tools">
                <label className="dashboard-order-search"><Search size={17} /><input type="search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder={t("dashboard.search_orders")} aria-label={t("dashboard.search_orders")} /></label>
                <div className="dashboard-order-filters" role="group" aria-label={t("dashboard.filter_orders")}>
                  {["all", "pending", "paid"].map((filter) => <button type="button" key={filter} className={orderFilter === filter ? "active" : ""} onClick={() => setOrderFilter(filter)}>{filter === "all" ? t("dashboard.all_orders") : filter === "pending" ? t("orders.awaiting_payment") : t("orders.payment_completed")}</button>)}
                </div>
              </div>
              <div className="orders-list">
                {userData.orders.filter((order) => {
                  const query = orderSearch.trim().toLowerCase();
                  const matchesSearch = !query || String(order.checkout_id).toLowerCase().includes(query) || (order.items || []).some((item) => String(item.name || "").toLowerCase().includes(query));
                  const status = String(order.payment_status || order.status || "").toLowerCase();
                  const matchesStatus = orderFilter === "all" || (orderFilter === "pending" ? ["pending", "awaiting_payment", "awaiting payment"].includes(status) : status === orderFilter);
                  return matchesSearch && matchesStatus;
                }).map(order => {
                  const items = order.items || [];
                  return (
                    <div key={order.checkout_id} className="order-card">
                      <div className="order-card-header">
                        <div>
                          <strong>{t("dashboard.order_number", { id: order.checkout_id })}</strong>
                          <div className="order-date">{formatDate(order.created_at)}</div>
                        </div>
                        <span className={`status-badge ${order.payment_status || order.status}`}>
                          {formatPaymentStatus(order.payment_status || order.status)}
                        </span>
                      </div>

                      <div className="order-card-body">
                        <div className="order-items">
                          <strong>{t("dashboard.items")}:</strong>
                          {items.map((item, idx) => (
                            <div key={idx} className="order-item">
                              <img className="dashboard-order-product-image" src={item.image_url || ProductImageFallback} alt={item.name || t("common.unknown")} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = ProductImageFallback; }} />
                              <span className="dashboard-order-product-copy"><strong>{item.name || t("common.unknown")}</strong><small>{[item.color, item.size].filter(Boolean).join(" · ")}{item.color || item.size ? " · " : ""}× {item.quantity}</small></span>
                              <strong className="dashboard-order-product-price">{formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 1))}</strong>
                            </div>
                          ))}
                        </div>

                        <div className="order-info-grid">
                          <div className="info-item">
                            <div className="label">{t("dashboard.delivery_status")}</div>
                            <div className="value">
                              <span className={`delivery-badge ${order.delivery_status}`}>
                                {order.delivery_status ? t(`orders.delivery_${order.delivery_status}`, { defaultValue: order.delivery_status }) : t("orders.delivery_pending")}
                              </span>
                            </div>
                          </div>

                          <div className="info-item">
                            <div className="label">{t("dashboard.shipping_method")}</div>
                            <div className="value">{order["method of shipping"] || t("dashboard.standard_shipping")}</div>
                          </div>

                          <div className="info-item">
                            <div className="label">{t("dashboard.delivery_address")}</div>
                            <div className="value">{order.address}</div>
                          </div>

                          {order.tracking_link && (
                            <div className="info-item">
                                <div className="label">{t("dashboard.track_package")}</div>
                              <div className="value">
                                <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" className="tracking-link">
                                  {t("dashboard.track_package")}
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="order-card-footer">
                        <div className="order-total-display">
                          {t("dashboard.total")}: <strong>{formatCurrency(order.total)}</strong>
                        </div>
                        <button type="button" className="dashboard-invoice-download" onClick={() => downloadInvoice(order)}><Download size={15} />{t("dashboard.download_invoice")}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {userData.orders.filter((order) => {
                const query = orderSearch.trim().toLowerCase();
                const matchesSearch = !query || String(order.checkout_id).toLowerCase().includes(query) || (order.items || []).some((item) => String(item.name || "").toLowerCase().includes(query));
                const status = String(order.payment_status || order.status || "").toLowerCase();
                const matchesStatus = orderFilter === "all" || (orderFilter === "pending" ? ["pending", "awaiting_payment", "awaiting payment"].includes(status) : status === orderFilter);
                return matchesSearch && matchesStatus;
              }).length === 0 && <div className="dashboard-no-matches"><Search size={20} /><p>{t("dashboard.no_matching_orders")}</p><button type="button" onClick={() => { setOrderSearch(""); setOrderFilter("all"); }}>{t("dashboard.clear_order_filters")}</button></div>}
              </>
            )}
          </div>
        )}

        {/* Cart Section */}
        {activeSection === "cart" && (
          <div className="section-content">
            <h1>{t("dashboard.cart")}</h1>

            {userData.cart.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><ShoppingBag size={48} /></div>
                <h3>{t("dashboard.cart_empty")}</h3>
                <p>{t("dashboard.cart_empty_copy")}</p>
                <button onClick={() => navigate("/shop")}>{t("dashboard.browse_products")}</button>
              </div>
            ) : (
              <div className="cart-list">
                {userData.cart.map(item => {
                  const product = item.product_id && typeof item.product_id === "object" ? item.product_id : item.products;
                  const image = product?.product_images?.find((productImage) => productImage.is_primary)?.image_url || product?.product_images?.[0]?.image_url;
                  const selections = item.selected_options || item.selected_option || {};
                  return <div key={item.id} className="cart-item">
                    <div className="cart-item-image-wrap">
                      {image ? <img className="cart-item-image" src={image} alt={product?.name || ""} /> : <div className="cart-item-image cart-item-image-placeholder"><Package size={22} /></div>}
                    </div>
                    <div className="cart-item-info">
                      <h3>{product?.name || t("common.unknown")}</h3>
                      <p className="cart-item-price">{formatCurrency(product?.price || 0)}</p>
                      {(selections.color || item.color) && <p>{t("dashboard.color")}: {selections.color || item.color}</p>}
                      {(selections.size || item.size) && <p>{t("dashboard.size")}: {selections.size || item.size}</p>}
                      <p className="cart-item-stock">
                        {Number(product?.stock_quantity) > 0 || product?.in_Stock === true || product?.in_Stock === "true" ? `✓ ${t("dashboard.in_stock")}` : `× ${t("dashboard.out_of_stock")}`}
                      </p>
                    </div>

                    <div className="cart-item-actions">
                      <div className="quantity-control">
                        <button onClick={() => handleUpdateCartQuantity(item.id, item.quantity - 1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => handleUpdateCartQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <button className="btn-remove" onClick={() => handleRemoveFromCart(item.id)}>
                        {t("dashboard.remove")}
                      </button>
                    </div>

                    <div className="cart-item-total">
                      {formatCurrency((product?.price || 0) * item.quantity)}
                    </div>
                  </div>
                })}

                <div className="cart-summary">
                  <h3>{t("dashboard.cart_summary")}</h3>
                  <div className="summary-row">
                    <span>{t("dashboard.subtotal")}:</span>
                    <strong>
                      {formatCurrency(
                        userData.cart.reduce((sum, item) => 
                          sum + ((typeof item.product_id === "object" ? item.product_id?.price : item.products?.price) || 0) * item.quantity, 0
                        )
                      )}
                    </strong>
                  </div>
                  <button className="btn-checkout" onClick={() => navigate("/checkout")}>
                    {t("dashboard.checkout")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews Section */}
        {activeSection === "reviews" && (
          <div className="section-content">
            <h1>{t("dashboard.reviews")}</h1>

            {userData.reviews.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Star size={32} strokeWidth={1.7} aria-hidden="true" /></div>
                <h3>{t("dashboard.no_reviews")}</h3>
                <p>{t("dashboard.reviews_empty_copy")}</p>
              </div>
            ) : (
              <div className="reviews-list">
                {userData.reviews.map(review => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <h3>{review.product_id?.name || t("common.unknown")}</h3>
                      <div className="review-rating" aria-label={t("dashboard.rating_out_of_five", { rating: review.rating })}>
                        {Array.from({ length: Math.max(0, Math.min(5, Number(review.rating) || 0)) }, (_, index) => <Star key={index} size={15} fill="currentColor" aria-hidden="true" />)}
                      </div>
                    </div>
                    {review.title && <h4>{review.title}</h4>}
                    <p className="review-comment">{review.body || review.comment}</p>
                    <div className="review-date">{formatDate(review.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cart History Section */}
        {activeSection === "history" && (
          <div className="section-content">
            <h1>{t("dashboard.cart_history")}</h1>

            {userData.cartHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><FileText size={48} /></div>
                <h3>{t("dashboard.no_history")}</h3>
                <p>{t("dashboard.history_empty_copy")}</p>
              </div>
            ) : (
              <div className="history-list">
                {userData.cartHistory.map(history => (
                  <div key={history.history_id} className="history-item">
                    <div className="history-icon">
                      {history.action === "INSERT" ? <Plus size={20} /> : <Minus size={20} />}
                    </div>
                    <div className="history-info">
                      <strong>{history.action === "INSERT" ? t("dashboard.added_to_cart") : t("dashboard.removed_from_cart")}</strong>
                      <p>{productNames[history.product_id] || history.product_id} | {t("dashboard.quantity")}: {history.quantity}</p>
                      <span className="history-date">{formatDate(history.action_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Section */}
        {activeSection === "settings" && (
          <div className="section-content">
            <h1>{t("dashboard.account_settings")}</h1>

            <div className="settings-section">
              <h2>{t("dashboard.profile_info")}</h2>
              <div className="settings-form">
                <ProfileImageUploader
                  userId={user?.id}
                  name={userData.profile?.display_name || user?.email}
                  avatarPath={userData.profile?.avatar_path}
                  onChange={(avatar_path) => setUserData((current) => ({ ...current, profile: { ...current.profile, avatar_path } }))}
                />
                <div className="form-group">
                  <label>{t("dashboard.full_name")}</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>{t("dashboard.email")}</label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="disabled-input"
                  />
                  <small>{t("dashboard.email_locked")}</small>
                </div>

                <div className="form-group">
                  <label>{t("dashboard.phone")}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>{t("dashboard.language")}</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  >
                    <option value="en">{t("dashboard.english")}</option>
                    <option value="fr">{t("dashboard.french")}</option>
                    <option value="zh">{t("dashboard.chinese")}</option>
                  </select>
                </div>

                <button className="btn-save" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? t("dashboard.saving") : t("dashboard.save_changes")}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h2>{t("dashboard.change_password")}</h2>
              <div className="settings-form">
                <div className="form-group">
                  <label>{t("dashboard.new_password")}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("dashboard.password_placeholder")}
                  />
                </div>

                <div className="form-group">
                  <label>{t("dashboard.confirm_password")}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("dashboard.confirm_password_placeholder")}
                  />
                </div>

                <button className="btn-save" onClick={handleChangePassword} disabled={saving}>
                  {saving ? t("dashboard.changing_password") : t("dashboard.update_password")}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h2>{t("cookie.manage")}</h2>
              <p className="dashboard-cookie-copy">{t("cookie.message")}</p>
              <button type="button" className="dashboard-cookie-manage" onClick={() => window.dispatchEvent(new Event("tsogo:open-cookie-settings"))}>
                <Cookie size={17} />{t("cookie.manage")}
              </button>
            </div>

            <div className="settings-section">
              <h2>{t("dashboard.account_details")}</h2>
              <div className="account-info">
                <div className="info-row">
                  <span className="label">{t("dashboard.user_id")}:</span>
                  <span className="value code">{user?.id}</span>
                </div>
                <div className="info-row">
                  <span className="label">{t("dashboard.member_since")}:</span>
                  <span className="value">{formatDate(userData.profile?.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
