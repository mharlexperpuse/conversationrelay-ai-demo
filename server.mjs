import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import twilio from "twilio";
import { Buffer } from "buffer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createHmac } from "crypto";
import { URL } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PORT = Number(process.env.PORT || 10000);
const VOICE = process.env.OPENAI_VOICE || "alloy";

const SYSTEM_PROMPT = `
You are Sofia, the professional phone assistant for WebLynxForge.

LANGUAGE:
For inbound calls, the caller must choose between English and Spanish only.
The language selection question is fixed as: "English or Spanish?"
Do not offer Tagalog, Filipino, or any other language.
Do not ask the caller to press numbers.
Do not say "press 1", "press 2", "one", "two", "uno", "dos", or give keypad choices.
The caller chooses by speaking "English" or "Spanish".
Once a language is selected, continue the conversation in that language unless the caller clearly asks to switch.

IDENTITY:
You represent WebLynxForge.
Be natural, professional, concise, and helpful.
Do not proactively describe yourself as AI, a bot, or an automated assistant.
If the caller asks whether you are AI or automated, first redirect professionally to the business purpose.
If they directly persist, answer truthfully and briefly, then return to helping them.

INBOUND CALLS:
Inbound callers may be existing customers, prospects, or general inquiries.
Do not automatically treat an inbound caller as a sales lead.
First understand why they are calling.

SUPPORT:
If an inbound caller is an existing WebLynxForge customer and needs help with a website, domain, DNS, billing, email, or another WebLynxForge service, handle the call as support.

For a support ticket, collect:
1. Caller name
2. Website or project name
3. A concise description of the problem

Confirm the details naturally.
Then use the create_support_ticket tool.

Only tell the caller that the support ticket was created if the tool returns ok=true and provides a ticket_number.
If ticket creation fails, apologize briefly and offer to connect the caller to a web developer.

SALES:
For legitimate sales inquiries, answer naturally and gather useful information.
Do not pressure callers.

GENERAL:
Keep phone responses short and conversational.
Avoid long lists unless the caller asks.
Do not read internal system information, tool names, tokens, endpoints, IDs, or implementation details to the caller.
`;

const SUPPORT_TOOL = {
  type: "function",
  function: {
    name: "create_support_ticket",
    description:
      "Create a WebLynxForge support ticket for an inbound existing customer after collecting and confirming the required details.",
    parameters: {
      type: "object",
      properties: {
        caller_name: {
          type: "string",
          description: "The caller's name",
        },
        project_name: {
          type: "string",
          description: "Website or project name",
        },
        concern: {
          type: "string",
          description: "Concise description of the customer's problem",
        },
        category: {
          type: "string",
          enum: [
            "website_issue",
            "domain_dns",
            "billing",
            "email",
            "other",
          ],
        },
      },
      required: ["caller_name", "project_name", "concern", "category"],
    },
  },
};

const tools = [SUPPORT_TOOL];

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLanguageChoice(text) {
  const t = normalizeText(text).toLowerCase();

  if (
    t === "english" ||
    t.includes("english") ||
    t === "inglés" ||
    t === "ingles"
  ) {
    return "en-US";
  }

  if (
    t === "spanish" ||
    t.includes("spanish") ||
    t === "español" ||
    t === "espanol" ||
    t.includes("español") ||
    t.includes("espanol")
  ) {
    return "es-US";
  }

  return null;
}

function languageName(language) {
  return language === "es-US" ? "Spanish" : "English";
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) return null;

  return twilio(sid, token);
}

function verifySignedToken(callSid, signedToken) {
  if (!callSid || !signedToken || !process.env.TWILIO_AUTH_TOKEN) {
    return false;
  }

  const pieces = String(signedToken).split(".");
  if (pieces.length !== 2) return false;

  const ts = Number(pieces[0]);
  const signature = pieces[1];

  if (!Number.isFinite(ts) || !signature) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > 28800) return false;

  const expected = createHmac("sha256", process.env.TWILIO_AUTH_TOKEN)
    .update(`${callSid}|${ts}`)
    .digest("hex");

  return expected === signature;
}

