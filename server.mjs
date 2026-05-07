import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const dev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;
const SYSTEM_PROMPT = "You are a helpful assistant. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers. Do not include emojis, bullet points, or special symbols.";

const sessions = new Map();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function aiResponse(conversation) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...conversation],
  });
  return response.choices[0].message.content;
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("WebSocket connected");

    ws.on("message", async (data) => {
      const message = JSON.parse(data);

      if (message.type === "setup") {
        console.log("Setup for call:", message.callSid);
        ws.callSid = message.callSid;
        sessions.set(message.callSid, []);
      } else if (message.type === "prompt") {
        console.log("Prompt:", message.voicePrompt);
        const conversation = sessions.get(ws.callSid) || [];
        conversation.push({ role: "user", content: message.voicePrompt });

        try {
          const response = await aiResponse(conversation);
          conversation.push({ role: "assistant", content: response });
          ws.send(JSON.stringify({ type: "text", token: response, last: true }));
          console.log("Response:", response);
        } catch (err) {
          console.error("OpenAI error:", err);
          ws.send(JSON.stringify({ type: "text", token: "I hit an error. Please try again.", last: true }));
        }
      }
    });

    ws.on("close", () => {
      console.log("WebSocket closed");
      sessions.delete(ws.callSid);
    });
  });

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
