import React, { useEffect, useState } from "react";
import { KeyRound, LoaderCircle, LockKeyhole, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "../../lib/supabase";
import BrandMonogram from "../../assets/nav-monogram.png";
import "./AdminMfaGate.css";

function qrImageSource(value) {
  if (!value) return "";
  return value.startsWith("data:") ? value : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
}

export default function AdminMfaGate({ user, onSignOut, children }) {
  const [checking, setChecking] = useState(true);
  const [verifiedSession, setVerifiedSession] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [factorName, setFactorName] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function inspectMfa() {
      setChecking(true);
      setError("");
      try {
        const [assuranceResult, factorResult] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);
        if (assuranceResult.error) throw assuranceResult.error;
        if (factorResult.error) throw factorResult.error;
        if (!active) return;

        const verifiedTotp = factorResult.data?.totp?.find((factor) => factor.status === "verified");
        const totpVerifiedThisSession = assuranceResult.data?.currentLevel === "aal2"
          && assuranceResult.data?.currentAuthenticationMethods?.some((method) => method.method === "totp");
        if (totpVerifiedThisSession) {
          setVerifiedSession(true);
          setChecking(false);
          return;
        }
        if (verifiedTotp) {
          setFactorId(verifiedTotp.id);
          setFactorName(verifiedTotp.friendly_name || "Authenticator app");
          setSetupRequired(false);
        } else {
          setSetupRequired(true);
        }
      } catch (inspectError) {
        if (active) setError(inspectError.message || "Could not check admin two-step verification.");
      } finally {
        if (active) setChecking(false);
      }
    }
    inspectMfa();
    return () => { active = false; };
  }, [user?.id]);

  async function beginSetup() {
    setBusy(true);
    setError("");
    try {
      const { data: listed, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const pendingFactors = (listed?.all || []).filter((factor) => factor.factor_type === "totp" && factor.status !== "verified");
      for (const pendingFactor of pendingFactors) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: pendingFactor.id });
        if (removeError) throw removeError;
      }

      const friendlyName = `TSOGO-BIS Admin (${user?.email || "account"})`;
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });
      if (enrollError) throw enrollError;
      setFactorId(data.id);
      setFactorName(friendlyName);
      setQrCode(data.totp?.qr_code || "");
      setSecret(data.totp?.secret || "");
      setSetupRequired(true);
    } catch (setupError) {
      setError(setupError.message || "Could not start authenticator setup.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAuthenticator(event) {
    event.preventDefault();
    if (!factorId || !/^\d{6,8}$/.test(verificationCode.trim())) {
      setError("Enter the current 6–8 digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verificationCode.trim(),
      });
      if (verifyError) throw verifyError;

      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      const totpWasVerified = assurance?.currentLevel === "aal2"
        && assurance?.currentAuthenticationMethods?.some((method) => method.method === "totp");
      if (!totpWasVerified) throw new Error("The authenticator code was not confirmed. Try the latest code from your app.");

      setVerificationCode("");
      setQrCode("");
      setSecret("");
      setVerifiedSession(true);
    } catch (verifyError) {
      setError(verifyError.message || "That code could not be verified. Check the time on your phone and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (verifiedSession) return children;
  if (checking) {
    return <div className="admin-mfa-screen"><LoaderCircle className="admin-mfa-spinner" size={26} /><p>Checking admin security…</p></div>;
  }
  if (!error && !setupRequired && factorId) {
    // A verified factor exists; the active session still needs its second factor.
    return (
      <div className="admin-mfa-screen">
        <section className="admin-mfa-card" aria-labelledby="admin-mfa-title">
          <BrandHeader />
          <span className="admin-mfa-icon"><LockKeyhole size={21} /></span>
          <p className="admin-mfa-eyebrow">ADMIN SECURITY · STEP 2 OF 2</p>
          <h1 id="admin-mfa-title">Verify it’s you</h1>
          <p className="admin-mfa-description">Enter the current code from {factorName}. Your admin workspace stays locked until the code is verified.</p>
          <CodeForm code={verificationCode} setCode={setVerificationCode} busy={busy} error={error} onSubmit={verifyAuthenticator} />
          <button className="admin-mfa-signout" type="button" onClick={onSignOut}><LogOut size={15} /> Sign out</button>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-mfa-screen">
      <section className="admin-mfa-card" aria-labelledby="admin-mfa-title">
        <BrandHeader />
        <span className="admin-mfa-icon"><ShieldCheck size={22} /></span>
        <p className="admin-mfa-eyebrow">ADMIN SECURITY · SETUP REQUIRED</p>
        <h1 id="admin-mfa-title">Secure your admin account</h1>
        <p className="admin-mfa-description">Use an authenticator app such as Google Authenticator, Microsoft Authenticator, or Authy. You’ll scan a QR code and confirm one code before the dashboard opens.</p>

        {!factorId ? (
          <button className="admin-mfa-primary" type="button" onClick={beginSetup} disabled={busy}>
            {busy ? <LoaderCircle className="admin-mfa-button-spinner" size={17} /> : <Smartphone size={17} />}
            Set up authenticator app
          </button>
        ) : (
          <>
            <div className="admin-mfa-setup-steps">
              {qrCode && <img className="admin-mfa-qr" src={qrImageSource(qrCode)} alt="Authenticator setup QR code" />}
              <div className="admin-mfa-instructions"><strong>1. Add this account in your app</strong><span>Scan the QR code. If you can’t scan it, enter the setup key manually.</span></div>
              {secret && <div className="admin-mfa-secret"><KeyRound size={15} /><code>{secret}</code></div>}
              <div className="admin-mfa-instructions"><strong>2. Enter the six-digit code</strong><span>The code changes every 30 seconds.</span></div>
            </div>
            <CodeForm code={verificationCode} setCode={setVerificationCode} busy={busy} error={error} onSubmit={verifyAuthenticator} />
          </>
        )}
        {!factorId && error && <p className="admin-mfa-error" role="alert">{error}</p>}
        <button className="admin-mfa-signout" type="button" onClick={onSignOut}><LogOut size={15} /> Sign out</button>
      </section>
    </div>
  );
}

function BrandHeader() {
  return <div className="admin-mfa-brand"><img src={BrandMonogram} alt="" /><span>TSOGO-BIS<small>ADMIN WORKSPACE</small></span></div>;
}

function CodeForm({ code, setCode, busy, error, onSubmit }) {
  return (
    <form className="admin-mfa-code-form" onSubmit={onSubmit}>
      <label htmlFor="admin-totp-code">Authenticator code</label>
      <input id="admin-totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="000000" required />
      {error && <p className="admin-mfa-error" role="alert">{error}</p>}
      <button className="admin-mfa-primary" type="submit" disabled={busy || code.trim().length < 6}>
        {busy ? <LoaderCircle className="admin-mfa-button-spinner" size={17} /> : <LockKeyhole size={16} />}
        Verify and continue
      </button>
    </form>
  );
}
