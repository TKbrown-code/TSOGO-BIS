import React from "react";
import { FaWhatsapp } from "react-icons/fa";
import { useTranslation } from "react-i18next";

export default function WhatsAppButton() {
  const { t } = useTranslation();
  const phoneNumber = "237680633832";
  const message = encodeURIComponent(t('whatsapp.message'));

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-btn"
      aria-label={t('whatsapp.aria_label')}
      title={t('whatsapp.aria_label')}
    >
      <span className="whatsapp-icon-wrap"><FaWhatsapp className="icon" /></span>
      <span className="whatsapp-label">{t("whatsapp.chat_label")}</span>
    </a>
  );
}
