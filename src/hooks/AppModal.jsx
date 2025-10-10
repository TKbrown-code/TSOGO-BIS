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
      footer={modalContent.footer || (
        <button className="modalbtn" onClick={closeMessage}>Close</button>
      )}
    >
      <p>{modalContent.message}</p>
    </Modal>
  );
}
