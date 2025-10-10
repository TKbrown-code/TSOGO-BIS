// ModalMessageContext.jsx
import React, { createContext, useContext, useState } from "react";

const ModalMessageContext = createContext();

export const ModalMessageProvider = ({ children }) => {
  const [modalContent, setModalContent] = useState({
    title: "",
    message: "",
    footer: null,
    type: null, // "info", "error", "confirm"
  });

  // generic function to open a modal
  const openMessage = ({ title = "Notification", message, footer = null, type = "info" }) => {
    setModalContent({ title, message, footer, type });
  };

  // shortcut for confirmation messages
  const confirmMessage = (message, title = "Confirm", footer = null) => {
    setModalContent({ title, message, footer, type: "confirm" });
  };

  // shortcut for error messages
  const errorMessage = (message, title = "Error", footer = null) => {
    setModalContent({ title, message, footer, type: "error" });
  };

  const closeMessage = () => {
    setModalContent({ title: "", message: "", footer: null, type: null });
  };

  return (
    <ModalMessageContext.Provider value={{ modalContent, openMessage, confirmMessage, errorMessage, closeMessage }}>
      {children}
    </ModalMessageContext.Provider>
  );
};

export const useModalMessage = () => useContext(ModalMessageContext);
