import React, { useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { supabase } from "../../lib/supabase";
import ProfileAvatar from "./ProfileAvatar";

async function optimizeImage(file) {
  let source;
  let objectUrl;
  try {
    if (typeof createImageBitmap === "function") source = await createImageBitmap(file);
    else {
      objectUrl = URL.createObjectURL(file);
      source = new Image();
      source.src = objectUrl;
      if (typeof source.decode === "function") await source.decode();
      else await new Promise((resolve, reject) => { source.onload = resolve; source.onerror = reject; });
    }
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    const scale = Math.min(1, 512 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image could not be processed.");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image could not be processed.")), "image/webp", 0.82));
  } finally {
    source?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export default function ProfileImageUploader({ userId, name, avatarPath, onChange, compact = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!userId) { setError("Your account could not be identified."); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Choose a JPG, PNG, or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Choose an image smaller than 5 MB."); return; }
    setBusy(true);
    let uploadedPath;
    try {
      const blob = await optimizeImage(file);
      const fileId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      uploadedPath = `${userId}/${fileId}.webp`;
      const { error: uploadError } = await supabase.storage.from("profile-images").upload(uploadedPath, blob, { contentType: "image/webp", cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.from("profiles").update({ avatar_path: uploadedPath }).eq("user_id", userId);
      if (profileError) throw profileError;
      const previousPath = avatarPath;
      onChange?.(uploadedPath);
      if (previousPath && previousPath !== uploadedPath) await supabase.storage.from("profile-images").remove([previousPath]);
    } catch (uploadError) {
      if (uploadedPath) await supabase.storage.from("profile-images").remove([uploadedPath]).catch(() => {});
      console.error("Profile photo upload failed:", uploadError);
      setError(uploadError.message || "The profile photo could not be saved.");
    } finally { setBusy(false); }
  }

  async function removePhoto() {
    if (!avatarPath || busy) return;
    setBusy(true); setError("");
    try {
      const { error: profileError } = await supabase.from("profiles").update({ avatar_path: null }).eq("user_id", userId);
      if (profileError) throw profileError;
      onChange?.(null);
      await supabase.storage.from("profile-images").remove([avatarPath]);
    } catch (removeError) { setError(removeError.message || "The profile photo could not be removed."); }
    finally { setBusy(false); }
  }

  return <div className={`profile-photo-uploader ${compact ? "compact" : ""}`}>
    <ProfileAvatar userId={userId} avatarPath={avatarPath} name={name} className="profile-photo-preview" />
    <div className="profile-photo-actions">
      <strong>Profile photo</strong>
      <span>JPG, PNG, or WebP · up to 5 MB</span>
      <div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <><span className="profile-photo-spinner" /> Saving…</> : <><Camera size={15} /> {avatarPath ? "Change photo" : "Upload photo"}</>}
        </button>
        {avatarPath && <button type="button" className="profile-photo-remove" onClick={removePhoto} disabled={busy}><Trash2 size={14} /> Remove</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden />
      {error && <small role="alert">{error}</small>}
    </div>
  </div>;
}
