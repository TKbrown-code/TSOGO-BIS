import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (sessionUser) => {
    setLoading(true);
    setUser(sessionUser);

    if (sessionUser) {
      // ✅ Check admin role
      const { data: admin } = await supabase
        .from("admins")
        .select("id")
        .eq("id", sessionUser.id)
        .maybeSingle();

      setIsAdmin(!!admin);

      // ✅ Fetch profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", sessionUser.id)
        .maybeSingle();

      setProfile(prof || null);
    } else {
      setProfile(null);
      setIsAdmin(false);
    }

    setLoading(false);
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session?.user || null);
    });

    // Listen for login/logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserData(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{ user, profile, isAdmin, loading, refreshUser: fetchUserData }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => useContext(UserContext);
