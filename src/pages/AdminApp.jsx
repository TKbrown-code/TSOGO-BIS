// src/pages/AdminApp.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminProducts from "../admin/AdminProducts";
import AdminCheckouts from "../admin/AdminCheckouts";
import AdminCategories from "../admin/AdminCategories";
import AdminAuth from "../admin/AdminAuth";

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ Centralized admin check
  const checkAdmin = async (uid) => {
    if (!uid) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("admins")
      .select("id")
      .eq("id", uid)
      .single();

    if (error) {
      console.error("Admin check error:", error);
      setIsAdmin(false);
    } else {
      setIsAdmin(!!data);
    }
    setLoading(false);
  };

  useEffect(() => {
    // ✅ Auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        checkAdmin(session?.user?.id);
      }
    );

    // ✅ Initial session load
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Error getting session:", error);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const session = data?.session;
      setUser(session?.user ?? null);
      checkAdmin(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ UI states
  if (loading) return <div>Loading admin...</div>;
  if (!user) return <AdminAuth />;
  if (!isAdmin)
    return (
      <div style={{ padding: 32 }}>
        <h2>Access denied</h2>
        <p>Your account is not an admin. Sign out and sign in with an admin account.</p>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );

  // ✅ Main Admin Layout
  return (
    <div className="admin-layout" style={{ padding: 16 }}>
      <header
        style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}
      >
        <h1>TSOGO-BIS Admin</h1>
        <div>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <main
        style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16 }}
      >
        <section>
          <AdminProducts />
          <AdminCheckouts />
        </section>

        <aside>
          <AdminCategories />
        </aside>
      </main>
    </div>
  );
}
