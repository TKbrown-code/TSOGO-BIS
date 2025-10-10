import React from "react";
import "../styles/Modal.css";


export default function Modal({ isOpen, onClose, title, children, footer }) {

  if (!isOpen) return null;

  return (
    <>
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="modal-title">{title}</h2>}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}

        <button className="modal-close" onClick={onClose}>
          ✖
        </button>
      </div>
    </div>

    <style>
      {`
      .modal-title {
      margin-top: 0;
      font-size: 1.5rem;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
      color: ${title === "Error" ? "rgba(255, 7, 7, 1)" : title === "Confirm" ? "rgb(37, 113, 226)" : title === "Warning" ? "yellow" : "rgb(0,0,0)"};
      }
      `}
    </style>
    </>
  );
}

