/**
 * Tests for /api/call endpoint.
 */

import handler from "../pages/api/call";

// Mock Twilio client
jest.mock("twilio", () => {
  return jest.fn(() => ({
    calls: {
      create: jest.fn().mockResolvedValue({ sid: "CA123456789" }),
    },
  }));
});

// Mock environment
beforeAll(() => {
  process.env.TWILIO_ACCOUNT_SID = "ACtest123";
  process.env.TWILIO_AUTH_TOKEN = "test_token";
  process.env.TWILIO_PHONE_NUMBER = "+15551234567";
  process.env.NGROK_URL = "test.ngrok.app";
});

function createMockReq(method, body = {}) {
  return {
    method,
    body,
    headers: {},
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe("/api/call", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects non-POST requests", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe("Method not allowed");
  });

  test("requires phone number", async () => {
    const req = createMockReq("POST", {});
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Missing phone number");
  });

  test("creates call with valid phone number", async () => {
    const req = createMockReq("POST", {
      to: "+15559876543",
      workflow: "Customer support",
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.callSid).toBe("CA123456789");
  });

  test("returns error when Twilio credentials missing", async () => {
    const originalSid = process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_ACCOUNT_SID;

    const req = createMockReq("POST", { to: "+15559876543" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Missing Twilio credentials");

    process.env.TWILIO_ACCOUNT_SID = originalSid;
  });

  test("returns error when NGROK_URL missing", async () => {
    const originalUrl = process.env.NGROK_URL;
    delete process.env.NGROK_URL;

    const req = createMockReq("POST", { to: "+15559876543" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Missing NGROK_URL");

    process.env.NGROK_URL = originalUrl;
  });

  test("maps workflow to correct mode", async () => {
    const twilio = require("twilio");
    const mockCreate = twilio().calls.create;

    const req = createMockReq("POST", {
      to: "+15559876543",
      workflow: "Appointment booking",
    });
    const res = createMockRes();

    await handler(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("mode=booking"),
      })
    );
  });

  test("includes voice params in URL", async () => {
    const twilio = require("twilio");
    const mockCreate = twilio().calls.create;

    const req = createMockReq("POST", {
      to: "+15559876543",
      voiceId: "test-voice",
      model: "turbo_v2_5",
      speed: 1.1,
      stability: 0.6,
      similarity: 0.8,
    });
    const res = createMockRes();

    await handler(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("voice="),
      })
    );
  });
});
