// ============================================================
//  API Middleware - Authentication, Rate Limiting, Validation
//  Protects endpoints from abuse and ensures request integrity
// ============================================================

/**
 * Simple rate limiting store (in production, use Redis)
 * Tracks requests per session_id or IP
 */
const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 * Limits requests per session/IP to prevent abuse
 *
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {number} maxRequests - Max requests allowed per window (default: 20)
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns {boolean} - true if request allowed, false if rate limited
 */
export function checkRateLimit(req, res, maxRequests = 20, windowMs = 60000) {
  const key = req.body?.session_id || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }

  const requests = rateLimitStore.get(key);

  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  rateLimitStore.set(key, validRequests);

  if (validRequests.length >= maxRequests) {
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Max ${maxRequests} requests per ${Math.round(windowMs / 1000)} seconds.`,
      retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
    });
    return false;
  }

  validRequests.push(now);
  return true;
}

/**
 * Request validation middleware
 * Validates required fields and types
 *
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Array} requiredFields - Array of required field names
 * @returns {boolean} - true if valid, false if invalid
 */
export function validateRequest(req, res, requiredFields = []) {
  const body = req.body || {};
  const missing = [];

  requiredFields.forEach(field => {
    if (!body[field]) {
      missing.push(field);
    }
  });

  if (missing.length > 0) {
    res.status(400).json({
      error: 'Missing required fields',
      missing: missing,
      message: `Required fields: ${missing.join(', ')}`
    });
    return false;
  }

  return true;
}

/**
 * Sanitize user input to prevent injection attacks
 *
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 5000); // Limit input length to 5000 chars
}

/**
 * Validate bankroll value
 *
 * @param {number} bankroll - Bankroll amount
 * @returns {boolean} - true if valid, false if invalid
 */
export function validateBankroll(bankroll) {
  if (bankroll === null || bankroll === undefined) {
    return true; // Bankroll is optional
  }

  const amount = parseFloat(bankroll);

  if (isNaN(amount)) {
    return false;
  }

  // Bankroll must be between 10 and 1,000,000
  return amount >= 10 && amount <= 1000000;
}

/**
 * Validate language parameter
 *
 * @param {string} language - Language code
 * @returns {boolean} - true if valid, false if invalid
 */
export function validateLanguage(language) {
  const validLanguages = ['es', 'en'];
  return validLanguages.includes(language);
}

/**
 * Log API request (optional: can integrate with logging service)
 *
 * @param {string} endpoint - Endpoint name
 * @param {string} sessionId - Session ID
 * @param {Object} metadata - Additional metadata to log
 */
export function logRequest(endpoint, sessionId, metadata = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${endpoint} - Session: ${sessionId}`, metadata);
}

/**
 * Error response formatter
 * Standardizes error responses across API
 *
 * @param {Object} res - HTTP response
 * @param {number} statusCode - HTTP status code
 * @param {string} errorType - Type of error
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 */
export function sendError(res, statusCode = 500, errorType = 'Internal Error', message = '', details = {}) {
  res.status(statusCode).json({
    success: false,
    error: errorType,
    message: message,
    ...details
  });
}

/**
 * Success response formatter
 * Standardizes success responses across API
 *
 * @param {Object} res - HTTP response
 * @param {Object} data - Data to return
 * @param {string} message - Success message (optional)
 */
export function sendSuccess(res, data = {}, message = '') {
  res.status(200).json({
    success: true,
    message: message,
    ...data
  });
}

/**
 * Check if request is from valid origin
 * Prevents CORS-based attacks
 *
 * @param {string} origin - Request origin
 * @returns {boolean} - true if valid origin
 */
export function isValidOrigin(origin) {
  const allowedOrigins = [
    'https://mundial2026-analytics.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  return allowedOrigins.includes(origin);
}
