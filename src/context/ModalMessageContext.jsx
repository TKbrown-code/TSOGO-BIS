import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ModalMessageContext = createContext(null);

export const ModalMessageProvider = ({ children }) => {
  const [modalContent, setModalContent] = useState({ title: "", message: "", type: null });
  const resolverRef = useRef(null);

  useEffect(() => {
    const handleModalEvent = (event) => {
      resolverRef.current?.(false);
      resolverRef.current = null;
      setModalContent({ title: event.detail?.title || "Notice", message: event.detail?.message || "", type: event.detail?.type || "info" });
    };
    window.addEventListener("tsogo:modal", handleModalEvent);
    return () => window.removeEventListener("tsogo:modal", handleModalEvent);
  }, []);

  const closeMessage = useCallback((result = false) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setModalContent({ title: "", message: "", type: null });
  }, []);

  const openMessage = useCallback(({ title = "Message", message = "", type = "info", footer = null, content = null, hideFooter = false } = {}) => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setModalContent({ title, message, type, footer, content, hideFooter });
  }, []);

  const showAlert = useCallback((message, title = "Notice", type = "info") => {
    openMessage({ message, title, type });
  }, [openMessage]);

  const confirmDialog = useCallback((message, title = "Please confirm", options = {}) => {
    resolverRef.current?.(false);
    setModalContent({ title, message, type: "confirm", confirmLabel: options.confirmLabel || "Continue", cancelLabel: options.cancelLabel || "Cancel", tone: options.tone || "default" });
    return new Promise((resolve) => { resolverRef.current = resolve; });
  }, []);

  const confirmMessage = useCallback((message, title = "Please confirm", footer = null) => {
    // Compatibility for existing screens that provide their own modal footer.
    setModalContent({ title, message, footer, type: "confirm" });
  }, []);

  const errorMessage = useCallback((message, title = "Something went wrong", footer = null) => {
    setModalContent({ title, message, footer, type: "error" });
  }, []);

  return (
    <ModalMessageContext.Provider value={{ modalContent, openMessage, showAlert, confirmDialog, confirmMessage, errorMessage, closeMessage }}>
      {children}
    </ModalMessageContext.Provider>
  );
};

export const useModalMessage = () => {
  const context = useContext(ModalMessageContext);
  if (!context) throw new Error("useModalMessage must be used within ModalMessageProvider");
  return context;
};
