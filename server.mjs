import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const dev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sessions = new Map();

const SYSTEM_PROMPT = `You are Sofia, the WebLynxForge sales assistant on a live business phone call.
Be warm, natural, concise, and professional. Keep responses short because they are spoken aloud.
LANGUAGE RULE: The caller may use English, Mexican Spanish, or Tagalog/Filipino. Once the caller chooses a language, speak naturally in that language. Do not translate every sentence into all three languages. If the caller asks to change language later, continue in the newly requested language.
WebLynxForge provides a managed business website service for $99 per month. WebLynxForge handles the website work; never tell the customer to build, code, configure hosting, install software, or use a website builder.
Do not invent fees, discounts, guarantees, completion dates, policies, or products.
Do not proactively discuss being AI. If directly asked whether you are AI or automated, answer briefly and truthfully, then return to the business purpose. Never claim to be human.
When the customer is interested, ask only the minimum business questions needed. Do not say that a team member will contact them later.
CLOSING RULE: When the customer clearly agrees to proceed with the $99/month service, offer to send the secure checkout link to the same phone number. The verbal SMS consent must match the registered flow: explain that WebLynxForge will send the requested checkout and related service updates, message frequency varies, message and data rates may apply, reply HELP for help or STOP to opt out, and state Terms https://weblynxforge.dev/terms.php and Privacy https://weblynxforge.dev/privacy.php. Ask for an explicit yes or no. Only after the customer explicitly says yes to receiving the text, call the send_checkout_link tool. Never call it merely because they said yes to buying the website.
After the tool reports checkout_sent or already_sent, say: "Perfect. I just sent the secure WebLynxForge checkout link to this number. It's ninety-nine dollars per month."
If the tool reports sms_not_enabled, do not claim a text was sent. Say the checkout text service is not active yet and continue politely.`;

const tools = [{
  type: "function",
  function: {
    name: "send_checkout_link",
    description: "Send the unique WebLynxForge $99/month Stripe checkout link by SMS. Use only after the customer explicitly consents to receive the SMS during this call.",
    parameters: {
      type: "object",
      properties: { sms_consent_confirmed: { type: "boolean" } },
      required: ["sms_consent_confirmed"],
      additionalProperties: false
    }
  }
}];

async function sendCheckoutLink(ctx) {
  if (!ctx?.leadId || !ctx?.closeToken || !ctx?.closeEndpoint) return { ok:false, error:"missing_lead_context" };
  const res = await fetch(ctx.closeEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: Number(ctx.leadId), close_token: ctx.closeToken })
  });
  let data = {};
  try { data = await res.json(); } catch { data = { ok:false, error:"invalid_close_response" }; }
  return { http_status: res.status, ...data };
}

async function runAssistant(conversation, ctx) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role:"system", content:SYSTEM_PROMPT }, ...conversation],
    tools,
    tool_choice: "auto",
    max_tokens: 180,
    temperature: 0.7
  });
  const msg = response.choices[0].message;
  if (!msg.tool_calls?.length) return { text: msg.content || "Could you say that again?", message: msg };

  conversation.push(msg);
  for (const call of msg.tool_calls) {
    let result = { ok:false, error:"unknown_tool" };
    if (call.function?.name === "send_checkout_link") {
      let args = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch {}
      result = args.sms_consent_confirmed === true ? await sendCheckoutLink(ctx) : { ok:false, error:"sms_consent_not_confirmed" };
    }
    conversation.push({ role:"tool", tool_call_id:call.id, content:JSON.stringify(result) });
  }
  const follow = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role:"system", content:SYSTEM_PROMPT }, ...conversation],
    tools,
    tool_choice: "none",
    max_tokens: 100,
    temperature: 0.4
  });
  return { text: follow.choices[0].message.content || "Thank you.", message: follow.choices[0].message };
}


const LANGUAGE_MAP = {
  "en-US": { label:"English", ready:"Absolutely. How can I help you today?" },
  "es-MX": { label:"Mexican Spanish", ready:"Claro. ¿Cómo puedo ayudarle hoy?" },
  "fil-PH": { label:"Tagalog", ready:"Sige. Paano kita matutulungan ngayon?" }
};