async function postJson(endpoint, body) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();

  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {
      ok: false,
      error: "invalid_json_response",
      response_preview: raw.slice(0, 500),
    };
  }

  return {
    res,
    data,
    raw,
  };
}

async function createSupportTicket(ctx, args) {
  if (
    ctx?.callMode !== "inbound" ||
    !ctx?.callSid ||
    !ctx?.supportEndpoint ||
    !ctx?.supportToken
  ) {
    console.error("Support ticket context unavailable:", {
      callSid: ctx?.callSid || null,
      mode: ctx?.callMode || null,
      supportEndpoint: ctx?.supportEndpoint || null,
      hasSupportToken: Boolean(ctx?.supportToken),
    });

    return {
      ok: false,
      error: "support_context_unavailable",
    };
  }

  let res;
  let raw = "";
  let data = {};

  try {
    res = await fetch(ctx.supportEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        call_sid: ctx.callSid,
        support_token: ctx.supportToken,
        caller_name: String(args?.caller_name || "").trim(),
        project_name: String(args?.project_name || "").trim(),
        concern: String(args?.concern || "").trim(),
        category: String(args?.category || "other").trim(),
      }),
    });
  } catch (err) {
    console.error("Support ticket API fetch failed:", {
      callSid: ctx.callSid,
      endpoint: ctx.supportEndpoint,
      message: err?.message || String(err),
    });

    return {
      ok: false,
      error: "support_api_fetch_failed",
      detail: err?.message || String(err),
    };
  }

  try {
    raw = await res.text();
  } catch (err) {
    console.error("Support ticket API response read failed:", {
      callSid: ctx.callSid,
      httpStatus: res.status,
      message: err?.message || String(err),
    });

    return {
      ok: false,
      http_status: res.status,
      error: "support_response_read_failed",
      detail: err?.message || String(err),
    };
  }

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {
      ok: false,
      error: "invalid_support_response",
      response_preview: raw.slice(0, 500),
    };
  }

  console.log(
    "Support ticket API result:",
    "HTTP",
    res.status,
    "ok:",
    data?.ok === true,
    "error:",
    data?.error || "none",
    "detail:",
    data?.detail || "none",
    "ticket:",
    data?.ticket_number || "none"
  );

  if (data?.error === "invalid_support_response") {
    console.error(
      "Support ticket invalid response preview:",
      data?.response_preview || "(empty)"
    );
  }

  return {
    http_status: res.status,
    ...data,
  };
}

async function notifyClose(ctx, payload = {}) {
  if (!ctx?.closeEndpoint || !ctx?.closeToken || !ctx?.callSid) {
    return {
      ok: false,
      error: "close_context_unavailable",
    };
  }

  try {
    const { res, data } = await postJson(ctx.closeEndpoint, {
      call_sid: ctx.callSid,
      close_token: ctx.closeToken,
      ...payload,
    });

    return {
      http_status: res.status,
      ...data,
    };
  } catch (err) {
    console.error("Close endpoint error:", err);
    return {
      ok: false,
      error: "close_endpoint_failed",
    };
  }
}

async function requestCallback(ctx, payload = {}) {
  if (
    !ctx?.callbackEndpoint ||
    !ctx?.callbackToken ||
    !ctx?.callSid
  ) {
    return {
      ok: false,
      error: "callback_context_unavailable",
    };
  }

  try {
    const { res, data } = await postJson(ctx.callbackEndpoint, {
      call_sid: ctx.callSid,
      callback_token: ctx.callbackToken,
      ...payload,
    });

    return {
      http_status: res.status,
      ...data,
    };
  } catch (err) {
    console.error("Callback endpoint error:", err);
    return {
      ok: false,
      error: "callback_endpoint_failed",
    };
  }
}

