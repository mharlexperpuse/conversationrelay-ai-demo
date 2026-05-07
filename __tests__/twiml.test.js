/**
 * Tests for /api/twiml endpoint.
 */

import handler from "../pages/api/twiml";

// Mock environment
beforeAll(() => {
  process.env.NGROK_URL = "test.ngrok.app";
  process.env.NODE_ENV = "test";
});

function createMockReq(query = {}) {
  return {
    query,
    headers: {},
    body: {},
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    json(data) {
      this.body = JSON.stringify(data);
      return this;
    },
  };
  return res;
}

describe("/api/twiml", () => {
  test("returns valid TwiML XML", () => {
    const req = createMockReq({ mode: "support" });
    const res = createMockRes();

    handler(req, res);

    expect(res.headers["Content-Type"]).toBe("text/xml");
    expect(res.body).toContain('<?xml version="1.0"');
    expect(res.body).toContain("<Response>");
    expect(res.body).toContain("<Connect>");
    expect(res.body).toContain("<ConversationRelay");
  });

  test("uses correct WebSocket URL", () => {
    const req = createMockReq({});
    const res = createMockRes();

    handler(req, res);

    expect(res.body).toContain('url="wss://test.ngrok.app/ws"');
  });

  test("support mode shows support greeting", () => {
    const req = createMockReq({ mode: "support" });
    const res = createMockRes();

    handler(req, res);

    expect(res.body).toContain("How can I help you today?");
  });

  test("booking mode shows booking greeting", () => {
    const req = createMockReq({ mode: "booking" });
    const res = createMockRes();

    handler(req, res);

    expect(res.body).toContain("book an appointment");
    expect(res.body).toContain("What day works best");
  });

  test("defaults to support mode when no mode specified", () => {
    const req = createMockReq({});
    const res = createMockRes();

    handler(req, res);

    expect(res.body).toContain("How can I help you today?");
  });

  test("includes ElevenLabs config when voice param provided", () => {
    const voiceConfig = "ZF6FPAbjXT4488VcRRnw-flash_v2_5-1.0_0.5_0.75";
    const req = createMockReq({ voice: encodeURIComponent(voiceConfig) });
    const res = createMockRes();

    handler(req, res);

    expect(res.body).toContain('ttsProvider="ElevenLabs"');
    expect(res.body).toContain(`voice="${voiceConfig}"`);
  });

  test("omits ElevenLabs config when no voice param", () => {
    const req = createMockReq({});
    const res = createMockRes();

    handler(req, res);

    expect(res.body).not.toContain("ttsProvider");
    expect(res.body).not.toContain('voice="');
  });
});
