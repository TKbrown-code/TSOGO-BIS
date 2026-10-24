import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";

export default function SignupConfirmationActions({ email, language, onClose, onSignIn }) {
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const resend = async () => {
    setSending(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("create-account", {
        body: { action: "resend_confirmation", email, language },
      });
      if (invokeError || data?.error || !data?.success) throw invokeError || new Error(data?.error || "Unable to resend confirmation email");
      setResent(true);
    } catch (sendError) {
      console.error("Could not resend signup confirmation:", sendError);
      setError(t("auth.resend_email_error"));
    } finally {
      setSending(false);
    }
  };

  return <div className="auth-confirmation-actions">
    {resent && <p className="password-reset-modal-success-note" role="status">{t("auth.resend_signup_sent")}</p>}
    {error && <p className="password-reset-modal-error" role="alert">{error}</p>}
    <button className="modalbtn modalbtn-secondary" type="button" onClick={resend} disabled={sending} aria-busy={sending}>
      {sending ? <><span className="auth-spinner" aria-hidden="true" /> {t("auth.sending")}</> : t("auth.resend_confirmation_email")}
    </button>
    {onSignIn && <button className="modalbtn modalbtn-secondary" type="button" onClick={onSignIn}>{t("auth.signin")}</button>}
    <button className="modalbtn" type="button" onClick={onClose}>{t("auth.next")}</button>
  </div>;
}
