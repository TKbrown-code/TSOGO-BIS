import React from "react";
import { FaWhatsapp } from "react-icons/fa";
import { useTranslation } from "react-i18next";

export default function WhatsAppButton() {
  const { t } = useTranslation();
  const phoneNumber = "+237673918431"; // <-- replace with your WhatsApp number
  const message = encodeURIComponent(t('whatsapp.message'));

  const handleClick = () => {
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
  };

  return (
    <button
      onClick={handleClick}
      className="whatsapp-btn"
      aria-label={t('whatsapp.aria_label')}
    >
      <FaWhatsapp className="icon" />
    </button>
  );
}
