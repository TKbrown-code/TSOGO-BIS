import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (sessionUser) => {
    setLoading(true);
    setUser(sessionUser);

    if (sessionUser) {
      try {
        const { data: prof, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", sessionUser.id)
          .maybeSingle();

        if (error) throw error;
        setProfile(prof || null);
      } catch (error) {
        console.error("Error loading user profile:", error);
        setProfile(null);
      }
    } else {
      setProfile(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    let pendingRefresh;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);

      // Auth callbacks run while Supabase holds its auth lock. Defer data API calls.
      clearTimeout(pendingRefresh);
      pendingRefresh = setTimeout(() => {
        if (active) fetchUserData(sessionUser);
      }, 0);
    });

    return () => {
      active = false;
      clearTimeout(pendingRefresh);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider
      value={{ user, profile, loading, refreshUser: fetchUserData }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => useContext(UserContext);
