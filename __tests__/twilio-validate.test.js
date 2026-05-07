/**
 * Tests for Twilio webhook signature validation.
 */

import { validateTwilioRequest } from "../lib/twilio-validate.mjs";
import twilio from "twilio";

// Mock twilio.validateRequest
jest.mock("twilio", () => ({
  validateRequest: jest.fn(),
}));

beforeAll(() => {
  process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
  process.env.NGROK_URL = "test.ngrok.app";
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("validateTwilioRequest", () => {
  test("returns false when AUTH_TOKEN not set", () => {
    const originalToken = process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_AUTH_TOKEN;

    const req = {
      headers: { "x-twilio-signature": "valid-sig" },
      body: {},
      url: "/api/twiml",
    };

    const result = validateTwilioRequest(req);

    expect(result).toBe(false);
    process.env.TWILIO_AUTH_TOKEN = originalToken;
  });

  test("returns false when NGROK_URL not set", () => {
    const originalUrl = process.env.NGROK_URL;
    delete process.env.NGROK_URL;

    const req = {
      headers: { "x-twilio-signature": "valid-sig" },
      body: {},
      url: "/api/twiml",
    };

    const result = validateTwilioRequest(req);

    expect(result).toBe(false);
    process.env.NGROK_URL = originalUrl;
  });

  test("returns false when signature header missing", () => {
    const req = {
      headers: {},
      body: {},
      url: "/api/twiml",
    };

    const result = validateTwilioRequest(req);

    expect(result).toBe(false);
  });

  test("calls twilio.validateRequest with correct params", () => {
    twilio.validateRequest.mockReturnValue(true);

    const req = {
      headers: { "x-twilio-signature": "test-signature" },
      body: { CallSid: "CA123", From: "+15551234567" },
      url: "/api/twiml?mode=support",
    };

    validateTwilioRequest(req);

    expect(twilio.validateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "test-signature",
      "https://test.ngrok.app/api/twiml",
      { CallSid: "CA123", From: "+15551234567" }
    );
  });

  test("returns true when signature is valid", () => {
    twilio.validateRequest.mockReturnValue(true);

    const req = {
      headers: { "x-twilio-signature": "valid-sig" },
      body: {},
      url: "/api/twiml",
    };

    const result = validateTwilioRequest(req);

    expect(result).toBe(true);
  });

  test("returns false when signature is invalid", () => {
    twilio.validateRequest.mockReturnValue(false);

    const req = {
      headers: { "x-twilio-signature": "invalid-sig" },
      body: {},
      url: "/api/twiml",
    };

    const result = validateTwilioRequest(req);

    expect(result).toBe(false);
  });

  test("strips query params from URL for validation", () => {
    twilio.validateRequest.mockReturnValue(true);

    const req = {
      headers: { "x-twilio-signature": "sig" },
      body: {},
      url: "/api/twiml?mode=booking&voice=test",
    };

    validateTwilioRequest(req);

    expect(twilio.validateRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "https://test.ngrok.app/api/twiml",
      expect.anything()
    );
  });
});
