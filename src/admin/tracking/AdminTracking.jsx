import { showSiteModal as alert } from "../../utils/siteModal";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import { sendOrderStatusNotificationDetailed } from "../../utils/sendOrderStatusNotification";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ScanLine,
  Camera,
  X,
  Truck,
  TruckIcon,
  FileText,
  ClipboardList,
  Download,
} from "lucide-react";
import { code39Svg, normalizeParcelCode } from "../../utils/code39";
import { jsPDF } from "jspdf";
import { exportCsv } from "../utils/exportCsv";
import { useSiteSettings } from "../../context/SiteSettingsContext";
import brandLogo from "../../assets/brand-logo.png";
import "./AdminTracking.css";
import { BrowserMultiFormatReader } from "@zxing/browser";

const DELIVERY_STEPS = [
  { id: "pending", label: "Pending", icon: Clock3 },
  { id: "processing", label: "Processing", icon: Package },
  { id: "in_transit", label: "In transit", icon: Truck },
  { id: "out_for_delivery", label: "Out for delivery", icon: TruckIcon },
  { id: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const DELIVERY_STAGE_IDS = DELIVERY_STEPS.map((step) => step.id);
const isDeliveryStage = (status) => DELIVERY_STAGE_IDS.includes(status);
const statusLabel = (status) =>
  DELIVERY_STEPS.find((step) => step.id === status)?.label ||
  String(status || "unknown").replaceAll("_", " ");

const normalizeStatus = (status) =>
  status === "shipped" ? "in_transit" : status || "pending";
// The PDF helper strips every non-ASCII character, so prices must be formatted
// with a locale that only produces ASCII separators (fr-CM uses U+202F).
const money = (value) => `${Number(value || 0).toLocaleString("en-US")} XAF`;
const displayDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Not set";

export default function AdminTracking() {
  const { siteName, siteEmail, sitePhone } = useSiteSettings();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanKind, setScanKind] = useState("info");
  const scanEmailErrorRef = useRef("");
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const shipmentsRef = useRef(shipments);
  const handleScanRef = useRef(null);
  const scanBusyRef = useRef(false);
  const lastScanRef = useRef({ value: "", time: 0 });
  const requestIdRef = useRef(0);
  const timersRef = useRef(new Set());

  // Timeouts must be cleared on unmount so they never touch state afterwards.
  const scheduleTimeout = useCallback((callback, delay) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      callback();
    }, delay);
    timersRef.current.add(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current.clear();
    },
    [],
  );

  // Kept in an effect (not during render) so the scanner always works with the
  // latest committed shipment list.
  useEffect(() => {
    shipmentsRef.current = shipments;
  }, [shipments]);

  const fetchShipments = useCallback(async ({ silent = false } = {}) => {
    // Overlapping refreshes (manual button + realtime channel) must not let an
    // older response overwrite a newer one.
    const requestId = ++requestIdRef.current;
    const isLatest = () => requestId === requestIdRef.current;
    if (!silent) {
      setLoading(true);
      setLoadError("");
    }
    try {
      const { data: shipmentRows, error: shipmentError } = await supabase
        .from("shipments")
        .select(
          "id,order_id,carrier,tracking_number,tracking_url,status,estimated_delivery,created_at,updated_at",
        )
        .order("created_at", { ascending: false });
      if (shipmentError) throw shipmentError;
      if (!isLatest()) return;

      const rows = shipmentRows || [];
      const orderIds = [
        ...new Set(rows.map((row) => row.order_id).filter(Boolean)),
      ];
      const shipmentIds = rows.map((row) => row.id).filter(Boolean);
      const [ordersResult, checkoutsResult, eventsResult] = await Promise.all([
        orderIds.length
          ? supabase
              .from("orders")
              .select(
                "id,customer_name,customer_email,customer_phone,grand_total,shipping_address",
              )
              .in("id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("checkouts")
              .select(
                "checkout_id,order_id,user_id,user_name,email,phone_number,address,total,amount_due,service_fee,shipping_payment_mode,shipping_due_on_delivery,payment_method,delivery_status,payment_status,items,tracking_link,created_at",
              )
              .in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        shipmentIds.length
          ? supabase
              .from("shipment_events")
              .select("id,shipment_id,status,location,message,occurred_at")
              .in("shipment_id", shipmentIds)
              .order("occurred_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (checkoutsResult.error) throw checkoutsResult.error;
      if (!isLatest()) return;
      if (eventsResult.error)
        console.warn(
          "Could not load shipment event history:",
          eventsResult.error,
        );

      const checkoutRows = checkoutsResult.data || [];
      const customerIds = [
        ...new Set(
          checkoutRows.map((checkout) => checkout.user_id).filter(Boolean),
        ),
      ];
      const profileResult = customerIds.length
        ? await supabase
            .from("profiles")
            .select("user_id,avatar_path")
            .in("user_id", customerIds)
        : { data: [], error: null };
      if (profileResult.error)
        console.warn(
          "Could not load customer profile photos for invoices:",
          profileResult.error,
        );
      const profileByUserId = Object.fromEntries(
        (profileResult.data || []).map((profile) => [profile.user_id, profile]),
      );
      // Product names, descriptions and images are only needed for printed
      // documents, so they are loaded lazily by enrichItemsForDocument()
      // instead of on every list refresh.
      if (!isLatest()) return;

      const orderById = Object.fromEntries(
        (ordersResult.data || []).map((order) => [order.id, order]),
      );
      const checkoutByOrderId = Object.fromEntries(
        checkoutRows.map((checkout) => [checkout.order_id, checkout]),
      );
      const latestEventByShipment = {};
      for (const event of eventsResult.data || []) {
        if (!latestEventByShipment[event.shipment_id])
          latestEventByShipment[event.shipment_id] = event;
      }

      setShipments(
        rows.map((shipment) => {
          const order = orderById[shipment.order_id] || {};
          const checkout = checkoutByOrderId[shipment.order_id] || {};
          const latestEvent = latestEventByShipment[shipment.id] || {};
          return {
            ...shipment,
            checkout_id: checkout.checkout_id,
            customer_avatar_path:
              profileByUserId[checkout.user_id]?.avatar_path || "",
            customer_name:
              checkout.user_name || order.customer_name || "Customer",
            customer_email: checkout.email || order.customer_email || "",
            customer_phone: checkout.phone_number || order.customer_phone || "",
            address: checkout.address || order.shipping_address?.address || "",
            total: checkout.total ?? order.grand_total ?? 0,
            amount_due:
              checkout.amount_due ?? checkout.total ?? order.grand_total ?? 0,
            service_fee: checkout.service_fee ?? 0,
            shipping_payment_mode: checkout.shipping_payment_mode || "online",
            shipping_due_on_delivery: checkout.shipping_due_on_delivery ?? 0,
            payment_method: checkout.payment_method || "",
            payment_status: checkout.payment_status || "pending",
            email: checkout.email || order.customer_email || "",
            items: (Array.isArray(checkout.items)
              ? checkout.items
              : typeof checkout.items === "string"
                ? (() => {
                    try {
                      const parsed = JSON.parse(checkout.items);
                      return Array.isArray(parsed) ? parsed : [];
                    } catch {
                      return [];
                    }
                  })()
                : []
            ).map((item) => ({
              ...item,
              name: item?.name || "Product",
            })),
            created_at: checkout.created_at || shipment.created_at,
            delivery_status: normalizeStatus(
              checkout.delivery_status || shipment.status,
            ),
            tracking_url:
              checkout.tracking_link ||
              shipment.tracking_url ||
              `/track/${shipment.tracking_number}`,
            current_location:
              latestEvent.location || shipment.carrier || "Tsogo BIS",
            latest_event: latestEvent,
          };
        }),
      );
    } catch (error) {
      console.error("Error loading shipments:", error);
      // A failed background refresh must never hide data that is already on
      // screen; only an explicit (non-silent) load reports the error.
      if (isLatest() && !silent) {
        setLoadError(error.message || "Shipment data could not be loaded.");
      }
    } finally {
      if (!silent && isLatest()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Keep the admin list in sync with changes made in another dashboard or by
  // a scanner session. Updates touch several tables, so coalesce them into one
  // refresh after the transaction has committed.
  useEffect(() => {
    let refreshTimer;
    // The mount effect already loads the list, so the first SUBSCRIBED event
    // only records the connection; later ones (reconnects) resync the data.
    let firstSubscription = true;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(
        () => fetchShipments({ silent: true }),
        120,
      );
    };
    const channel = supabase
      .channel("admin-delivery-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkouts" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shipments" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shipment_events" },
        refresh,
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (firstSubscription) {
          firstSubscription = false;
          return;
        }
        refresh();
      });

    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchShipments]);

  useEffect(() => {
    if (!scannerOpen) return;

    let stopped = false;
    let activeControls;
    // Captured once so the cleanup always frees the element this effect used.
    const videoElement = videoRef.current;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Camera access is unavailable. Please use HTTPS and a supported browser.",
          );
        }

        if (!videoElement) {
          throw new Error("Camera preview is unavailable.");
        }

        const codeReader = new BrowserMultiFormatReader();

        activeControls = await codeReader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
            },
          },
         videoElement,
(result, error) => {
  if (stopped) return;

  // No barcode detected in this frame.
  if (!result) {
    if (error && error.name !== "NotFoundException") {
      console.debug("ZXing scan attempt:", error);
    }
    return;
  }

  // Barcode successfully decoded.
  const value = result.getText();

  console.log("BARCODE DETECTED:", {
    value,
    format: result.getBarcodeFormat(),
  });

  const normalized = normalizeParcelCode(value);

  if (!normalized) {
    setScanKind("error");
    setScanMessage(
      `Barcode detected, but its value could not be processed: ${value}`
    );
    return;
  }

  const now = Date.now();
  const sameCode = normalized === lastScanRef.current.value;
  const withinCooldown = now - lastScanRef.current.time < 3000;

  if (sameCode && withinCooldown) return;

  lastScanRef.current = { value: normalized, time: now };

  setScanKind("info");
  setScanMessage(`Barcode detected: ${normalized}. Processing...`);

  handleScanRef.current?.(value);
},
        );

        if (stopped) {
          activeControls?.stop();
        }
      } catch (error) {
        if (stopped) return;

        console.error("Barcode scanner error:", error);

        const messages = {
          NotAllowedError:
            "Camera permission denied. Please allow camera access in your browser settings.",
          NotFoundError: "No camera was found on this device.",
          NotReadableError:
            "The camera may already be in use by another application.",
          OverconstrainedError:
            "The requested camera configuration is unavailable.",
        };

        setCameraError(
          messages[error.name] ||
            error.message ||
            "Unable to start the barcode scanner. Please enter the tracking code manually.",
        );
      }
    };

    startCamera();

    return () => {
      stopped = true;

      // IScannerControls.stop() is the only supported way to release the
      // camera in @zxing/browser (the reader has no reset() method).
      activeControls?.stop();

      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [scannerOpen]);

  // Escape closes the scanner and the page behind it must not scroll.
  useEffect(() => {
    if (!scannerOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setScannerOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [scannerOpen]);

  async function updateStatus(shipment, status, details = {}, quiet = false) {
    const checkoutId = shipment.checkout_id;
    if (!checkoutId) {
      if (!quiet)
        alert(
          "This shipment is not linked to a checkout, so its status cannot be updated here.",
        );
      return false;
    }
    if (!isDeliveryStage(status)) {
      if (!quiet)
        alert(
          "Choose a valid delivery stage before saving this shipment. The current status is not one the shipment workflow supports.",
        );
      return false;
    }
    setSavingId(shipment.id);
    try {
      const { error } = await supabase.rpc("admin_update_shipment_status", {
        p_checkout_id: checkoutId,
        p_status: status,
        p_location: Object.prototype.hasOwnProperty.call(details, "location")
          ? details.location || null
          : shipment.current_location,
        p_estimated_delivery: Object.prototype.hasOwnProperty.call(
          details,
          "estimatedDelivery",
        )
          ? details.estimatedDelivery || null
          : shipment.estimated_delivery || null,
      });
      if (error) {
        if (!quiet) alert(`Could not update shipment status: ${error.message}`);
        return false;
      }

      setShipments((current) =>
        current.map((row) =>
          row.id === shipment.id
            ? {
                ...row,
                status,
                delivery_status: status,
                current_location:
                  Object.prototype.hasOwnProperty.call(details, "location") &&
                  details.location
                    ? details.location
                    : row.current_location || "Tsogo BIS",
                estimated_delivery: Object.prototype.hasOwnProperty.call(
                  details,
                  "estimatedDelivery",
                )
                  ? details.estimatedDelivery || null
                  : row.estimated_delivery,
              }
            : row,
        ),
      );
      await fetchShipments({ silent: true });

      const statusChanged = normalizeStatus(shipment.delivery_status) !== status;
      if (!statusChanged) return true;

      const result = await sendOrderStatusNotificationDetailed(
        checkoutId,
        "delivery",
        status,
      );
      const emailError = result.error;
      if (quiet) scanEmailErrorRef.current = emailError || "";
      if (emailError) {
        console.error("Delivery status email failed:", emailError);
        if (!quiet)
          alert(
            `Shipment status updated, but the customer email failed: ${emailError}`,
          );
      } else if (!quiet) {
        alert(
          result.sent
            ? "Shipment status updated and customer notified by email."
            : "Shipment status updated. The customer was already notified for this stage, so no new email was sent.",
        );
      }
      return true;
    } catch (error) {
      console.error("Shipment status update failed:", error);
      if (!quiet)
        alert(
          `Could not update shipment status: ${error?.message || "unexpected error"}. Please try again.`,
        );
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function handleParcelScan(rawValue) {
    const code = normalizeParcelCode(rawValue);
    if (!code) {
      setScanKind("error");
      setScanMessage(
        "That code could not be read. Type the tracking number or order code instead.",
      );
      return;
    }
    if (scanBusyRef.current) {
      setScanKind("info");
      setScanMessage("Saving the previous scan. Try again in a moment.");
      return;
    }
    scanBusyRef.current = true;
    // Replace (not append to) the previous value: USB wedge scanners type into
    // whatever is already in the field.
    setScanCode(code);
    try {
      // TSO barcodes were printed by older labels. New labels use the parcel's
      // TSB tracking number, which also works with the public tracking page.
      const orderMatch = code.match(/^TSO-?(\d+)$/);
      const shipment = shipmentsRef.current.find(
        (row) =>
          normalizeParcelCode(row.tracking_number) === code ||
          (orderMatch && String(row.checkout_id) === orderMatch[1]),
      );
      if (!shipment) {
        setScanKind("error");
        setScanMessage(
          `No shipment found for “${code}”. Check that the parcel has a tracking record.`,
        );
        return;
      }
      const currentIndex = DELIVERY_STEPS.findIndex(
        (step) => step.id === normalizeStatus(shipment.delivery_status),
      );
      if (currentIndex >= DELIVERY_STEPS.length - 1) {
        setScanKind("success");
        setScanMessage(`Order #${shipment.checkout_id} is already delivered.`);
        return;
      }
      const next = DELIVERY_STEPS[Math.max(0, currentIndex) + 1];
      scanEmailErrorRef.current = "";
      const updated = await updateStatus(shipment, next.id, {}, true);
      setScanKind(updated ? "success" : "error");
      setScanMessage(
        updated
          ? scanEmailErrorRef.current
            ? `Order #${shipment.checkout_id} moved to ${next.label}, but the customer email failed: ${scanEmailErrorRef.current}`
            : `Order #${shipment.checkout_id} moved to ${next.label}.`
          : `Could not update order #${shipment.checkout_id}. Check the order and try again.`,
      );
      if (updated) setScanCode("");
    } catch (error) {
      console.error("Parcel scan update failed:", error);
      setScanKind("error");
      setScanMessage(
        "The shipment could not be updated. Check your connection and try again.",
      );
    } finally {
      // The camera callback already ignores repeats of the same label, so the
      // next parcel can be scanned immediately.
      scanBusyRef.current = false;
    }
  }
  useEffect(() => {
    handleScanRef.current = handleParcelScan;
  });

  // Delivery details are edited as a per-shipment draft so a live refresh
  // cannot wipe what the admin is typing.
  const draftFor = useCallback(
    (shipment) =>
      drafts[shipment.id] || {
        location: shipment.current_location || "",
        estimatedDelivery: shipment.estimated_delivery?.slice(0, 10) || "",
      },
    [drafts],
  );

  function updateDraft(shipment, key, value) {
    setDrafts((current) => ({
      ...current,
      [shipment.id]: {
        ...(current[shipment.id] || {
          location: shipment.current_location || "",
          estimatedDelivery: shipment.estimated_delivery?.slice(0, 10) || "",
        }),
        [key]: value,
      },
    }));
  }

  function clearDraft(shipmentId) {
    setDrafts((current) => {
      if (!(shipmentId in current)) return current;
      const next = { ...current };
      delete next[shipmentId];
      return next;
    });
  }

  function submitManualScan(event) {
    event.preventDefault();
    if (scanCode.trim()) handleParcelScan(scanCode.trim());
  }

  async function saveShipmentDetails(event, shipment) {
    event.preventDefault();
    const draft = draftFor(shipment);
    const saved = await updateStatus(
      shipment,
      normalizeStatus(shipment.delivery_status),
      {
        location: draft.location,
        estimatedDelivery: draft.estimatedDelivery,
      },
    );
    if (saved) clearDraft(shipment.id);
  }

  async function copyTrackingLink(shipment) {
    try {
      const target =
        shipment.tracking_url ||
        (shipment.tracking_number ? `/track/${shipment.tracking_number}` : "/");
      const url = new URL(target, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopiedId(shipment.id);
      scheduleTimeout(() => setCopiedId(null), 1800);
    } catch {
      alert(
        "Could not copy the tracking link. Please copy it from the customer tracking page.",
      );
    }
  }

  async function getBrandLogoDataUrl() {
    try {
      const response = await fetch(brandLogo);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return brandLogo;
    }
  }

  const pdfText = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[–—·]/g, "-")
      .replace(/[^\x20-\x7E]/g, "?");

  async function productImagePng(url) {
    if (!url) return null;
    let objectUrl;
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) return null;
      objectUrl = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight,
      );
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(
        image,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  async function barcodePng(value) {
    const svg = code39Svg(value, { height: 100, module: 3 });
    if (!svg) return null;
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1200, image.naturalWidth * 2);
      canvas.height = 240;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 20, canvas.width, canvas.height - 40);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Printed documents need product descriptions and photos, which the shipment
  // list does not carry. They are fetched on demand instead of on every load.
  async function enrichItemsForDocument(rawItems) {
    const items = Array.isArray(rawItems) ? rawItems : [];
    const productIds = [
      ...new Set(
        items.map((item) => item?.product_id?.id ?? item?.product_id).filter(Boolean),
      ),
    ];
    let productsById = {};
    let imageByProductId = {};
    if (productIds.length) {
      try {
        const [productsResult, imagesResult] = await Promise.all([
          supabase.from("products").select("id,name,description").in("id", productIds),
          supabase
            .from("product_images")
            .select("product_id,image_url,is_primary")
            .in("product_id", productIds)
            .order("is_primary", { ascending: false }),
        ]);
        if (productsResult.error)
          console.warn(
            "Could not load product descriptions for the document:",
            productsResult.error,
          );
        if (imagesResult.error)
          console.warn(
            "Could not load product images for the document:",
            imagesResult.error,
          );
        productsById = Object.fromEntries(
          (productsResult.data || []).map((product) => [String(product.id), product]),
        );
        imageByProductId = (imagesResult.data || []).reduce((result, image) => {
          const productKey = String(image.product_id);
          if (!result[productKey] || image.is_primary)
            result[productKey] = image.image_url;
          return result;
        }, {});
      } catch (error) {
        console.warn("Could not load product details for the document:", error);
      }
    }
    return items.map((item) => {
      const productId = item?.product_id?.id ?? item?.product_id;
      const product = productsById[String(productId)] || {};
      return {
        ...item,
        name: item?.name || product.name || "Product",
        product_description: item?.product_description || product.description || "",
        image_url:
          item?.image_url || item?.imageUrl || imageByProductId[String(productId)] || "",
      };
    });
  }

  async function buildShipmentPdf(shipment, type) {
    const isInvoice = type === "invoice";
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pageWidth = 210;
    const orderId = shipment.checkout_id || shipment.order_id;
    const code = shipment.tracking_number || "";
    const shippingItems = Array.isArray(shipment.items) ? shipment.items : [];
    const items = await enrichItemsForDocument(shippingItems);
    const methods = [
      ...new Set(
        items
          .map(
            (item) =>
              item.shipping_method ||
              item.options?.shipping_method ||
              item.selected_options?.shipping_method,
          )
          .filter(Boolean),
      ),
    ];
    const shippingTotal = items.reduce(
      (sum, item) =>
        sum + Number(item.shipping_fee || 0) * Number(item.quantity || 1),
      0,
    );
    const shippingDueOnDelivery =
      Number(shipment.shipping_due_on_delivery) || 0;
    const serviceFee = Number(shipment.service_fee) || 0;
    const shippingPaymentMode =
      shipment.shipping_payment_mode === "arrival" ? "arrival" : "online";
    const logo = await getBrandLogoDataUrl();
    const barcode = await barcodePng(code);
    const ink = [20, 39, 65];
    const blue = [44, 65, 94];
    const muted = [91, 105, 124];
    const text = (value) => pdfText(value);
    const write = (value, x, y, size = 10, style = "normal", align) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...ink);
      doc.text(text(value), x, y, align ? { align } : undefined);
    };

    doc.setDrawColor(...ink);
    doc.setLineWidth(0.55);
    const drawPageFrame = () => doc.rect(8, 8, 194, 281);
    drawPageFrame();
    try {
      doc.addImage(logo, "PNG", 14, 12, 29, 23, undefined, "FAST");
    } catch {
      /* render the wordmark if the logo cannot be embedded */
    }
    write(siteName || "TSOGO-BIS", 48, 17, 14, "bold");
    write(`Tel: ${sitePhone || "Contact phone not configured"}`, 48, 24, 8);
    write(`Email: ${siteEmail || "Contact email not configured"}`, 48, 30, 8);
    write(`Website: ${window.location.origin}`, 48, 36, 8);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Number: ${text(orderId)}`, 196, 20, { align: "right" });
    doc.text(
      `Date: ${text(shipment.created_at ? new Date(shipment.created_at).toLocaleDateString() : new Date().toLocaleDateString())}`,
      196,
      26,
      { align: "right" },
    );
    doc.setDrawColor(170, 180, 193);
    doc.line(13, 42, 197, 42);

    if (isInvoice) {
      write("PROFORMA INVOICE", pageWidth / 2, 53, 17, "bold", "center");
      doc.setFillColor(246, 248, 251);
      doc.setDrawColor(190, 199, 211);
      doc.rect(14, 59, 182, 27, "FD");
      let customerAvatarUrl = "";
      if (shipment.customer_avatar_path) {
        const { data, error: avatarError } = await supabase.storage
          .from("profile-images")
          .createSignedUrl(shipment.customer_avatar_path, 300);
        if (avatarError)
          console.warn(
            "Could not sign the customer photo URL for the invoice:",
            avatarError,
          );
        customerAvatarUrl = data?.signedUrl || "";
      }
      const customerImage = await productImagePng(customerAvatarUrl);
      if (customerImage) {
        try {
          doc.addImage(customerImage, "PNG", 18, 64, 16, 16, undefined, "FAST");
        } catch {
          /* A customer photo is optional on invoices. */
        }
      }
      write(
        `SOLD TO: ${shipment.customer_name || "Customer"}`,
        38,
        66,
        10,
        "bold",
      );
      write(
        `Address: ${shipment.address || "Address not provided"}`,
        38,
        72,
        8,
      );
      write(
        `Tel: ${shipment.customer_phone || "Phone not provided"}`,
        38,
        78,
        8,
      );
      write(`Email: ${shipment.customer_email || ""}`, 105, 78, 8);
      if (barcode)
        doc.addImage(barcode, "PNG", 70, 89, 70, 12, undefined, "FAST");
      write(code, pageWidth / 2, 105, 8, "bold", "center");

      const columns = [8, 19, 30, 19, 43, 14, 23, 26];
      const labels = [
        "No.",
        "Image",
        "Product name",
        "Part No.",
        "Product description",
        "Qty",
        "Unit price",
        "Total",
      ];
      const startX = 14;
      let y = 112;
      const headerHeight = 12;
      const drawTableHeader = () => {
        let x = startX;
        columns.forEach((width, index) => {
          doc.setFillColor(225, 231, 239);
          doc.setDrawColor(75, 87, 103);
          doc.rect(x, y, width, headerHeight, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(...ink);
          doc.text(text(labels[index]), x + 1.5, y + 7, {
            maxWidth: width - 3,
          });
          x += width;
        });
        y += headerHeight;
      };
      drawTableHeader();
      for (const [index, item] of items.entries()) {
        const quantity = Number(item.quantity || 1);
        const price = Number(item.price ?? item.unitPrice ?? 0);
        const amount = Number(
          item.totalPrice ?? item.line_total ?? price * quantity,
        );
        const descriptionValue =
          item.product_description ||
          item.description ||
          [item.option, item.color, item.size].filter(Boolean).join(" / ") ||
          "-";
        const description =
          new DOMParser().parseFromString(String(descriptionValue), "text/html")
            .body.textContent || "-";
        const cells = [
          String(index + 1),
          "",
          item.name || "Product",
          item.sku ||
            item.part_number ||
            item.product_id?.id ||
            item.product_id ||
            "-",
          description,
          String(quantity),
          money(price),
          money(amount),
        ];
        const wrapped = cells.map((cell, i) =>
          doc.splitTextToSize(text(cell), columns[i] - (i === 1 ? 2 : 3)),
        );
        const rowHeight = Math.max(
          19,
          Math.max(...wrapped.map((lines) => lines.length)) * 3.1 + 5,
        );
        if (y + rowHeight > 263) {
          doc.addPage();
          y = 18;
          drawPageFrame();
          drawTableHeader();
        }
        let x = startX;
        columns.forEach((width, i) => {
          doc.setDrawColor(75, 87, 103);
          doc.rect(x, y, width, rowHeight);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(...ink);
          if (i !== 1)
            doc.text(wrapped[i], x + 1.5, y + 4.5, { maxWidth: width - 3 });
          x += width;
        });
        const imageData = await productImagePng(item.image_url);
        if (imageData) {
          try {
            doc.addImage(
              imageData,
              "PNG",
              startX + columns[0] + 2,
              y + (rowHeight - 14) / 2,
              14,
              14,
              undefined,
              "FAST",
            );
          } catch {
            /* Keep the invoice readable if a product image is unsupported. */
          }
        }
        y += rowHeight;
      }
      y += 5;
      // The totals block needs ~45mm; start a fresh page rather than letting it
      // run past the frame when the item table fills the current one.
      if (y + 45 > 278) {
        doc.addPage();
        y = 30;
        drawPageFrame();
      }
      if (methods.length)
        write(
          `Shipping method: ${methods.join(", ")}`,
          194,
          y,
          8,
          "normal",
          "right",
        );
      y += methods.length ? 6 : 0;
      write(
        `Shipping fee: ${money(shippingTotal)}`,
        194,
        y,
        9,
        "normal",
        "right",
      );
      if (serviceFee > 0)
        write(
          `Service fee: ${money(serviceFee)}`,
          194,
          y + 6,
          9,
          "normal",
          "right",
        );
      const paymentY = y + (serviceFee > 0 ? 12 : 6);
      write(
        `Shipping fee payment: ${shippingPaymentMode === "arrival" ? `Due on arrival (${money(shippingDueOnDelivery || shippingTotal)})` : "Included in online payment"}`,
        194,
        paymentY,
        8,
        "normal",
        "right",
      );
      const paymentStatus = String(shipment.payment_status || "").toLowerCase();
      const isPaid = ["paid", "succeeded", "successful", "completed"].includes(
        paymentStatus,
      );
      const dueNow = isPaid
        ? 0
        : Number(shipment.amount_due ?? shipment.total) || 0;
      write(
        `PAYMENT STATUS: ${isPaid ? "PAID" : "AWAITING PAYMENT"}`,
        194,
        paymentY + 7,
        9,
        "bold",
        "right",
      );
      write(
        `TOTAL DUE NOW: ${money(dueNow)}`,
        194,
        paymentY + 14,
        11,
        "bold",
        "right",
      );
    } else {
      write("RECEIVER INFORMATION", pageWidth / 2, 58, 19, "bold", "center");
      doc.setTextColor(...blue);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Please fill in the details below", pageWidth / 2, 68, {
        align: "center",
      });
      doc.setDrawColor(...ink);
      doc.line(20, 76, 190, 76);
      const fields = [
        ["Full Name:", shipment.customer_name || ""],
        ["Phone Number:", shipment.customer_phone || ""],
        ["Delivery location:", shipment.address || "Cameroon"],
        ["Shipping method:", methods.join(", ") || "Not specified"],
        [
          "Delivery fee:",
          `${money(shippingTotal)} · ${shippingPaymentMode === "arrival" ? "pay on arrival" : "paid online"}`,
        ],
      ];
      let y = 95;
      fields.forEach(([label, value]) => {
        write(label, 20, y + 7, 11);
        doc.setDrawColor(128, 141, 158);
        doc.rect(58, y - 1, 132, 14);
        write(value, 61, y + 7, 10);
        y += 22;
      });
      write(
        `Payment status: ${shipment.payment_status === "paid" ? "Paid" : "Awaiting payment"}`,
        20,
        y + 8,
        11,
      );
      if (barcode)
        doc.addImage(barcode, "PNG", 47, 235, 116, 19, undefined, "FAST");
      write(code, pageWidth / 2, 260, 10, "bold", "center");
    }

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text(
        `Page ${page} of ${pageCount} · ${text(siteName || "TSOGO-BIS")}`,
        196,
        285,
        { align: "right" },
      );
    }
    return doc;
  }

  async function printShipmentDocument(shipment, type) {
    const documentWindow = window.open(
      "",
      "_blank",
      "popup,width=900,height=900",
    );
    if (!documentWindow) {
      alert(
        "Your browser blocked the document window. Allow pop-ups for this site and try again.",
      );
      return;
    }
    try {
      const pdf = await buildShipmentPdf(shipment, type);
      pdf.autoPrint();
      const blobUrl = pdf.output("bloburl");
      documentWindow.location.href = blobUrl;
      // Give the preview time to load, then release the object URL.
      scheduleTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      documentWindow.close();
      console.error("Could not create the PDF:", error);
      alert("The PDF could not be generated. Please try again.");
    }
  }

  async function downloadShipmentDocument(shipment, type) {
    try {
      const pdf = await buildShipmentPdf(shipment, type);
      pdf.save(
        `${type === "invoice" ? "proforma-invoice" : "receiver-information"}-${shipment.checkout_id || shipment.order_id}.pdf`,
      );
    } catch (error) {
      console.error("Could not download the PDF:", error);
      alert("The PDF could not be generated. Please try again.");
    }
  }

  function downloadShipmentBarcode(shipment) {
    const code = shipment.tracking_number || "";
    if (!code) {
      alert(
        "A tracking number must be assigned before printing a parcel barcode.",
      );
      return;
    }
    const svg = code39Svg(code, { height: 100, module: 3 });
    if (!svg) {
      alert("This shipment code cannot be encoded as a Code 39 barcode.");
      return;
    }
    const blobUrl = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `barcode-${code}.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  const filteredShipments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return shipments.filter((shipment) => {
      const matchesSearch =
        !query ||
        [
          shipment.tracking_number,
          shipment.customer_name,
          shipment.customer_email,
          shipment.customer_phone,
          shipment.current_location,
          shipment.checkout_id,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );
      const matchesStatus =
        statusFilter === "all" || shipment.delivery_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchQuery, statusFilter]);

  const summary = useMemo(
    () => ({
      total: shipments.length,
      moving: shipments.filter((shipment) =>
        ["in_transit", "out_for_delivery"].includes(shipment.delivery_status),
      ).length,
      preparing: shipments.filter((shipment) =>
        ["pending", "processing"].includes(shipment.delivery_status),
      ).length,
      delivered: shipments.filter(
        (shipment) => shipment.delivery_status === "delivered",
      ).length,
    }),
    [shipments],
  );

  // Encode each tracking number once per list change instead of re-rendering
  // an SVG for every card on every keystroke in the search box.
  const barcodeByCode = useMemo(() => {
    const map = {};
    for (const shipment of shipments) {
      const code = shipment.tracking_number;
      if (code && !(code in map)) {
        map[code] = code39Svg(code, { height: 64, module: 2 });
      }
    }
    return map;
  }, [shipments]);

  // Export a stable, human-readable column set instead of the internal row
  // objects (which contain nested JSON for items and shipment events).
  const csvRows = useMemo(
    () =>
      filteredShipments.map((shipment) => ({
        tracking_number: shipment.tracking_number || "",
        order: shipment.checkout_id || shipment.order_id || "",
        customer: shipment.customer_name || "",
        email: shipment.customer_email || "",
        phone: shipment.customer_phone || "",
        address: shipment.address || "",
        delivery_status: shipment.delivery_status || "",
        payment_status: shipment.payment_status || "",
        total: shipment.total ?? "",
        amount_due: shipment.amount_due ?? "",
        carrier: shipment.carrier || "",
        current_location: shipment.current_location || "",
        estimated_delivery: shipment.estimated_delivery || "",
        updated_at: shipment.updated_at || "",
        tracking_url: shipment.tracking_url || "",
      })),
    [filteredShipments],
  );

  return (
    <main className="admin-tracking-page">
      <header className="admin-tracking-heading">
        <div>
          <span className="admin-tracking-eyebrow">FULFILMENT OPERATIONS</span>
          <h1>Shipment tracking</h1>
          <p>
            Follow every parcel from preparation to delivery and keep customer
            tracking up to date.
          </p>
        </div>
        <div className="tracking-heading-actions">
          <button
            type="button"
            className="tracking-refresh-button"
            onClick={() => exportCsv("tsogo-tracking.csv", csvRows)}
            disabled={!csvRows.length}
          >
            <Download size={15} />
            Export tracking
          </button>
          <button
            type="button"
            className="tracking-refresh-button"
            onClick={() => fetchShipments()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "tracking-spin" : ""} />
            Refresh shipments
          </button>
        </div>
      </header>

      <section className="admin-tracking-summary" aria-label="Shipment summary">
        <article>
          <span className="tracking-summary-icon">
            <Package size={18} />
          </span>
          <div>
            <strong>{summary.total}</strong>
            <small>Total shipments</small>
          </div>
        </article>
        <article>
          <span className="tracking-summary-icon is-preparing">
            <Clock3 size={18} />
          </span>
          <div>
            <strong>{summary.preparing}</strong>
            <small>Pending or processing</small>
          </div>
        </article>
        <article>
          <span className="tracking-summary-icon is-moving">
            <Truck size={18} />
          </span>
          <div>
            <strong>{summary.moving}</strong>
            <small>On the way</small>
          </div>
        </article>
        <article>
          <span className="tracking-summary-icon is-delivered">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <strong>{summary.delivered}</strong>
            <small>Delivered</small>
          </div>
        </article>
      </section>

      <section
        className="parcel-scan-panel"
        aria-labelledby="parcel-scan-title"
      >
        <div className="parcel-scan-copy">
          <span className="parcel-scan-icon">
            <ScanLine size={19} />
          </span>
          <div>
            <h2 id="parcel-scan-title">Update a parcel by scanning</h2>
            <p>
              Scan its printed order barcode to move it to the next delivery
              stage.
            </p>
          </div>
        </div>
        <form className="parcel-scan-input" onSubmit={submitManualScan}>
          <input
            value={scanCode}
            onChange={(event) => setScanCode(event.target.value)}
            aria-label="Parcel barcode"
            placeholder="Scan a label with a USB scanner…"
          />
          <button type="submit" disabled={!scanCode.trim()}>
            <ScanLine size={15} /> Update
          </button>
        </form>
        <button
          type="button"
          className="parcel-camera-button"
          onClick={() => {
            setCameraError("");
            setScanMessage("");
            setScannerOpen(true);
          }}
        >
          <Camera size={16} /> Use phone camera
        </button>
        {scanMessage && (
          <p className={`parcel-scan-message is-${scanKind}`} role="status">
            {scanMessage}
          </p>
        )}
      </section>

      <section className="admin-tracking-workspace">
        <header className="admin-tracking-toolbar">
          <div>
            <h2>Shipment queue</h2>
            <p>
              {filteredShipments.length}{" "}
              {filteredShipments.length === 1 ? "shipment" : "shipments"} shown
            </p>
          </div>
          <div className="admin-tracking-filters">
            <label className="tracking-search">
              <Search size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search customer, order, tracking number"
                aria-label="Search shipments"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter shipment status"
            >
              <option value="all">All stages</option>
              {DELIVERY_STEPS.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {loadError && (
          <div className="admin-tracking-state is-error" role="alert">
            <p>Could not load shipments. {loadError}</p>
            <button type="button" onClick={() => fetchShipments()}>
              Try again
            </button>
          </div>
        )}
        {loading ? (
          <div
            className="admin-tracking-loading"
            aria-label="Loading shipments"
          >
            {[0, 1, 2].map((item) => (
              <div key={item} />
            ))}
          </div>
        ) : !loadError && filteredShipments.length === 0 ? (
          <div className="admin-tracking-state">
            <span>
              <Truck size={22} />
            </span>
            <h3>
              {shipments.length ? "No matching shipments" : "No shipments yet"}
            </h3>
            <p>
              {shipments.length
                ? "Adjust the search or stage filter to find another parcel."
                : "Orders with a tracking record will appear here."}
            </p>
          </div>
        ) : (
          !loadError && (
            <div className="admin-shipment-list">
              {filteredShipments.map((shipment) => {
                const status = normalizeStatus(shipment.delivery_status);
                const stepIndex = DELIVERY_STEPS.findIndex(
                  (step) => step.id === status,
                );
                const progressLabel =
                  stepIndex >= 0
                    ? DELIVERY_STEPS[stepIndex].label
                    : statusLabel(status);
                const paymentStatus = String(
                  shipment.payment_status || "",
                ).toLowerCase();
                const paid = [
                  "paid",
                  "succeeded",
                  "successful",
                  "completed",
                ].includes(paymentStatus);
                const paymentLabel = paid
                  ? "Payment received"
                  : paymentStatus === "failed"
                    ? "Payment failed"
                    : paymentStatus === "expired"
                      ? "Payment expired"
                      : ["processing", "initiating"].includes(paymentStatus)
                        ? "Payment processing"
                        : "Payment pending";
                const parcelCode = shipment.tracking_number || "";
                const parcelBarcode = parcelCode
                  ? barcodeByCode[parcelCode] || ""
                  : "";
                const draft = draftFor(shipment);
                const shippingMethods = [
                  ...new Set(
                    (shipment.items || [])
                      .map(
                        (item) =>
                          item.shipping_method ||
                          item.options?.shipping_method ||
                          item.selected_options?.shipping_method,
                      )
                      .filter(Boolean),
                  ),
                ];
                return (
                  <article
                    className="admin-shipment-card"
                    key={shipment.id}
                  >
                    <header className="admin-shipment-card-head">
                      <div className="admin-shipment-code">
                        <span>TRACKING NUMBER</span>
                        <strong>{shipment.tracking_number}</strong>
                        <small>
                          Order #{shipment.checkout_id || shipment.order_id}
                        </small>
                      </div>
                      <div className="admin-shipment-head-actions">
                        <span
                          className={`admin-shipment-payment ${paid ? "is-paid" : "is-pending"}`}
                        >
                          {paymentLabel}
                        </span>
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="shipment-open-link"
                        >
                          <ExternalLink size={14} />
                          Customer view
                        </a>
                      </div>
                    </header>

                    <div className="admin-shipment-details">
                      <div>
                        <span>CUSTOMER</span>
                        <strong>{shipment.customer_name}</strong>
                        {shipment.customer_email && (
                          <small>{shipment.customer_email}</small>
                        )}
                        {shipment.customer_phone && (
                          <small>{shipment.customer_phone}</small>
                        )}
                      </div>
                      <div>
                        <span>ORDER VALUE</span>
                        <strong>{money(shipment.total)}</strong>
                        <small>
                          {paid ? "Paid" : "Unpaid"} ·{" "}
                          {shipment.carrier || "Tsogo BIS"}
                        </small>
                      </div>
                      <div>
                        <span>CURRENT LOCATION</span>
                        <strong>
                          <MapPin size={14} />
                          {shipment.current_location}
                        </strong>
                        <small>
                          {shipment.latest_event?.message ||
                            "Awaiting next shipment update"}
                        </small>
                      </div>
                      <div>
                        <span>ESTIMATED DELIVERY</span>
                        <strong>
                          <CalendarDays size={14} />
                          {displayDate(shipment.estimated_delivery)}
                        </strong>
                        <small>
                          Updated {displayDate(shipment.updated_at)}
                        </small>
                      </div>
                    </div>

                    <div
                      className="admin-shipment-progress"
                      aria-label={`Delivery progress: ${progressLabel}`}
                    >
                      {DELIVERY_STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const state =
                          index < stepIndex
                            ? "is-complete"
                            : index === stepIndex
                              ? "is-current"
                              : "";
                        return (
                          <div
                            className={`admin-shipment-step ${state}`}
                            key={step.id}
                          >
                            <span className="admin-shipment-step-icon">
                              {index < stepIndex ? (
                                <Check size={14} />
                              ) : (
                                <Icon size={14} />
                              )}
                            </span>
                            <span>{step.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <section
                      className="shipment-documents"
                      aria-label={`Documents for order ${shipment.checkout_id || shipment.order_id}`}
                    >
                      <div className="shipment-barcode-block">
                        <span>PARCEL BARCODE</span>
                        {parcelBarcode ? (
                          <div
                            className="shipment-inline-barcode"
                            role="img"
                            aria-label={`Barcode for ${parcelCode}`}
                            dangerouslySetInnerHTML={{ __html: parcelBarcode }}
                          />
                        ) : (
                          <p>Tracking number is not assigned yet.</p>
                        )}
                        {parcelCode && <strong>{parcelCode}</strong>}
                      </div>
                      <div className="shipment-shipping-summary">
                        <span>SHIPPING DETAILS</span>
                        <strong>{shipment.customer_name}</strong>
                        <small>
                          {shipment.address || "Address not provided"}
                        </small>
                        <small>
                          {shipment.customer_phone || "Phone not provided"}
                        </small>
                        <small>
                          Method:{" "}
                          {shippingMethods.join(", ") || "Not specified"}
                        </small>
                      </div>
                      <div className="shipment-document-actions">
                        <button
                          type="button"
                          onClick={() =>
                            printShipmentDocument(shipment, "invoice")
                          }
                        >
                          <FileText size={15} />
                          Print invoice
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadShipmentDocument(shipment, "invoice")
                          }
                        >
                          <Download size={15} />
                          Download invoice
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            printShipmentDocument(shipment, "shipping")
                          }
                        >
                          <ClipboardList size={15} />
                          Print receiver sheet
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadShipmentDocument(shipment, "shipping")
                          }
                        >
                          <Download size={15} />
                          Download receiver sheet
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadShipmentBarcode(shipment)}
                        >
                          <Download size={15} />
                          Download barcode SVG
                        </button>
                      </div>
                    </section>

                    <form
                      className="admin-shipment-actions"
                      onSubmit={(event) => saveShipmentDetails(event, shipment)}
                    >
                      <label>
                        <span>Delivery stage</span>
                        <select
                          value={status}
                          disabled={savingId === shipment.id}
                          onChange={(event) =>
                            updateStatus(shipment, event.target.value)
                          }
                        >
                          {!isDeliveryStage(status) && (
                            <option value={status} disabled>
                              {statusLabel(status)} — choose a new stage
                            </option>
                          )}
                          {DELIVERY_STEPS.map((step) => (
                            <option key={step.id} value={step.id}>
                              {step.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="shipment-location-field">
                        <span>Current location</span>
                        <input
                          name="location"
                          value={draft.location}
                          onChange={(event) =>
                            updateDraft(
                              shipment,
                              "location",
                              event.target.value,
                            )
                          }
                          placeholder="e.g. Douala sorting centre"
                          disabled={savingId === shipment.id}
                        />
                      </label>
                      <label>
                        <span>Estimated delivery</span>
                        <input
                          name="estimatedDelivery"
                          type="date"
                          value={draft.estimatedDelivery}
                          onChange={(event) =>
                            updateDraft(
                              shipment,
                              "estimatedDelivery",
                              event.target.value,
                            )
                          }
                          disabled={savingId === shipment.id}
                        />
                      </label>
                      <button
                        type="submit"
                        className="shipment-save-details"
                        disabled={savingId === shipment.id}
                      >
                        {savingId === shipment.id ? "Saving…" : "Save details"}
                      </button>
                      <button
                        type="button"
                        className="shipment-copy-link"
                        onClick={() => copyTrackingLink(shipment)}
                      >
                        {copiedId === shipment.id ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}
                        {copiedId === shipment.id
                          ? "Link copied"
                          : "Copy tracking link"}
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          )
        )}
      </section>

      {scannerOpen && (
        <div
          className="parcel-scanner-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setScannerOpen(false);
          }}
        >
          <section
            className="parcel-scanner-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="parcel-scanner-title"
          >
            <header>
              <div>
                <span className="admin-tracking-eyebrow">PARCEL SCANNER</span>
                <h2 id="parcel-scanner-title">Scan an order label</h2>
              </div>
              <button
                type="button"
                aria-label="Close scanner"
                autoFocus
                onClick={() => setScannerOpen(false)}
              >
                <X size={19} />
              </button>
            </header>
            <div className="parcel-camera-frame">
              <video
                ref={videoRef}
                muted
                playsInline
                aria-label="Parcel barcode camera view"
              />
              <span className="parcel-camera-target" />
            </div>
            <p className="parcel-camera-help">
              Hold the order barcode inside the frame. Each successful scan
              advances one stage.
            </p>
            {cameraError && (
              <p className="parcel-camera-error" role="status">
                {cameraError}
              </p>
            )}
            {scanMessage && (
              <p className={`parcel-scan-message is-${scanKind}`} role="status">
                {scanMessage}
              </p>
            )}
            <form
              className="parcel-scan-input is-dialog"
              onSubmit={submitManualScan}
            >
              <input
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                aria-label="Enter or scan parcel code"
                placeholder="Or scan/type the parcel code"
              />
              <button type="submit" disabled={!scanCode.trim()}>
                Update
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
