/**
 * Input Sanitization Utilities
 * Protects against XSS and injection attacks
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized string
 */
export const sanitizeHTML = (input) => {
  if (typeof input !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return input.replace(/[&<>"'/]/g, (char) => map[char]);
};

/**
 * Sanitize text input (remove control characters, trim)
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized string
 */
export const sanitizeText = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove control characters except newline and tab
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
};

/**
 * Validate and sanitize email
 * @param {string} email - Email input
 * @returns {string|null} - Valid email or null
 */
export const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return null;
  
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(trimmed) ? trimmed : null;
};

/**
 * Validate and sanitize phone number
 * @param {string} phone - Phone input
 * @returns {string|null} - Valid phone or null
 */
export const sanitizePhone = (phone) => {
  if (typeof phone !== 'string') return null;
  
  // Remove all non-digit characters except + at start
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Basic validation: 10-15 digits, optional + prefix
  const phoneRegex = /^\+?\d{10,15}$/;
  
  return phoneRegex.test(cleaned) ? cleaned : null;
};

/**
 * Sanitize search query
 * @param {string} query - Search query
 * @returns {string} - Sanitized query
 */
export const sanitizeSearchQuery = (query) => {
  if (typeof query !== 'string') return '';
  
  // Remove special SQL characters and limit length
  return query
    .replace(/[%;\\]/g, '')
    .trim()
    .substring(0, 100);
};

/**
 * Validate password strength
 * @param {string} password - Password input
 * @returns {object} - {isValid: boolean, errors: string[]}
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize numeric input
 * @param {any} input - Numeric input
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number|null} - Valid number or null
 */
export const sanitizeNumber = (input, min = -Infinity, max = Infinity) => {
  const num = Number(input);
  
  if (isNaN(num)) return null;
  if (num < min || num > max) return null;
  
  return num;
};

/**
 * Sanitize URL
 * @param {string} url - URL input
 * @returns {string|null} - Valid URL or null
 */
export const sanitizeURL = (url) => {
  if (typeof url !== 'string') return null;
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
};

/**
 * Rate limiting helper (client-side)
 * @param {string} key - Unique key for the action
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - True if action is allowed
 */
export const checkRateLimit = (key, maxAttempts = 5, windowMs = 60000) => {
  const now = Date.now();
  const storageKey = `rateLimit_${key}`;
  
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{"attempts":[],"blocked":false}');
    
    // Remove old attempts outside the window
    data.attempts = data.attempts.filter(time => now - time < windowMs);
    
    // Check if blocked
    if (data.blocked && data.blockedUntil > now) {
      return false;
    }
    
    // Check if exceeded max attempts
    if (data.attempts.length >= maxAttempts) {
      data.blocked = true;
      data.blockedUntil = now + windowMs;
      localStorage.setItem(storageKey, JSON.stringify(data));
      return false;
    }
    
    // Add current attempt
    data.attempts.push(now);
    data.blocked = false;
    localStorage.setItem(storageKey, JSON.stringify(data));
    
    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return true; // Fail open
  }
};