function requestedLanguage(text="") {
  const q = text.toLowerCase().trim();
  if (/\b(tagalog|filipino|pilipino)\b/.test(q)) return "fil-PH";
  if (/\b(espa[nñ]ol|spanish|mexican|méxico|mexico)\b/.test(q)) return "es-MX";
  if (/\b(english|ingles|inglés)\b/.test(q)) return "en-US";
  return "";
}

function switchLanguage(ws, code, announce=true) {
  if (!LANGUAGE_MAP[code]) return false;
  ws.ctx.language = code;
  ws.ctx.languageSelected = true;
  ws.send(JSON.stringify({ type:"language", ttsLanguage:code, transcriptionLanguage:code }));
  if (announce) ws.send(JSON.stringify({ type:"text", token:LANGUAGE_MAP[code].ready, lang:code, last:true }));
  console.log("Language switched:", ws.callSid, code);
  return true;
}

const app = next({ dev });
const handle = app.getRequestHandler();
app.prepare().then(() => {
  const server = createServer((req,res) => handle(req,res,parse(req.url,true)));
  const wss = new WebSocketServer({ server, path:"/ws" });

  wss.on("connection", ws => {
    ws.callSid = null;
    ws.ctx = {};
    ws.on("message", async data => {
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (message.type === "setup") {
        ws.callSid = message.callSid;
        const cp = message.customParameters || {};
        ws.ctx = {
          leadId: cp.lead_id || "",
          calledPhone: cp.called_phone || "",
          businessName: cp.business_name || "",
          contactName: cp.contact_name || "",
          closeEndpoint: cp.close_endpoint || "",
          closeToken: cp.close_token || "",
          callMode: cp.call_mode || "outbound",
          language: "en-US",
          languageSelected: cp.call_mode !== "inbound"
        };
        const context = [];
        if (ws.ctx.businessName) context.push(`Business: ${ws.ctx.businessName}`);
        if (ws.ctx.contactName) context.push(`Contact: ${ws.ctx.contactName}`);
        sessions.set(ws.callSid, context.length ? [{ role:"system", content:"Lead context for this call: "+context.join("; ") }] : []);
        console.log("Setup for call:", ws.callSid, "lead:", ws.ctx.leadId || "none");
        return;
      }
      if (message.type === "dtmf" && ws.ctx.callMode === "inbound") {
        const code = message.digit === "1" ? "en-US" : message.digit === "2" ? "es-MX" : message.digit === "3" ? "fil-PH" : "";
        if (code) switchLanguage(ws, code, true);
        return;
      }
      if (message.type !== "prompt" || !message.voicePrompt || message.last === false) return;

      const requested = requestedLanguage(message.voicePrompt);
      if (ws.ctx.callMode === "inbound" && (!ws.ctx.languageSelected || requested)) {
        if (requested) {
          switchLanguage(ws, requested, true);
          return;
        }
        if (!ws.ctx.languageSelected) {
          ws.send(JSON.stringify({ type:"text", token:"Please say English, Español, or Tagalog. You can also press one, two, or three.", lang:"en-US", last:true }));
          return;
        }
      }

      const conversation = sessions.get(ws.callSid) || [];
      conversation.push({ role:"user", content:message.voicePrompt });
      try {
        const out = await runAssistant(conversation, ws.ctx);
        conversation.push({ role:"assistant", content:out.text });
        while (conversation.length > 20) conversation.shift();
        sessions.set(ws.callSid, conversation);
        ws.send(JSON.stringify({ type:"text", token:out.text, lang:ws.ctx.language || "en-US", last:true }));
        console.log("Response:", out.text);
      } catch (err) {
        console.error("Sofia error:", err);
        const errText = ws.ctx.language === "es-MX"
          ? "Lo siento, hubo un breve problema de conexión. ¿Puede repetirlo?"
          : ws.ctx.language === "fil-PH"
            ? "Paumanhin, nagkaroon ng saglit na problema sa koneksyon. Maaari mo bang ulitin?"
            : "I'm sorry, I had a brief connection problem. Could you say that again?";
        ws.send(JSON.stringify({ type:"text", token:errText, lang:ws.ctx.language || "en-US", last:true }));
      }
    });
    ws.on("close", () => { if (ws.callSid) sessions.delete(ws.callSid); });
  });
  server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});