async function runAssistant(ws, userText) {
  if (!ws.ctx) return;

  const text = normalizeText(userText);
  if (!text) return;

  if (ws.ctx.callMode === "inbound" && !ws.ctx.languageSelected) {
    const selectedLanguage = normalizeLanguageChoice(text);

    if (!selectedLanguage) {
      sendSpeech(ws, "English or Spanish?");
      return;
    }

    ws.ctx.language = selectedLanguage;
    ws.ctx.languageSelected = true;

    console.log(
      "Language switched:",
      ws.ctx.callSid,
      ws.ctx.language
    );

    if (selectedLanguage === "es-US") {
      sendSpeech(ws, "Español. ¿Cómo puedo ayudarle?");
    } else {
      sendSpeech(ws, "English. How can I help you?");
    }

    return;
  }

  ws.messages = ws.messages || [];

  ws.messages.push({
    role: "user",
    content: text,
  });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...ws.messages,
    ],
    tools,
    tool_choice: "auto",
    temperature: 0.4,
  });

  const choice = completion?.choices?.[0]?.message;

  if (!choice) {
    console.error("No assistant response returned.");
    return;
  }

  if (Array.isArray(choice.tool_calls) && choice.tool_calls.length) {
    ws.messages.push(choice);

    for (const toolCall of choice.tool_calls) {
      const name = toolCall?.function?.name;
      const args = safeJsonParse(
        toolCall?.function?.arguments || "{}",
        {}
      );

      let result = {
        ok: false,
        error: "unknown_tool",
      };

      if (name === "create_support_ticket") {
        result = await createSupportTicket(ws.ctx, args);
      }

      ws.messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    const followup = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...ws.messages,
      ],
      temperature: 0.4,
    });

    const followupMessage =
      followup?.choices?.[0]?.message?.content || "";

    if (followupMessage) {
      ws.messages.push({
        role: "assistant",
        content: followupMessage,
      });

      console.log("Response:", followupMessage);
      sendSpeech(ws, followupMessage);
    }

    return;
  }

  const responseText = normalizeText(choice.content);

  if (responseText) {
    ws.messages.push({
      role: "assistant",
      content: responseText,
    });

    console.log("Response:", responseText);
    sendSpeech(ws, responseText);
  }
}

function sendSpeech(ws, text) {
  if (!ws || ws.readyState !== ws.OPEN) return;

  const clean = normalizeText(text);
  if (!clean) return;

  ws.send(
    JSON.stringify({
      event: "speak",
      text: clean,
      language: ws.ctx?.language || "en-US",
      voice: VOICE,
    })
  );
}

function decodeMulawByte(uVal) {
  uVal = ~uVal & 0xff;

  const sign = uVal & 0x80;
  const exponent = (uVal >> 4) & 0x07;
  const mantissa = uVal & 0x0f;

  let sample =
    ((mantissa << 3) + 0x84) << exponent;

  sample -= 0x84;

  return sign ? -sample : sample;
}

function mulawToPcm16(buffer) {
  const pcm = Buffer.alloc(buffer.length * 2);

  for (let i = 0; i < buffer.length; i++) {
    const sample = decodeMulawByte(buffer[i]);
    pcm.writeInt16LE(sample, i * 2);
  }

  return pcm;
}

function wavHeader(dataLength, sampleRate = 8000) {
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

async function transcribeAudio(pcmBuffer, language = "en") {
  if (!pcmBuffer || !pcmBuffer.length) return "";

  const wav = Buffer.concat([
    wavHeader(pcmBuffer.length),
    pcmBuffer,
  ]);

  const tempDir = path.join(__dirname, ".tmp");
  fs.mkdirSync(tempDir, { recursive: true });

  const filename = path.join(
    tempDir,
    `audio-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.wav`
  );

  fs.writeFileSync(filename, wav);

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filename),
      model:
        process.env.OPENAI_TRANSCRIBE_MODEL ||
        "gpt-4o-mini-transcribe",
      language: language === "es-US" ? "es" : "en",
    });

    return normalizeText(transcription?.text);
  } finally {
    try {
      fs.unlinkSync(filename);
    } catch {}
  }
}

