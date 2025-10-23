/**
 * Security Testing Utilities
 * Use these to test your sanitization and validation functions
 * 
 * ⚠️ FOR TESTING PURPOSES ONLY - DO NOT USE IN PRODUCTION CODE
 */

/**
 * XSS Attack Test Cases
 * Try these in your form inputs to verify sanitization works
 */
export const XSS_TEST_CASES = [
  // Basic script injection
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<svg/onload=alert("XSS")>',
  
  // Event handler injection
  '<body onload=alert("XSS")>',
  '<input onfocus=alert("XSS") autofocus>',
  '<select onfocus=alert("XSS") autofocus>',
  
  // JavaScript protocol
  '<a href="javascript:alert(\'XSS\')">Click me</a>',
  '<iframe src="javascript:alert(\'XSS\')"></iframe>',
  
  // HTML entity encoding bypass attempts
  '&lt;script&gt;alert("XSS")&lt;/script&gt;',
  '&#60;script&#62;alert("XSS")&#60;/script&#62;',
  
  // Case variation attempts
  '<ScRiPt>alert("XSS")</ScRiPt>',
  '<IMG SRC=javascript:alert("XSS")>',
  
  // Null byte injection
  '<script\x00>alert("XSS")</script>',
  
  // Unicode encoding
  '<script>alert\u0028"XSS"\u0029</script>',
  
  // Data URI
  '<img src="data:text/html,<script>alert(\'XSS\')</script>">',
];

/**
 * SQL Injection Test Cases
 * Try these in search inputs to verify query sanitization
 */
export const SQL_INJECTION_TEST_CASES = [
  // Basic SQL injection
  "' OR '1'='1",
  "' OR 1=1--",
  "admin'--",
  "' OR 'a'='a",
  
  // Union-based injection
  "' UNION SELECT NULL--",
  "' UNION SELECT password FROM users--",
  
  // Time-based blind injection
  "'; WAITFOR DELAY '00:00:05'--",
  "' OR SLEEP(5)--",
  
  // Boolean-based blind injection
  "' AND 1=1--",
  "' AND 1=2--",
  
  // Comment injection
  "admin'/*",
  "admin'#",
  
  // Stacked queries
  "'; DROP TABLE users--",
  "'; DELETE FROM products--",
  
  // Special characters
  "%'; DROP TABLE products--",
  "\\'; DROP TABLE users--",
];

/**
 * Path Traversal Test Cases
 * Test file upload and path handling
 */
export const PATH_TRAVERSAL_TEST_CASES = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '....//....//....//etc/passwd',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
];

/**
 * Command Injection Test Cases
 */
export const COMMAND_INJECTION_TEST_CASES = [
  '; ls -la',
  '| cat /etc/passwd',
  '`whoami`',
  '$(whoami)',
  '& dir',
  '&& cat /etc/passwd',
];

/**
 * Email Validation Test Cases
 */
export const EMAIL_TEST_CASES = {
  valid: [
    'user@example.com',
    'user.name@example.com',
    'user+tag@example.co.uk',
    'user_name@example-domain.com',
  ],
  invalid: [
    'invalid.email',
    '@example.com',
    'user@',
    'user @example.com',
    'user@example',
    'user@.com',
    '<script>alert("XSS")</script>@example.com',
  ],
};

/**
 * Phone Number Test Cases
 */
export const PHONE_TEST_CASES = {
  valid: [
    '+1234567890',
    '1234567890',
    '+12345678901234',
  ],
  invalid: [
    '123',
    'abcdefghij',
    '+123abc456',
    '12345',
    '+12345678901234567890', // too long
    '<script>alert("XSS")</script>',
  ],
};

/**
 * Password Test Cases
 */
export const PASSWORD_TEST_CASES = {
  weak: [
    '123456',
    'password',
    'abc123',
    'qwerty',
    '12345678', // no uppercase, special chars
  ],
  strong: [
    'MyP@ssw0rd!',
    'Str0ng!Pass',
    'C0mpl3x#Pass',
    'S3cur3$Password',
  ],
};

/**
 * Test Sanitization Function
 * @param {Function} sanitizeFn - The sanitization function to test
 * @param {Array} testCases - Array of test cases
 * @param {string} testName - Name of the test
 */
