export function showSiteModal(message, title = "Notice", type = "info") {
  if (typeof window === "undefined") return;
  const text = String(message ?? "");
  const inferredError = /^(error|failed|could not|unable|something went wrong)/i.test(text.trim());
  const inferredWarning = /^(please|only admins|password must|new passwords)/i.test(text.trim());
  const modalType = type === "info" ? (inferredError ? "error" : inferredWarning ? "warning" : type) : type;
  const modalTitle = title === "Notice" && inferredError ? "Something went wrong" : title === "Notice" && inferredWarning ? "Please check" : title;
  window.dispatchEvent(new CustomEvent("tsogo:modal", { detail: { message, title: modalTitle, type: modalType } }));
}
