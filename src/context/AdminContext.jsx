import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { signUpUser, sendOtp } from "../hooks/functions";
import { showSiteModal } from "../utils/siteModal";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState(null);
  const authCheckId = useRef(0);

  // Check if user is admin
  const checkAdmin = useCallback(async (uid, requestedCheckId) => {
    const checkId = requestedCheckId ?? ++authCheckId.current;
    const isCurrentCheck = () => checkId === authCheckId.current;

    if (!uid) {
      if (!isCurrentCheck()) return false;
      setUser(null);
      setIsAdmin(false);
      setAdminRole(null);
      setLoading(false);
      return false;
    }

    try {
      const { data, error } = await supabase.rpc("is_admin_role");
      if (!isCurrentCheck()) return false;

      if (error) {
        console.error("Admin check error:", error);
        await supabase.auth.signOut({ scope: "local" }).catch((signOutError) => console.error("Could not end unverified admin session:", signOutError));
        if (!isCurrentCheck()) return false;
        setUser(null);
        setIsAdmin(false);
        setAdminRole(null);
        return false;
      }

      if (data === true) {
        if (!isCurrentCheck()) return false;
        setIsAdmin(true);
        setAdminRole("admin");
        return true;
      }

      await supabase.auth.signOut({ scope: "local" }).catch((signOutError) => console.error("Could not end unauthorized admin session:", signOutError));
      if (!isCurrentCheck()) return false;
      setUser(null);
      setIsAdmin(false);
      setAdminRole(null);
      return false;
    } catch (err) {
      if (!isCurrentCheck()) return false;
      console.error("Admin check exception:", err);
      await supabase.auth.signOut({ scope: "local" }).catch((signOutError) => console.error("Could not end unverified admin session:", signOutError));
      if (!isCurrentCheck()) return false;
      setUser(null);
      setIsAdmin(false);
      setAdminRole(null);
      return false;
    } finally {
      if (isCurrentCheck()) setLoading(false);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let active = true;
    let pendingAdminCheck;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        const checkId = ++authCheckId.current;
        setUser(nextUser);
        setIsAdmin(false);
        setAdminRole(null);
        setLoading(true);

        // Do not call Supabase APIs until the auth callback releases its lock.
        clearTimeout(pendingAdminCheck);
        pendingAdminCheck = setTimeout(() => {
          if (active) checkAdmin(nextUser?.id, checkId);
        }, 0);
      }
    );

    return () => {
      active = false;
      clearTimeout(pendingAdminCheck);
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  // Sign out
  const signOut = async () => {
    ++authCheckId.current;
    setUser(null);
    setIsAdmin(false);
    setAdminRole(null);
    setLoading(false);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Could not sign out of the admin workspace:", error);
  };

  const login = async (credentials) => {
    const {data, error} = await supabase.auth.signInWithPassword
      ({
        email: credentials.email,
        password: credentials.password,
      })
    if (error) {
      showSiteModal(error.message, "Sign in failed", "error");
    }
    return data;
  }

  const signUp = async (credentials) => {
    showSiteModal("Creating your account. This may take a moment.", "Creating account", "info");
    const response = await signUpUser(credentials);
    const res = await response.json();
    if (response.ok) {
     await login(credentials);
     showSiteModal("User signed up successfully.", "Account created");
    } else {
      showSiteModal(res.error, "Sign up failed", "error");
    }
  };

  const sentOtp = async (credentials) => {
    const responds = await sendOtp(credentials);
    const res = await responds.json();
    if (responds.ok) {
      showSiteModal("OTP sent successfully.", "Code sent");
    }else{
      showSiteModal(res.error, "Could not send code", "error");
    }
  };

  const value = {
    user,
    isAdmin,
    adminRole,
    loading,
    checkAdmin,
    signOut,
    login,
    signUp,
    sentOtp
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