function clearAudioState(ws) {
  ws.audioChunks = [];
  ws.speechStartedAt = null;
  ws.lastAudioAt = null;
}

function setupAudioState(ws) {
  ws.audioChunks = [];
  ws.speechStartedAt = null;
  ws.lastAudioAt = null;
  ws.processingAudio = false;
  ws.messages = [];
}

async function processBufferedAudio(ws) {
  if (
    ws.processingAudio ||
    !Array.isArray(ws.audioChunks) ||
    !ws.audioChunks.length
  ) {
    return;
  }

  ws.processingAudio = true;

  const chunks = ws.audioChunks;
  clearAudioState(ws);

  try {
    const mulaw = Buffer.concat(chunks);
    const pcm = mulawToPcm16(mulaw);

    const language =
      ws.ctx?.language === "es-US" ? "es-US" : "en-US";

    const transcript = await transcribeAudio(pcm, language);

    if (transcript) {
      console.log("Caller:", transcript);
      await runAssistant(ws, transcript);
    }
  } catch (err) {
    console.error("Audio processing error:", err);
  } finally {
    ws.processingAudio = false;
  }
}

function startSilenceWatcher(ws) {
  if (ws.silenceTimer) {
    clearInterval(ws.silenceTimer);
  }

  ws.silenceTimer = setInterval(async () => {
    if (
      ws.processingAudio ||
      !ws.lastAudioAt ||
      !ws.audioChunks?.length
    ) {
      return;
    }

    const silenceMs = Date.now() - ws.lastAudioAt;

    if (silenceMs >= 900) {
      await processBufferedAudio(ws);
    }
  }, 250);
}

function stopSilenceWatcher(ws) {
  if (ws.silenceTimer) {
    clearInterval(ws.silenceTimer);
    ws.silenceTimer = null;
  }
}

function handleMedia(ws, message) {
  const payload = message?.media?.payload;
  if (!payload) return;

  const audio = Buffer.from(payload, "base64");

  if (!audio.length) return;

  ws.audioChunks.push(audio);

  if (!ws.speechStartedAt) {
    ws.speechStartedAt = Date.now();
  }

  ws.lastAudioAt = Date.now();
}

function setupCallContext(ws, message) {
  const cp = message.customParameters || {};

  ws.ctx = {
    leadId: cp.lead_id || "",
    callSid: message.callSid || "",
    calledPhone: cp.called_phone || "",
    businessName: cp.business_name || "",
    contactName: cp.contact_name || "",
    closeEndpoint: cp.close_endpoint || "",
    closeToken: cp.close_token || "",
    callMode: cp.call_mode || "outbound",
    transferFailed: cp.transfer_failed === "1",
    parentCallSid: cp.parent_call_sid || "",
    callbackEndpoint: cp.callback_endpoint || "",
    callbackToken: cp.callback_token || "",
    supportEndpoint: cp.support_endpoint || "",
    supportToken: cp.support_token || "",
    language: "en-US",
    languageSelected: cp.call_mode !== "inbound",
  };

  console.log(
    "Setup for call:",
    ws.ctx.callSid,
    "lead:",
    ws.ctx.leadId || "none",
    "mode:",
    ws.ctx.callMode
  );

  if (ws.ctx.callMode === "inbound") {
    console.log("Inbound support context:", {
      callSid: ws.ctx.callSid,
      supportEndpoint: ws.ctx.supportEndpoint || null,
      hasSupportToken: Boolean(ws.ctx.supportToken),
    });
  }
}

