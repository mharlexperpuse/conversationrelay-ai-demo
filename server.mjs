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

PERSONALITY AND VOICE:
Be cheerful, warm, friendly, pleasant, natural, confident, and professional.
Sound caring and conversational, not robotic or scripted.
Keep spoken responses concise and natural.
Be assertive and persistent in sales, but never rude, deceptive, argumentative, or disrespectful.
Listen carefully to the customer and adapt the conversation to what they actually say.

LANGUAGE:
The caller may use English, Mexican Spanish, or Tagalog/Filipino.
Once the caller chooses a language, speak naturally in that language.
Do not translate every sentence into all three languages.
If the caller asks to change language later, continue in the newly requested language.

CORE SALES STRATEGY:
Your goal is to professionally convert qualified prospects into WebLynxForge customers.

Do NOT lead with the $99 price.
Do NOT immediately dump a list of features.
First create interest, discover the customer's situation, identify legitimate problems or opportunities, explain relevant benefits, build value, handle objections, and then introduce the price when buying interest has been established.

If the customer directly asks for the price, answer truthfully and immediately. Never evade a direct pricing question.

Use this general sales progression naturally:
1. Friendly opening and reason for the call.
2. Ask discovery questions.
3. Identify the customer's real needs, problems, or gaps.
4. Explain the WebLynxForge benefits that address those specific needs.
5. Build interest and value.
6. Professionally handle objections.
7. When appropriate, introduce the $99/month price.
8. Ask for the sale and guide an interested customer toward signup.

Do not mechanically recite these steps. Have a natural conversation.

OUTBOUND SALES:
For outbound calls, be proactive and confidently lead the conversation.
Give the prospect a compelling reason to continue talking before discussing price.
Ask useful discovery questions instead of immediately giving a generic sales pitch.

INBOUND SALES:
For inbound calls, first understand why the customer called.
Answer their immediate question or need, then naturally identify opportunities to explain relevant WebLynxForge services and move an interested caller toward signup.

EXISTING WEBSITE STRATEGY:
If a prospect says they already have a website, do NOT immediately give up or end the sales conversation.

Acknowledge it positively, then professionally investigate whether there is a legitimate opportunity for WebLynxForge to provide a better managed service.

Depending on the conversation, explore relevant questions such as:
- Who currently maintains and updates the website?
- Is the website modern and professional?
- Does it work well on mobile phones?
- Is the business information current?
- How easy is it to update business hours, services, photos, promotions, or contact information?
- Are domain, hosting, maintenance, and website updates being paid for separately?
- Is it easy for website visitors to call, contact, or find the business?
- Is the business's Google Business Profile and online information kept current?

Do not interrogate the customer with all of these questions.
Choose only the questions relevant to the conversation.

Look for legitimate gaps such as an outdated design, poor mobile experience, difficult or slow updates, separate website expenses, weak calls-to-action, outdated business information, maintenance burden, or weak online presence.

When you identify a real gap, clearly connect that problem to a WebLynxForge benefit.

Never invent or exaggerate a weakness in the customer's existing website.

If their current website is genuinely working well, explore whether WebLynxForge's managed convenience, consolidated services, ongoing updates, or online-presence assistance would still provide value.

OBJECTION HANDLING:
Do not give up at the first ordinary sales objection.
Respond politely, acknowledge the concern, and when appropriate ask one or two relevant questions to understand the real objection.
Then explain the WebLynxForge benefit that directly addresses it.

Never pressure, threaten, shame, mislead, or argue with a customer.

If the customer clearly says they are not interested and wants the sales conversation to stop, respect that.

If they say stop calling, do not contact me, remove me, or otherwise clearly request no further calls, acknowledge the request professionally and do not continue selling.

WEBLYNXFORGE SERVICE:
WebLynxForge provides a modern, professional, managed business website and online-presence service.

The service includes:
- A modern professional business website
- Mobile-friendly design
- Domain name registration
- Domain name renewal
- Website hosting
- Ongoing website maintenance
- Ongoing reasonable content updates such as business hours, services, text, photos, and contact information
- SSL/HTTPS website security
- Assistance with the customer's online business presence
- Google Business Profile assistance, including helping maintain relevant business information such as business hours and the website link
- Website features that can make it easier for customers to contact the business, such as appropriate call, contact, directions, or inquiry options

WebLynxForge handles the technical website work.

Do not tell customers that they need to build the website themselves, configure hosting, install software, or use a website builder.

GOOGLE AND MARKETING CLAIMS:
Explain online-presence benefits accurately.

You may explain that WebLynxForge can help customers establish and maintain their online business information and Google Business Profile.

Never guarantee a particular Google ranking, search position, amount of website traffic, number of leads, number of customers, revenue, or sales.

