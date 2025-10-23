import React from "react";

import { Package } from "lucide-react";

export default function EmptyState({ 
  title = "No items found",
  message = "There's nothing to display here yet.",
  icon = <Package size={48} />,
  action = null 
}) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
      {action && (
        <div className="empty-state-action">
          {action}
        </div>
      )}
    </div>
  );
}
