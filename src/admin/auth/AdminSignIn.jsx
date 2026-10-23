// src/components/AdminSignIn.jsx - Simplified Admin Sign In
import React, { useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./AdminSignIn.css";

export default function AdminSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      // Check if user is admin
      const { data: adminData, error: adminError } = await supabase.rpc("is_admin_role");

      if (adminError || adminData !== true) {
        await supabase.auth.signOut();
        throw new Error("You are not authorized as an admin");
      }

      // Success - redirect to admin dashboard
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-signin-container">
      <div className="admin-signin-card">
        <div className="admin-signin-header">
          <h1><Lock className="inline-block mr-2" size={28} /> Admin Sign In</h1>
          <p>Access the admin dashboard</p>
        </div>

        <form onSubmit={handleSignIn} className="admin-signin-form">
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-signin" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="admin-signin-footer">
          <p>Not an admin? <a href="/">Go to main site</a></p>
        </div>
      </div>
    </div>
  );
}