export const testSanitization = (sanitizeFn, testCases, testName = 'Sanitization') => {
  console.group(`🧪 ${testName} Test`);
  
  testCases.forEach((testCase, index) => {
    const result = sanitizeFn(testCase);
    const isSafe = !result.includes('<script') && 
                   !result.includes('javascript:') && 
                   !result.includes('onerror=') &&
                   !result.includes('onload=');
    
    console.log(`Test ${index + 1}:`, {
      input: testCase,
      output: result,
      safe: isSafe ? '✅' : '❌',
    });
  });
  
  console.groupEnd();
};

/**
 * Test Rate Limiting
 * @param {Function} actionFn - The function to test (e.g., search)
 * @param {number} attempts - Number of attempts to make
 */
export const testRateLimit = async (actionFn, attempts = 15) => {
  console.group('🧪 Rate Limiting Test');
  console.log(`Making ${attempts} rapid requests...`);
  
  const results = [];
  for (let i = 0; i < attempts; i++) {
    try {
      const startTime = Date.now();
      await actionFn();
      const endTime = Date.now();
      results.push({
        attempt: i + 1,
        success: true,
        time: endTime - startTime,
      });
      console.log(`✅ Attempt ${i + 1}: Success`);
    } catch (error) {
      results.push({
        attempt: i + 1,
        success: false,
        error: error.message,
      });
      console.log(`❌ Attempt ${i + 1}: Blocked - ${error.message}`);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const blockedCount = results.filter(r => !r.success).length;
  
  console.log('\n📊 Results:');
  console.log(`Total Attempts: ${attempts}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Blocked: ${blockedCount}`);
  console.log(`Block Rate: ${((blockedCount / attempts) * 100).toFixed(2)}%`);
  
  console.groupEnd();
  return results;
};

/**
 * Test Error Boundary
 * Intentionally throw an error to test ErrorBoundary component
 */
export const triggerErrorBoundaryTest = () => {
  throw new Error('🧪 Test Error: This is an intentional error to test ErrorBoundary');
};

/**
 * Component to test Error Boundary
 * Note: This component should be defined in a React component file, not a utility file
 */
// export const ErrorBoundaryTestComponent = () => {
//   const [shouldError, setShouldError] = React.useState(false);
//   
//   if (shouldError) {
//     throw new Error('🧪 ErrorBoundary Test: Component crashed intentionally');
//   }
//   
//   return (
//     <div style={{ padding: '20px', border: '2px dashed orange', margin: '10px' }}>
//       <h3>Error Boundary Test Component</h3>
//       <p>Click the button below to trigger an error and test the ErrorBoundary:</p>
//       <button 
//         onClick={() => setShouldError(true)}
//         style={{
//           padding: '10px 20px',
//           backgroundColor: '#ff4444',
//           color: 'white',
//           border: 'none',
//           borderRadius: '5px',
//           cursor: 'pointer',
//         }}
//       >
//         Trigger Error
//       </button>
//     </div>
//   );
// };

/**
 * Usage Examples in Browser Console:
 * 
 * // Test XSS sanitization
 * import { sanitizeHTML } from './sanitize';
 * import { XSS_TEST_CASES, testSanitization } from './testSecurity';
 * testSanitization(sanitizeHTML, XSS_TEST_CASES, 'XSS Protection');
 * 
 * // Test SQL injection protection
 * import { sanitizeSearchQuery } from './sanitize';
 * import { SQL_INJECTION_TEST_CASES } from './testSecurity';
 * testSanitization(sanitizeSearchQuery, SQL_INJECTION_TEST_CASES, 'SQL Injection Protection');
 * 
 * // Test rate limiting
 * import { testRateLimit } from './testSecurity';
 * testRateLimit(() => {
 *   // Your search function here
 *   return fetch('/api/search?q=test');
 * }, 15);
 */

export default {
  XSS_TEST_CASES,
  SQL_INJECTION_TEST_CASES,
  PATH_TRAVERSAL_TEST_CASES,
  COMMAND_INJECTION_TEST_CASES,
  EMAIL_TEST_CASES,
  PHONE_TEST_CASES,
  PASSWORD_TEST_CASES,
  testSanitization,
  testRateLimit,
  triggerErrorBoundaryTest,
};
