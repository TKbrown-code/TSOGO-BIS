import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useModalMessage } from "../context/ModalMessageContext";
import "../styles/form.css";

export default function ResetPassword() {
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { showAlert } = useModalMessage();

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setHasRecoverySession(Boolean(session));
        setCheckingSession(false);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Unable to verify password recovery session:", error);
      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < 6) {
      showAlert("Choose a password with at least 6 characters.", "Password too short", "warning");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("The two passwords do not match.", "Check your password", "warning");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      showAlert(error.message || "We couldn’t update your password. Please request a new reset link.", "Password update failed", "error");
      return;
    }

    await supabase.auth.signOut();
    showAlert("Your password has been changed. Sign in with your new password to continue.", "Password updated");
    navigate("/SignUp");
  };

  return (
    <main className="auth-page">
      <section className="auth-recovery-shell">
        <div className="auth-mobile-brand"><span className="auth-brand-mark">T<span /></span><span>TSOGO-BIS</span></div>
        <span className="auth-recovery-icon"><KeyRound size={20} /></span>
        <span className="auth-kicker">ACCOUNT SECURITY</span>
        <h1>Choose a new password</h1>
        <p className="auth-recovery-intro">Use a password you haven’t used for this account before.</p>

        {checkingSession ? <p className="auth-recovery-state">Verifying your secure reset link…</p> : !hasRecoverySession ? (
          <div className="auth-recovery-state">
            <p>This reset link is invalid or has expired. Request a new link and try again.</p>
            <Link to="/SignUp" className="auth-submit auth-recovery-link">Return to sign in <ArrowRight size={16} /></Link>
          </div>
        ) : (
          <form className="auth-form auth-recovery-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="reset-password">New password</label>
              <div className="auth-input-wrap">
                <input id="reset-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="reset-password-confirm">Confirm new password</label>
              <div className="auth-input-wrap">
                <input id="reset-password-confirm" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
                <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            <button type="submit" className="auth-submit" disabled={saving} aria-busy={saving}>
              {saving ? <><span className="auth-spinner" aria-hidden="true" /> Saving password…</> : <>Save new password <ArrowRight size={17} /></>}
            </button>
          </form>
        )}
        <Link to="/SignUp" className="auth-recovery-back">← Back to sign in</Link>
      </section>
    </main>
  );
}
