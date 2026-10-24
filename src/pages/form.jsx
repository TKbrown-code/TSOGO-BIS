import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useModalMessage } from "../context/ModalMessageContext";
import "../styles/form.css";
import useFormValidation from "../hooks/verifyForm";
import useUserInfo from "../hooks/useUserInfo";
import { useUserContext } from "../context/useUserContext";

function PasswordResetModalContent({ initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { closeMessage } = useModalMessage();
  const { t, i18n } = useTranslation();

  const sendResetLink = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: email.trim(), language: i18n.resolvedLanguage?.slice(0, 2) || "fr" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSent(true);
    } catch (error) {
      setErrorMessage(t("auth.reset_error"));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <div className="password-reset-modal-success">
      <span className="password-reset-modal-check"><Check size={18} /></span>
      <p>{t("auth.reset_sent", { email: email.trim() })}</p>
      <button type="button" className="modalbtn" onClick={() => closeMessage(true)}>{t("auth.next")}</button>
    </div>;
  }

  return <form className="password-reset-modal-form" onSubmit={sendResetLink}>
    <p>{t("auth.reset_prompt")}</p>
    <label htmlFor="password-reset-email">{t("auth.email")}</label>
    <input id="password-reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("auth.email_placeholder")} autoComplete="email" required autoFocus />
    {errorMessage && <p className="password-reset-modal-error" role="alert">{errorMessage}</p>}
    <div className="password-reset-modal-actions">
      <button type="button" className="modalbtn modalbtn-secondary" onClick={() => closeMessage(false)} disabled={sending}>{t("common.cancel")}</button>
      <button type="submit" className="modalbtn" disabled={sending} aria-busy={sending}>{sending ? <><span className="auth-spinner" aria-hidden="true" /> {t("auth.sending")}</> : t("auth.send_reset_link")}</button>
    </div>
  </form>;
}

