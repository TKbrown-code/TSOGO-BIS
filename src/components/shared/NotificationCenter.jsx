import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Circle, LoaderCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useTranslation } from "react-i18next";
import "../../styles/notification-center.css";

export default function NotificationCenter({ userId, audience = "customer", onOpen }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const unreadCount = items.reduce((count, item) => count + (item.read_at ? 0 : 1), 0);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setError(false);
    const { data, error: loadError } = await supabase
      .from("notifications")
      .select("id,user_id,type,entity_id,payload,created_at,read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (loadError) {
      console.warn("Could not load dashboard notifications:", loadError);
      setError(true);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    const refresh = async () => { if (active) await loadNotifications(); };
    refresh();
    const channel = supabase
      .channel(`dashboard-notifications:${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT" && payload.new) {
          setItems((current) => [payload.new, ...current.filter((item) => item.id !== payload.new.id)].slice(0, 30));
        } else if (payload.eventType === "UPDATE" && payload.new) {
          setItems((current) => current.map((item) => item.id === payload.new.id ? payload.new : item));
        } else {
          refresh();
        }
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [userId, loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const markRead = async (item) => {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      const { error: updateError } = await supabase.from("notifications")
        .update({ read_at: readAt }).eq("id", item.id).eq("user_id", userId);
      if (updateError) {
        console.warn("Could not mark notification as read:", updateError);
        return;
      }
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, read_at: readAt } : row));
    }
    onOpen?.(item);
    setOpen(false);
  };

  const markAllRead = async () => {
    if (!unreadCount) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("notifications")
      .update({ read_at: readAt }).eq("user_id", userId).is("read_at", null);
    if (updateError) {
      console.warn("Could not mark notifications as read:", updateError);
      return;
    }
    setItems((current) => current.map((row) => row.read_at ? row : { ...row, read_at: readAt }));
  };

  const describe = (item) => {
    const payload = item.payload || {};
    if (item.type === "order_placed") {
      return {
        title: t("notifications.new_order"),
        body: t("notifications.new_order_body", {
          customer: payload.customer_name || t("notifications.customer"),
          order: payload.checkout_id || item.entity_id || "",
          amount: Number(payload.total || 0).toLocaleString(i18n.resolvedLanguage || undefined),
        }),
      };
    }
    const status = payload.delivery_changed
      ? (payload.delivery_status || t("notifications.status_updated"))
      : (payload.payment_status || t("notifications.status_updated"));
    return {
      title: t("notifications.order_update"),
      body: t("notifications.order_update_body", {
        order: payload.checkout_id || item.entity_id || "",
        status: t(`notifications.statuses.${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, { defaultValue: status }),
      }),
    };
  };

  const formatDate = (value) => new Intl.DateTimeFormat(i18n.resolvedLanguage || undefined, {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));

  return (
    <div className={`notification-center ${audience === "admin" ? "notification-center-admin" : ""}`} ref={rootRef}>
      <button type="button" className="notification-trigger" aria-label={t("notifications.open", { count: unreadCount })}
        aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-popover" role="dialog" aria-label={t("notifications.title")}>
          <header className="notification-header">
            <div><span>{t("notifications.eyebrow")}</span><h2>{t("notifications.title")}</h2></div>
            {unreadCount > 0 && <button type="button" className="notification-read-all" onClick={markAllRead}><CheckCheck size={15} />{t("notifications.mark_all")}</button>}
          </header>
          {loading ? <div className="notification-state"><LoaderCircle size={18} className="notification-spinner" />{t("notifications.loading")}</div>
            : error ? <div className="notification-state notification-error"><p>{t("notifications.error")}</p><button type="button" onClick={loadNotifications}>{t("notifications.retry")}</button></div>
              : items.length === 0 ? <div className="notification-state"><Bell size={22} /><p>{t("notifications.empty")}</p><span>{t("notifications.empty_copy")}</span></div>
                : <ul className="notification-list">{items.map((item) => {
                  const copy = describe(item);
                  return <li key={item.id}>
                    <button type="button" className={`notification-item ${item.read_at ? "is-read" : "is-unread"}`} onClick={() => markRead(item)}>
                      <span className="notification-item-icon"><Circle size={9} fill="currentColor" /></span>
                      <span className="notification-item-copy"><strong>{copy.title}</strong><span>{copy.body}</span><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></span>
                    </button>
                  </li>;
                })}</ul>}
        </section>
      )}
    </div>
  );
}
