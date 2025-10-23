import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState(null);

  // Check if user is admin
  const checkAdmin = useCallback(async (uid) => {
    if (!uid) {
      setIsAdmin(false);
      setAdminRole(null);
      setLoading(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from("admins")
        .select("id, role")
        .eq("id", uid)
        .single();

      if (error) {
        console.error("Admin check error:", error);
        setIsAdmin(false);
        setAdminRole(null);
        return false;
      }

      if (data) {
        setIsAdmin(true);
        // Use the actual role from database, default to 'moderator' if not set
        setAdminRole(data.role || 'moderator');
        console.log('Admin role set to:', data.role || 'moderator');
        return true;
      }

      setIsAdmin(false);
      setAdminRole(null);
      return false;
    } catch (err) {
      console.error("Admin check exception:", err);
      setIsAdmin(false);
      setAdminRole(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        checkAdmin(session?.user?.id);
      }
    );

    return () => subscription.unsubscribe();
  }, [checkAdmin]);

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setAdminRole(null);
  };

  const value = {
    user,
    isAdmin,
    adminRole,
    loading,
    checkAdmin,
    signOut
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
};