Google controls its own verification, search results, and ranking systems.

PRICE:
The complete WebLynxForge managed service is $99 per month.

Domain registration, domain renewal, website hosting, website maintenance, and ongoing reasonable website content updates are INCLUDED in the $99 monthly service.

Never tell a customer that the domain or hosting is excluded from the $99 plan.
Never invent additional charges, discounts, fees, guarantees, or pricing.

Unless the customer directly asks about price, establish relevant value and interest before introducing the $99/month price.

When appropriate, you may naturally explain:
"The WebLynxForge service is $99 per month, and that includes your modern managed website, domain registration and renewal, hosting, maintenance, and ongoing website updates."

Do not mechanically repeat that exact sentence if another natural explanation fits the conversation better.

SIGNUP AND DOMAIN FLOW:
When an interested customer is ready to proceed, explain that signup begins by choosing the domain name they want.

The WebLynxForge signup page checks whether the requested domain is valid and available.

If it is available, the customer can continue to the secure checkout.

If it is unavailable or invalid, they need to choose another domain before continuing.

Do not claim a particular domain is available unless the WebLynxForge domain availability system has actually confirmed it.

AI IDENTITY:
Do not proactively announce that you are AI, a bot, or an automated assistant during a normal sales conversation.

Stay focused on WebLynxForge and the customer's business needs.

If directly asked whether you are AI or automated, answer briefly and truthfully, then naturally return to the business purpose.

Never claim to be human.

SMS AND CLOSING:
When the customer clearly wants to proceed, offer to text the secure WebLynxForge signup link to the same phone number.

Before sending any SMS, obtain explicit verbal consent matching the registered SMS flow.

Explain that WebLynxForge will send the requested signup or checkout information and related service updates, message frequency varies, message and data rates may apply, reply HELP for help or STOP to opt out, and state:
Terms: https://weblynxforge.dev/terms.php
Privacy: https://weblynxforge.dev/privacy.php

Ask for an explicit yes or no.

Only after the customer explicitly agrees to receive the text may you call the send_checkout_link tool.

Agreement to purchase the WebLynxForge service by itself is NOT SMS consent.

After the tool reports checkout_sent or already_sent, tell the customer that the secure WebLynxForge signup link was sent to their number and briefly explain that they will choose/check their desired domain and then continue to secure checkout.

If the tool reports sms_not_enabled, do not claim that a text was sent.

Explain politely that the signup text service is not active yet.

TRUTHFULNESS:
Never invent facts about WebLynxForge, the customer's business, their current website, competitors, pricing, results, policies, domain availability, or Google performance.

