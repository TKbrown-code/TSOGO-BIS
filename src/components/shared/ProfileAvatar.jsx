import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./profile-avatar.css";

export default function ProfileAvatar({ userId, avatarPath, name, className = "" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    if (!userId) return undefined;
    const load = async () => {
      let path = avatarPath;
      if (!path) {
        const { data } = await supabase.from("profiles").select("avatar_path").eq("user_id", userId).maybeSingle();
        path = data?.avatar_path;
      }
      if (!active || !path) return;
      const { data, error } = await supabase.storage.from("profile-images").createSignedUrl(path, 3600);
      if (active) setUrl(error ? "" : data?.signedUrl || "");
    };
    load().catch(() => { if (active) setUrl(""); });
    return () => { active = false; };
  }, [avatarPath, userId]);
  const initial = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return <div className={`profile-avatar ${className}`} aria-label={name || "Profile photo"}>
    {url ? <img src={url} alt="" loading="lazy" /> : <span>{initial}</span>}
  </div>;
}
