import { showSiteModal as alert } from "../../utils/siteModal";
// src/admin/AdminAuth.jsx
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else alert("Check your email for a sign-in link.");
    setLoading(false);
  }

  return (
    <div style={{ padding: 32 }}>
      <h2>Admin sign in</h2>
      <p>Enter the admin email to receive a magic link.</p>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="enter password"/>
      <button onClick={signIn} disabled={loading}>{loading ? "Sending..." : "Send Magic Link"}</button>
    </div>
  );
}
