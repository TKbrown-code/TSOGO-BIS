// src/utils/visitor.js
export function getVisitorId() {
  let visitorId = localStorage.getItem("tsogoVisitorId");
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem("tsogoVisitorId", visitorId);
  }
  return visitorId;
}
