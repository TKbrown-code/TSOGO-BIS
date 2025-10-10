// useUserInfo.jsx
import { supabase } from "../lib/supabase";
import { useModalMessage } from "../context/ModalMessageContext"; // import context
import React from "react";
import { useState } from "react";
import useFormValidation from "../hooks/verifyForm"
import { useNavigate } from "react-router-dom";

export default function useUserinfo({form, isSignUp, setLoading}) {
  // get all modal helpers from context
  const { openMessage, confirmMessage, errorMessage, closeMessage } = useModalMessage();
  const[resetForm, setResetForm] = useState("");
  const navigate = useNavigate();
  const initialValues = {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    vpassword: "",
    policy: false,
  };

  const { handleChange, setForm } = useFormValidation(initialValues);

  const clearForm = () => {
    setForm(initialValues); // ✅ reset form
  };


  const SignUP = async () => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (error) {
        console.error("Sign Up error object:", error);
        errorMessage("Sign Up error: " + (error.message || error.error_description || "Unknown error"));
        setLoading(false);
        return;
      } else if (data?.user?.identities?.length === 0) {
        errorMessage("User Email or Name already exist!");
        setLoading(false);
        clearForm();
        return;
      } else {
          setLoading(false);
        confirmMessage(
  "Sign up successful! Verify your email before continuing.",
  "Confirm Email",
  <>
    <button
      className="modalbtn verifybtn"
      onClick={async () => {
        await SignIn();
      }}
    >
      Sign In
    </button>
    <button
      className="modalbtn"
      onClick={() => {
        closeMessage();
        navigate("/dashboard");
      }}
    >
      Close
    </button>
  </>
);
      }
    } catch (err) {
      console.error("Unexpected error during Sign Up:", err);
      errorMessage("Something went wrong during Sign Up.");
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
        clearForm();
      }
    } catch (err) {
      console.error("Unexpected error during Sign In:", err);
      errorMessage("Something went wrong during Sign In.");
      setLoading(false);
    }
  };

  const Insert = async (user) => {
    try {
      const { data, error } = await supabase.from("profiles").insert([{
        user_id: user.id,
        full_name: form.fullName,
        email: form.email,
        phone: form.phone,
      }]);

      if (error) {
        console.error("Profile insert error object:", error);
        errorMessage("Profile insert error: " + (error.message || "Unknown error"));
        setLoading(false);
        return;
      }

      confirmMessage("Account created successfully!",
        <button className="modalbtn" onClick={() => {navigate("/dashboard"); closeMessage();}}>Close</button>
      );
      setLoading(false);
      clearForm();
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
