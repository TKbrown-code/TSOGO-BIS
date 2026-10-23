// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useUserContext } from "../../context/useUserContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useUserContext();

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f5f7fa"
      }}>
        <div style={{
          width: "48px",
          height: "48px",
          border: "4px solid #e5e7eb",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/SignUp" replace />;
  }

  return children;
}
