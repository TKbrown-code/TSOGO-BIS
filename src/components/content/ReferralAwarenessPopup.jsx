import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, X, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUserContext } from "../../context/useUserContext";
import "../../styles/referral-awareness.css";

const SEEN_KEY = "tsogo_referral_awareness_seen";

export default function ReferralAwarenessPopup() {
  const { t } = useTranslation();
  const { user } = useUserContext();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return undefined;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, "1");
      setVisible(true);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return <aside className="referral-awareness" role="dialog" aria-label={t("referral_awareness.title")}>
    <button className="referral-awareness-close" type="button" onClick={() => setVisible(false)} aria-label={t("common.close")}><X size={17} /></button>
    <span className="referral-awareness-icon"><Gift size={19} /></span>
    <div className="referral-awareness-copy"><strong>{t("referral_awareness.title")}</strong><p>{t("referral_awareness.copy")}</p><Link to={user ? "/dashboard?section=referrals" : "/SignUp"} onClick={() => setVisible(false)}>{t("referral_awareness.action")} <ArrowUpRight size={14} /></Link></div>
  </aside>;
}
