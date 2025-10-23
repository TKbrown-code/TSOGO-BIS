import React from "react";

export default function LoadingState({ 
  message = "Loading...", 
  size = "medium",
  type = "spinner" 
}) {
  const sizes = {
    small: "1rem",
    medium: "2rem", 
    large: "3rem"
  };

  return (
    <div className="loading-state" role="status" aria-live="polite">
      {type === "spinner" ? (
        <div 
          className="loading-spinner"
          style={{ 
            width: sizes[size], 
            height: sizes[size],
            border: `3px solid #f3f3f3`,
            borderTop: `3px solid var(--accentColor)`,
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
          aria-label={message}
        />
      ) : (
        <div className="loading-dots">
          {[...Array(3)].map((_, i) => (
            <div 
              key={i}
              className="loading-dot"
              style={{
                animationDelay: `${i * 0.15}s`
              }}
            />
          ))}
        </div>
      )}
      <p className="loading-message">{message}</p>
    </div>
  );
}