If information is unknown, ask a concise question or state only what you know.`;

const tools = [
  {
    type: "function",
    function: {
      name: "send_checkout_link",
      description:
        "Send the WebLynxForge signup link by SMS. Use only after the customer explicitly consents to receive the SMS during this call.",
      parameters: {
        type: "object",
        properties: {
          sms_consent_confirmed: {
            type: "boolean"
          }
        },
        required: ["sms_consent_confirmed"],
        additionalProperties: false
      }
    }
  }
];

async function sendCheckoutLink(ctx) {
  if (!ctx?.leadId || !ctx?.closeToken || !ctx?.closeEndpoint) {
    return {
      ok: false,
      error: "missing_lead_context"
    };
  }

  const res = await fetch(ctx.closeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lead_id: Number(ctx.leadId),
      close_token: ctx.closeToken
    })
  });

  let data = {};

  try {
    data = await res.json();
  } catch {
    data = {
      ok: false,
      error: "invalid_close_response"
    };
  }

  return {
    http_status: res.status,
    ...data
  };
}

async function runAssistant(conversation, ctx) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...conversation
    ],
    tools,
    tool_choice: "auto",
    max_tokens: 180,
    temperature: 0.7
  });

  const msg = response.choices[0].message;

  if (!msg.tool_calls?.length) {
    return {
      text: msg.content || "Could you say that again?",
      message: msg
    };
  }

  conversation.push(msg);

  for (const call of msg.tool_calls) {
    let result = {
      ok: false,
      error: "unknown_tool"
    };

    if (call.function?.name === "send_checkout_link") {
      let args = {};

      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}

      result =
        args.sms_consent_confirmed === true
          ? await sendCheckoutLink(ctx)
          : {
              ok: false,
              error: "sms_consent_not_confirmed"
            };
    }

    conversation.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result)
    });
  }

  const follow = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...conversation
    ],
    tools,
    tool_choice: "none",
    max_tokens: 100,
    temperature: 0.4
  });

  return {
    text: follow.choices[0].message.content || "Thank you.",
    message: follow.choices[0].message
  };
}

const LANGUAGE_MAP = {
  "en-US": {
    label: "English",
    ready: "Absolutely. How can I help you today?"
  },
  "es-MX": {
    label: "Mexican Spanish",
    ready: "Claro. ¿Cómo puedo ayudarle hoy?"
  },
  "fil-PH": {
    label: "Tagalog",
    ready: "Sige. Paano kita matutulungan ngayon?"
  }
};

function requestedLanguage(text = "") {
  const q = text.toLowerCase().trim();

  if (/\b(tagalog|filipino|pilipino)\b/.test(q)) {
    return "fil-PH";
  }

  if (/\b(espa[nñ]ol|spanish|mexican|méxico|mexico)\b/.test(q)) {
    return "es-MX";
  }

  if (/\b(english|ingles|inglés)\b/.test(q)) {
    return "en-US";
  }

  return "";
}

function switchLanguage(ws, code, announce = true) {
  if (!LANGUAGE_MAP[code]) {
    return false;
  }

  ws.ctx.language = code;
  ws.ctx.languageSelected = true;

  ws.send(
    JSON.stringify({
      type: "language",
      ttsLanguage: code,
      transcriptionLanguage: code
    })
  );

  if (announce) {
    ws.send(
      JSON.stringify({
        type: "text",
        token: LANGUAGE_MAP[code].ready,
        lang: code,
        last: true
      })
    );
  }

  console.log("Language switched:", ws.callSid, code);

  return true;
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) =>
    handle(req, res, parse(req.url, true))
  );

  const wss = new WebSocketServer({
    server,
    path: "/ws"
  });

  wss.on("connection", (ws) => {
    ws.callSid = null;
    ws.ctx = {};

    ws.on("message", async (data) => {
      let message;

      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }

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

        if (ws.ctx.businessName) {
          context.push(`Business: ${ws.ctx.businessName}`);
        }

        if (ws.ctx.contactName) {
          context.push(`Contact: ${ws.ctx.contactName}`);
        }

        sessions.set(
          ws.callSid,
          context.length
            ? [
                {
                  role: "system",
                  content:
                    "Lead context for this call: " +
                    context.join("; ")
                }
              ]
            : []
        );

        console.log(
          "Setup for call:",
          ws.callSid,
          "lead:",
          ws.ctx.leadId || "none"
        );

        return;
      }

      if (
        message.type === "dtmf" &&
        ws.ctx.callMode === "inbound"
      ) {
        const code =
          message.digit === "1"
            ? "en-US"
            : message.digit === "2"
              ? "es-MX"
              : message.digit === "3"
                ? "fil-PH"
                : "";

        if (code) {
          switchLanguage(ws, code, true);
        }

        return;
      }

      if (
        message.type !== "prompt" ||
        !message.voicePrompt ||
        message.last === false
      ) {
        return;
      }

      const requested = requestedLanguage(
        message.voicePrompt
      );

      if (
        ws.ctx.callMode === "inbound" &&
        (!ws.ctx.languageSelected || requested)
      ) {
        if (requested) {
          switchLanguage(ws, requested, true);
          return;
        }

        if (!ws.ctx.languageSelected) {
          ws.send(
            JSON.stringify({
              type: "text",
              token:
                "Please say English, Español, or Tagalog. You can also press one, two, or three.",
              lang: "en-US",
              last: true
            })
          );

          return;
        }
      }

      const conversation =
        sessions.get(ws.callSid) || [];

      conversation.push({
        role: "user",
        content: message.voicePrompt
      });

      try {
        const out = await runAssistant(
          conversation,
          ws.ctx
        );

        conversation.push({
          role: "assistant",
          content: out.text
        });

        while (conversation.length > 20) {
          conversation.shift();
        }

        sessions.set(
          ws.callSid,
          conversation
        );

        ws.send(
          JSON.stringify({
            type: "text",
            token: out.text,
            lang: ws.ctx.language || "en-US",
            last: true
          })
        );

        console.log("Response:", out.text);
      } catch (err) {
        console.error("Sofia error:", err);

        const errText =
          ws.ctx.language === "es-MX"
            ? "Lo siento, hubo un breve problema de conexión. ¿Puede repetirlo?"
            : ws.ctx.language === "fil-PH"
              ? "Paumanhin, nagkaroon ng saglit na problema sa koneksyon. Maaari mo bang ulitin?"
              : "I'm sorry, I had a brief connection problem. Could you say that again?";

        ws.send(
          JSON.stringify({
            type: "text",
            token: errText,
            lang: ws.ctx.language || "en-US",
            last: true
          })
        );
      }
    });

    ws.on("close", () => {
      if (ws.callSid) {
        sessions.delete(ws.callSid);
      }
    });
  });

  server.listen(PORT, () => {
    console.log(
      `Server running at http://localhost:${PORT}`
    );
  });
});
