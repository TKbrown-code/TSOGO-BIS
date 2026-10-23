import React, { useEffect } from "react";
import "../styles/Modal.css";

export default function Modal({ isOpen, onClose, title, children, footer, type = "info" }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="app-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose(false);
      }}
    >
      <section
        className={`app-modal-content app-modal-${type}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading-row">
          <span className="app-modal-mark" aria-hidden="true">
            {type === "error" ? "!" : type === "confirm" ? "?" : "✓"}
          </span>
          <div className="modal-heading-copy">
            <span className="modal-eyebrow">TSOGO-BIS</span>
            {title && <h2 id="app-modal-title" className="modal-title">{title}</h2>}
          </div>
          <button className="modal-close" onClick={() => onClose(false)} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </section>
    </div>
  );
}
