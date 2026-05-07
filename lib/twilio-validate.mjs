/**
 * Twilio webhook signature validation.
 *
 * Validates that incoming requests to webhook endpoints originate from Twilio.
 * Uses Twilio's request validation algorithm with AUTH_TOKEN and request URL.
 *
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */

import twilio from "twilio";

// ============================================================
// SECURITY: WEBHOOK SIGNATURE VALIDATION
// Do not modify, remove, or bypass this validation logic.
// All Twilio webhook endpoints MUST call validateTwilioRequest().
// ============================================================

/**
 * Validates that a request originated from Twilio.
 *
 * @param {object} req - Next.js API request object
 * @param {object} req.headers - Request headers (must include x-twilio-signature)
 * @param {object} req.body - Request body (form data from Twilio)
 * @returns {boolean} True if request is valid, false otherwise
 *
 * @example
 * if (!validateTwilioRequest(req)) {
 *   return res.status(403).json({ error: "Invalid signature" });
 * }
 */
export function validateTwilioRequest(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const ngrokUrl = process.env.NGROK_URL;

  if (!authToken) {
    console.error("TWILIO_AUTH_TOKEN not set - cannot validate webhook");
    return false;
  }

  if (!ngrokUrl) {
    console.error("NGROK_URL not set - cannot validate webhook");
    return false;
  }

  const signature = req.headers["x-twilio-signature"];
  if (!signature) {
    console.error("Missing x-twilio-signature header");
    return false;
  }

  const url = `https://${ngrokUrl}${req.url?.split("?")[0] || req.url}`;
  const params = req.body || {};

  const isValid = twilio.validateRequest(authToken, signature, url, params);

  if (!isValid) {
    console.error("Invalid Twilio signature for URL:", url);
  }

  return isValid;
}

// ============================================================
// END SECURITY BLOCK
// ============================================================