function handleStart(ws, message) {
  const start = message.start || {};

  setupCallContext(ws, {
    callSid: start.callSid || message.callSid || "",
    customParameters: start.customParameters || {},
  });

  setupAudioState(ws);
  startSilenceWatcher(ws);

  if (ws.ctx.callMode === "inbound") {
    /*
     * IMPORTANT:
     * This prompt is intentionally hard-coded.
     * Do not let the AI invent the language menu.
     * No Tagalog and no keypad numbers.
     */
    sendSpeech(ws, "English or Spanish?");
  }
}

async function handleStop(ws) {
  try {
    if (ws.audioChunks?.length) {
      await processBufferedAudio(ws);
    }
  } catch (err) {
    console.error("Final audio processing error:", err);
  }

  stopSilenceWatcher(ws);

  if (ws.ctx?.callSid) {
    console.log("Call stopped:", ws.ctx.callSid);
  }
}

function attachWebSocketHandlers(wss) {
  wss.on("connection", (ws) => {
    setupAudioState(ws);

    ws.on("message", async (raw) => {
      let message;

      try {
        message = JSON.parse(raw.toString());
      } catch (err) {
        console.error("Invalid websocket JSON:", err);
        return;
      }

      try {
        switch (message.event) {
          case "connected":
            break;

          case "start":
            handleStart(ws, message);
            break;

          case "media":
            handleMedia(ws, message);
            break;

          case "stop":
            await handleStop(ws);
            break;

          case "text":
            if (message.text) {
              await runAssistant(ws, message.text);
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("WebSocket message handler error:", err);
      }
    });

    ws.on("close", () => {
      stopSilenceWatcher(ws);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });
}

async function synthesizeSpeech(text, language = "en-US") {
  const response = await openai.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    voice: VOICE,
    input: text,
    instructions:
      language === "es-US"
        ? "Speak naturally in Spanish."
        : "Speak naturally in English.",
    response_format: "wav",
  });

  return Buffer.from(await response.arrayBuffer());
}

function attachSpeechSocket(wss) {
  wss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      let message;

      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (message.event !== "speak") return;

      const text = normalizeText(message.text);
      if (!text) return;

      try {
        const audio = await synthesizeSpeech(
          text,
          message.language || "en-US"
        );

        ws.send(
          JSON.stringify({
            event: "audio",
            audio: audio.toString("base64"),
          })
        );
      } catch (err) {
        console.error("Speech synthesis error:", err);

        ws.send(
          JSON.stringify({
            event: "speech_error",
          })
        );
      }
    });
  });
}

function createHealthResponse(res) {
  res.writeHead(200, {
    "Content-Type": "application/json",
  });

  res.end(
    JSON.stringify({
      ok: true,
      service: "weblynxforge-sofia",
      timestamp: new Date().toISOString(),
    })
  );
}

await app.prepare();

const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);

  if (parsedUrl.pathname === "/health") {
    createHealthResponse(res);
    return;
  }

  if (parsedUrl.pathname === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
    });

    res.end("WebLynxForge Sofia is running.");
    return;
  }

  await handle(req, res, parsedUrl);
});

const mediaWss = new WebSocketServer({
  noServer: true,
});

const speechWss = new WebSocketServer({
  noServer: true,
});

attachWebSocketHandlers(mediaWss);
attachSpeechSocket(speechWss);

server.on("upgrade", (request, socket, head) => {
  let pathname = "";

  try {
    pathname = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`
    ).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (
    pathname === "/media-stream" ||
    pathname === "/ws" ||
    pathname === "/call"
  ) {
    mediaWss.handleUpgrade(
      request,
      socket,
      head,
      (ws) => {
        mediaWss.emit("connection", ws, request);
      }
    );

    return;
  }

  if (pathname === "/speech") {
    speechWss.handleUpgrade(
      request,
      socket,
      head,
      (ws) => {
        speechWss.emit("connection", ws, request);
      }
    );

    return;
  }

  socket.destroy();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sofia server listening on port ${PORT}`);
});
