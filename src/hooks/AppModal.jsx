// AppModal.jsx
import React from "react";
import Modal from "./modal";
import { useModalMessage } from "../context/ModalMessageContext";

export default function AppModal() {
  const { modalContent, closeMessage } = useModalMessage();

  // modal is open if type is set
  const isOpen = !!modalContent.type;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeMessage}
      title={modalContent.title}
      type={modalContent.type}
      footer={modalContent.hideFooter ? null : modalContent.footer || (
        modalContent.type === "confirm" ? <>
          <button className="modalbtn modalbtn-secondary" onClick={() => closeMessage(false)}>{modalContent.cancelLabel || "Cancel"}</button>
          <button className="modalbtn" onClick={() => closeMessage(true)}>{modalContent.confirmLabel || "Continue"}</button>
        </> : <button className="modalbtn" onClick={() => closeMessage(true)}>Got it</button>
      )}
    >
      {modalContent.content || <p>{modalContent.message}</p>}
    </Modal>
  );
}
