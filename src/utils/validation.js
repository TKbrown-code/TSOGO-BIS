// Form validation utilities
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
};

export const validatePassword = (password) => {
  return password.length >= 8;
};

export const validateRequired = (value) => {
  return value && value.toString().trim().length > 0;
};

export const validateMinLength = (value, minLength) => {
  return value && value.toString().length >= minLength;
};

export const validateMaxLength = (value, maxLength) => {
  return value && value.toString().length <= maxLength;
};

export const validateNumber = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

export const validatePositiveNumber = (value) => {
  return validateNumber(value) && parseFloat(value) > 0;
};

export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Form validation schemas
export const validationSchemas = {
  email: {
    validate: validateEmail,
    message: "Please enter a valid email address"
  },
  phone: {
    validate: validatePhone,
    message: "Please enter a valid phone number"
  },
  password: {
    validate: validatePassword,
    message: "Password must be at least 8 characters long"
  },
  required: {
    validate: validateRequired,
    message: "This field is required"
  },
  positiveNumber: {
    validate: validatePositiveNumber,
    message: "Please enter a positive number"
  },
  url: {
    validate: validateUrl,
    message: "Please enter a valid URL"
  }
};

// Validate form fields
export const validateForm = (formData, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const value = formData[field];
    const fieldRules = rules[field];
    
    for (const rule of fieldRules) {
      const validator = validationSchemas[rule];
      if (validator && !validator.validate(value)) {
        errors[field] = validator.message;
        break;
      }
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Note: React hooks should be defined in component files, not utility files
// The useFormValidation hook has been removed as it belongs in React components
