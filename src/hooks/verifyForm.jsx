import { useState } from "react";


export default function useFormValidation(initialValues) {
  const [form, setForm] = useState(initialValues);
  const [errors, setErrors] = useState({});


  // --- Validation rules ---
  const validateField = (name, value) => {
    switch (name) {
      case "fullName":
        return value.trim() ? "" : "Full name is required*";

      case "email":
        return /\S+@\S+\.\S+/.test(value) ? "" : "Invalid email address*";

      case "phone":
        return /^\+?\d{7,15}$/.test(value)
          ? ""
          : "Invalid phone number (7–15 digits)*";

      case "password":
        return value.length >= 6 ? "" : "Password must be at least 6 characters*";

      case "vpassword":
        return value === form.password ? "" : "Passwords do not match*";

      case "policy":
        return value ? "" : "You must accept the policy*";

      default:
        return "";
    }
  };

  const validateFieldSignIn = (name, value) => {
    switch (name) {
      case "email":
        return /\S+@\S+\.\S+/.test(value) ? "" : "Invalid email address*";
      
      case "password":
        return value.length >= 6 ? "" : "Password must be at least 6 characters*";

      case "policy":
        return value ? "" : "You must accept the policy*";

      default:
        return "";
    }
  };

  // --- Handle input change ---
  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    const fieldValue = type === "checkbox" ? checked : value;

    setForm((prev) => ({
      ...prev,
      [name]: fieldValue,
    }));

    // Validate field on change
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name, fieldValue),
    }));
  };

   // --- Handle input change ---
  const handleChangeSign = (e) => {
    const { name, type, value, checked } = e.target;
    const fieldValue = type === "checkbox" ? checked : value;

    setForm((prev) => ({
      ...prev,
      [name]: fieldValue,
    }));

    // Validate field on change
    setErrors((prev) => ({
      ...prev,
      [name]: validateFieldSignIn(name, fieldValue),
    }));
  };

  // --- Validate all fields before submit ---
  const validateForm = () => {
    const newErrors = {};
    for (const key in form) {
      const error = validateField(key, form[key]);
      if (error) newErrors[key] = error;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Validate all fields before submit ---
  const validateFormSignIn = () => {
    const newErrors = {};
    for (const key in form) {
      const error = validateFieldSignIn (key, form[key]);
      if (error) newErrors[key] = error;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { form, errors, handleChange, validateForm, setForm, handleChangeSign,validateFormSignIn };
}