export default function Form() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const signInMode = searchParams.get("mode") === "signin";
  const [isSignUp, setIsSignUp] = useState(!signInMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { form, errors, handleChange, validateForm, handleChangeSign, validateFormSignIn } = useFormValidation({
    fullName: "", email: "", password: "", vpassword: "", policy: false,
  });
  const { SignIn, SignUP } = useUserInfo({ form, isSignUp, setLoading });
  const { openMessage } = useModalMessage();
  const { user, loading: authLoading } = useUserContext();

  useEffect(() => {
    if (searchParams.has("mode")) setIsSignUp(!signInMode);
  }, [searchParams, signInMode]);

  const handleForgotPassword = () => openMessage({
    title: t("auth.reset_title"),
    type: "info",
    content: <PasswordResetModalContent initialEmail={form.email} />,
    hideFooter: true,
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (loading) return;
    const valid = isSignUp ? validateForm() : validateFormSignIn();
    if (!valid) return;
    setLoading(true);
    Promise.resolve(isSignUp ? SignUP() : SignIn()).finally(() => setLoading(false));
  };

  const title = isSignUp ? t("auth.signup_title") : t("auth.signin_title");
  const field = ({ name, label, placeholder, type = "text", onChange = handleChange, reveal, onReveal }) => (
    <div className={`auth-field ${errors[name] ? "has-error" : ""}`}>
      <label htmlFor={`auth-${name}`}>{label}{name !== "phone" && <span aria-hidden="true">*</span>}</label>
      <div className="auth-input-wrap">
        <input
          id={`auth-${name}`}
          name={name}
          type={reveal ? (reveal.visible ? "text" : "password") : type}
          value={form[name] || ""}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={name === "fullName" ? "name" : name === "email" ? "email" : name === "phone" ? "tel" : name === "vpassword" ? "new-password" : isSignUp ? "new-password" : "current-password"}
          required={name !== "phone" || (isSignUp && name === "phone")}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `auth-${name}-error` : undefined}
        />
      {reveal && <button type="button" className="auth-password-toggle" onClick={onReveal} aria-label={reveal.visible ? t("auth.hide_password") : t("auth.show_password")}>{reveal.visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
      </div>
      {errors[name] && <p id={`auth-${name}-error`} className="auth-error">{errors[name]}</p>}
    </div>
  );

  if (authLoading) return <main className="auth-page"><div className="auth-submit auth-route-loading"><span className="auth-spinner" />{t("auth.loading_account")}</div></main>;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-label={title}>
        <aside className="auth-story">
          <div className="auth-brand"><span className="auth-brand-mark">T<span /></span><span>TSOGO-BIS</span></div>
          <div className="auth-story-copy">
            <span className="auth-kicker"><Sparkles size={14} /> {t("auth.story_kicker")}</span>
            <h1>{t("auth.story_title_line1")}<br /><em>{t("auth.story_title_line2")}</em></h1>
            <p>{t("auth.story_copy")}</p>
          </div>
          <div className="auth-assurance"><ShieldCheck size={18} strokeWidth={1.7} /><span>{t("auth.assurance")}</span></div>
          <span className="auth-story-index">01 <i /> {t("auth.story_footer")}</span>
        </aside>

        <div className="auth-panel">
          <div className="auth-mobile-brand"><span className="auth-brand-mark">T<span /></span><span>TSOGO-BIS</span></div>
          <div className="auth-panel-heading">
            <span className="auth-kicker">{isSignUp ? t("auth.join_kicker") : t("auth.welcome_kicker")}</span>
            <h2>{title}</h2>
            <p>{isSignUp ? t("auth.signup_intro") : t("auth.signin_intro")}</p>
          </div>

          <div className="auth-switch" role="tablist" aria-label={t("auth.choose_mode")}>
            <button type="button" role="tab" aria-selected={isSignUp} className={isSignUp ? "active" : ""} onClick={() => setIsSignUp(true)}>{t("auth.create_account")}</button>
            <button type="button" role="tab" aria-selected={!isSignUp} className={!isSignUp ? "active" : ""} onClick={() => setIsSignUp(false)}>{t("auth.signin")}</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isSignUp && <>
              {field({ name: "fullName", label: t("auth.full_name"), placeholder: t("auth.full_name_placeholder") })}
            </>}
            {field({ name: "email", label: t("auth.email"), placeholder: t("auth.email_placeholder"), type: "email", onChange: isSignUp ? handleChange : handleChangeSign })}
            {field({ name: "password", label: t("auth.password"), placeholder: t("auth.password_placeholder"), onChange: isSignUp ? handleChange : handleChangeSign, reveal: { visible: showPassword }, onReveal: () => setShowPassword((visible) => !visible) })}
            {!isSignUp && <div className="auth-forgot-row"><button type="button" onClick={handleForgotPassword}>{t("auth.forgot_password")}</button></div>}
            {isSignUp && field({ name: "vpassword", label: t("auth.verify_password"), placeholder: t("auth.password_again"), reveal: { visible: showVerifyPassword }, onReveal: () => setShowVerifyPassword((visible) => !visible) })}

            {isSignUp && <div className="auth-policy-row">
              <input id="auth-policy" type="checkbox" name="policy" checked={Boolean(form.policy)} onChange={handleChange} aria-invalid={Boolean(errors.policy)} />
              <label htmlFor="auth-policy">{t("auth.agree_to")} <Link to="/terms-and-policies">{t("footer.terms")}</Link>.</label>
              {errors.policy && <p className="auth-error">{errors.policy}</p>}
            </div>}

            <button className="auth-submit" type="submit" disabled={loading} aria-busy={loading}>
              {loading ? <><span className="auth-spinner" aria-hidden="true" /><span>{isSignUp ? t("auth.creating_account") : t("auth.signing_in")}</span></> : <><span>{isSignUp ? t("auth.create_my_account") : t("auth.signin_to_account")}</span><ArrowRight size={17} /> </>}
            </button>
          </form>

          <p className="auth-switch-prompt">
            {isSignUp ? t("auth.have_account") : t("auth.no_account")}{" "}
            <button type="button" onClick={() => setIsSignUp((value) => !value)}>{isSignUp ? t("auth.signin") : t("auth.signup")}</button>
          </p>
          <div className="auth-footnote"><Check size={14} /> {t("auth.privacy_note")}</div>
        </div>
      </section>
      <Link to="/" className="auth-back-link">← {t("auth.back_to_shop")}</Link>
    </main>
  );
}
