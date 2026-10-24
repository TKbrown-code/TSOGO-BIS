// useUserInfo.jsx
import { supabase } from "../lib/supabase";
import { useModalMessage } from "../context/ModalMessageContext"; // import context
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function useUserinfo({form, isSignUp, setLoading}) {
  // get all modal helpers from context
  const { confirmMessage, errorMessage, closeMessage } = useModalMessage();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const SignUP = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-account", {
        body: {
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          language: (i18n.resolvedLanguage || localStorage.getItem("language") || "fr").slice(0, 2),
          referralCode: localStorage.getItem("tsogo_referral_code") || null,
        },
      });

      if (error || data?.error || !data?.success) {
        console.error("Sign Up failed:", error || data?.error || "Unexpected response");
        errorMessage(t("auth.signup_error"), t("auth.signup_error_title"));
        setLoading(false);
        return;
      }

      setLoading(false);
      localStorage.removeItem("tsogo_referral_code");
      if (data.account_exists) {
        confirmMessage(
          t("auth.signup_existing_account"),
          t("auth.signup_existing_title"),
          <button className="modalbtn" onClick={() => { closeMessage(true); navigate("/SignUp?mode=signin"); }}>{t("auth.signin")}</button>,
        );
        return;
      }
      confirmMessage(
        t("auth.signup_email_message"),
        t("auth.signup_email_title"),
        <>
          <button className="modalbtn modalbtn-secondary" onClick={() => closeMessage(true)}>{t("auth.next")}</button>
          <button className="modalbtn" onClick={() => { closeMessage(true); navigate("/SignUp?mode=signin"); }}>{t("auth.signin")}</button>
        </>,
      );
    } catch (err) {
      console.error("Unexpected error during Sign Up:", err);
      errorMessage(t("auth.signup_error"), t("auth.signup_error_title"));
      setLoading(false);
    }
  };

  const SignIn = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        errorMessage(error.message || "Invalid login credentials");
        setLoading(false);
        return;
      }

      if (!data?.session) {
        errorMessage("Login failed: please verify your email before signing in.");
        setLoading(false);
        return;
      }

      if (isSignUp) {
        await Insert(data?.user);
      } else {
        confirmMessage("Login successful! 🎉","",
          <>
            <button className="modalbtn" onClick={() => {navigate("/dashboard"), closeMessage();}}>Close</button>
          </>
        );
        setLoading(false);
      }
    } catch (err) {
      console.error("Unexpected error during Sign In:", err);
      errorMessage("Something went wrong during Sign In.");
      setLoading(false);
    }
  };

  const Insert = async (user) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ display_name: form.fullName })
        .eq("user_id", user.id)
        .select("user_id")
        .maybeSingle();

      if (error) {
        console.error("Profile insert error object:", error);
        errorMessage("Profile insert error: " + (error.message || "Unknown error"));
        setLoading(false);
        return;
      }

      confirmMessage("Account created successfully!", "Welcome to TSOGO-BIS", <button className="modalbtn" onClick={() => {navigate("/dashboard"); closeMessage();}}>Continue</button>);
      setLoading(false);
    } catch (err) {
      console.error("Unexpected error during profile insert:", err);
      errorMessage("Something went wrong while creating your profile.");
      setLoading(false);
    }
  };


  

  return {
    SignIn,
    SignUP,
    Insert,
  };
}

export const SignOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error signing out:", error.message);
  } else {
    console.log("Signed out successfully ✅");
   }
  };
