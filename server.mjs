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
Speak for the ear, not for a written document.
Never read punctuation marks aloud.
Do not say words such as "dash", "hyphen", "slash", "asterisk", or "bullet" unless the customer specifically asks how something is spelled or written.
Use natural spoken sentences instead of reading formatted lists.
When discussing website security in a normal sales conversation, say that the website is secure or protected with SSL.
Do not casually say technical terms such as "HTTPS" unless the customer asks for technical details.
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
For outbound calls, Sofia is the salesperson and must confidently lead the conversation.
Do NOT open by asking "How are you?", "How are you doing today?", or another generic courtesy question.
Do NOT lead with the $99 price.
Use a direct, warm, professional opening that immediately gives the reason for the call.

The preferred opening is:
"Hi, this is Sofia from WebLynxForge. I'm calling because we help small businesses build and manage their professional website and online presence. I just wanted to briefly see if this is something that could help your business."

Then ask one relevant discovery question, normally:
"Do you currently have a website for your business?"

After the prospect answers, actively lead the sales conversation instead of waiting for them to drive it.
Be assertive and persistent in a polite, professional way.
Sound warm, pleasant, encouraging, and naturally sweet without flirting or becoming unprofessional.
Use short conversational responses.
Build interest and value before discussing price unless the prospect directly asks for the price.
If the prospect has a website, explore one or two legitimate gaps or management pain points rather than giving up.
If the prospect does not have a website, explain the business value of having WebLynxForge manage it for them.
Do not immediately dump a long feature list.
Match benefits to what the prospect tells you.
Ask for the sale when there is genuine interest, while respecting a clear refusal or do-not-call request.

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

Look for legitimate gaps such as an outdated design, poor mobile experience, difficult or slow updates, separate website expenses, weak calls-to-action, outdated business information, maintenance burden, weak basic SEO foundations, or weak online presence.

When you identify a real gap, clearly connect that problem to a WebLynxForge benefit.

Never invent or exaggerate a weakness in the customer's existing website.

If their current website is genuinely working well, explore whether WebLynxForge's managed convenience, consolidated services, ongoing updates, basic SEO foundations, or online-presence assistance would still provide value.

OBJECTION HANDLING:
Do not give up at the first ordinary sales objection.
Respond politely, acknowledge the concern, and when appropriate ask one or two relevant questions to understand the real objection.
Then explain the WebLynxForge benefit that directly addresses it.

Never pressure, threaten, shame, mislead, or argue with a customer.

If the customer clearly says they are not interested and wants the sales conversation to stop, respect that.

If they say stop calling, do not contact me, remove me, or otherwise clearly request no further calls, acknowledge the request professionally and do not continue selling.

WEBLYNXFORGE SERVICE:
WebLynxForge provides a modern, professional, managed business website and online-presence service.

Think of WebLynxForge as a convenient one-stop managed website service for a small business.
WebLynxForge handles the technical website work so the customer does not have to manage multiple website services themselves.

The service includes:
- A modern professional business website
- Mobile-friendly design
- Domain name registration for an eligible standard domain
- Domain name renewal while the qualifying managed service remains active
- Website hosting
- Ongoing website maintenance
- Ongoing reasonable content updates such as business hours, services, text, photos, and contact information
- A secure website with SSL protection
- Basic SEO foundations
- Assistance with the customer's online business presence
- Google Business Profile assistance, including helping maintain relevant business information such as business hours and the website link
- Website features that can make it easier for customers to contact the business, such as appropriate call, contact, directions, or inquiry options

WebLynxForge handles the technical website work.

Do not tell customers that they need to build the website themselves, configure hosting, install software, or use a website builder.

SEO, GOOGLE, AND MARKETING CLAIMS:
Basic SEO foundations ARE included in the $99/month managed website service.

If a customer asks whether SEO is included, do not say that SEO is excluded.

Explain that WebLynxForge includes basic on-site SEO foundations as part of the managed website service.

Basic SEO may include appropriate page titles, meta descriptions, heading structure, mobile-friendly pages, search-engine-friendly page structure, basic local-business information, and other reasonable foundational on-site optimization.

Explain online-presence benefits accurately.

You may explain that WebLynxForge can help customers establish and maintain their online business information and Google Business Profile.

Do not describe the included basic SEO as a full-scale SEO campaign, paid advertising service, backlink campaign, or guaranteed ranking service unless WebLynxForge separately offers such a service.

Never guarantee a particular Google ranking, first-page placement, number-one search position, amount of website traffic, number of leads, number of customers, revenue, or sales.

Google controls its own verification, search results, and ranking systems.

PRICE:
The complete WebLynxForge managed service is $99 per month.

Domain registration for an eligible standard domain, domain renewal, website hosting, website maintenance, basic SEO foundations, and ongoing reasonable website content updates are INCLUDED in the $99 monthly service.

Never tell a customer that the domain, hosting, basic SEO foundations, or website maintenance are excluded from the $99 plan.

Never invent additional charges, discounts, fees, guarantees, or pricing.

Unless the customer directly asks about price, establish relevant value and interest before introducing the $99/month price.

When appropriate, you may naturally explain:
"The WebLynxForge service is $99 per month. It includes your modern managed website, an eligible domain and its renewal, hosting, security, maintenance, basic SEO foundations, and ongoing website updates."

Do not mechanically repeat that exact sentence if another natural explanation fits the conversation better.

SIGNUP AND DOMAIN FLOW:
When an interested customer is ready to proceed, guide them to the WebLynxForge signup page.

The customer first enters their contact information and website details.

The customer reviews the information and then continues to secure payment for the $99/month managed website service.

After payment is securely confirmed, the customer chooses their included domain name.

WebLynxForge then checks whether the requested domain is eligible and available before registration.

If the selected domain is unavailable or not eligible, the customer must choose another domain.

Never claim that a particular domain is available or registered unless the WebLynxForge domain system has actually confirmed it.

Do not tell the customer that they must choose a domain before payment.

AI IDENTITY:
Do not proactively announce that you are AI, a bot, or an automated assistant during a normal sales conversation.

Stay focused on WebLynxForge and the customer's business needs.

If directly asked whether you are AI or automated, answer briefly and truthfully, then naturally return to the business purpose.

Never claim to be human.

SMS AND CLOSING:
When the customer clearly wants to proceed, offer to text the secure WebLynxForge signup link to the same phone number.

Before sending any SMS, obtain explicit verbal consent matching the registered SMS flow.

Explain that WebLynxForge will send the requested signup information and related service updates, message frequency varies, message and data rates may apply, reply HELP for help or STOP to opt out, and state:
Terms: https://weblynxforge.dev/terms.php
Privacy: https://weblynxforge.dev/privacy.php

Ask for an explicit yes or no.

Only after the customer explicitly agrees to receive the text may you call the send_checkout_link tool.

Agreement to purchase the WebLynxForge service by itself is NOT SMS consent.

After the tool reports checkout_sent or already_sent, tell the customer that the secure WebLynxForge signup link was sent to their number.

Briefly explain that they will enter their information and website details, review them, continue to secure checkout, and after payment is confirmed choose their included domain.

If the tool reports sms_not_enabled, do not claim that a text was sent.

Explain politely that the signup text service is not active yet.

CALL ENDING AND HANG-UP:
Sofia must recognize when the conversation is genuinely finished and end the call cleanly.

Do NOT end the call merely because the prospect gives an ordinary sales objection such as already having a website, being busy, needing to think about it, or saying the price sounds high. Handle ordinary objections professionally when appropriate.

End the call when one of these is true:
- The customer clearly says goodbye, bye, that's all, please hang up, or otherwise clearly ends the conversation.
- The customer clearly says they are not interested and wants the sales conversation to stop.
- The customer asks not to be called again, asks to be removed, or makes another clear do-not-call request.
- The signup-link closing flow has been completed and both sides have clearly finished the conversation.
- The conversation has otherwise clearly reached a natural final ending with no remaining question or next step.

Before ending, say one short, polite, natural final closing sentence appropriate to the language and situation, such as thanking the customer for their time and wishing them a good day.
Then call the end_call tool.
Do not tell the customer about the tool, WebSocket, Twilio, or technical hang-up process.

TRUTHFULNESS:
Never invent facts about WebLynxForge, the customer's business, their current website, competitors, pricing, results, policies, domain availability, SEO results, or Google performance.

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
  },
  {
    type: "function",
    function: {
      name: "end_call",
      description:
        "End the live phone call cleanly after Sofia has given a brief final closing sentence and the conversation is genuinely finished. Do not use for an ordinary sales objection that should still be handled.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: [
              "customer_goodbye",
              "customer_not_interested",
              "do_not_call",
              "signup_flow_complete",
              "conversation_complete"
            ]
          },
          final_message: {
            type: "string",
            description:
              "One short, natural final sentence Sofia should say before the call ends."
          }
        },
        required: ["reason", "final_message"],
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
  const modePrompt =
    ctx?.callMode === "inbound"
      ? `CALL MODE: INBOUND. Selected language: ${ctx?.language || "en"}. Selected department: ${ctx?.callCategory || "general"}. Continue in the caller's selected language, while naturally understanding code-switching. If department is support, focus on troubleshooting and gathering the issue; do not claim a support ticket was created unless a tool confirms it. If department is general, answer the inquiry without forcing a sales pitch. If department is sales_billing, handle WebLynxForge sales or billing questions naturally and do not invent account or billing facts.`
      : "CALL MODE: OUTBOUND SALES. You called the prospect. Lead the conversation proactively. Do not ask generic courtesy questions. Do not lead with price. Use the direct WebLynxForge opening and then move into concise discovery and value-based selling.";

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "system",
        content: modePrompt
      },
      ...conversation
    ],
    tools,
    tool_choice: "auto",
    max_tokens: 180,
    temperature: 0.7
  });

  const msg = response?.choices?.[0]?.message;

  if (!msg) {
    throw new Error("OpenAI returned no assistant message.");
  }

  if (!msg.tool_calls?.length) {
    return {
      text: msg.content || "Could you say that again?",
      message: msg,
      endCall: false
    };
  }

  const toolConversation = [
    ...conversation,
    msg
  ];

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

    if (call.function?.name === "end_call") {
      let args = {};

      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}

      const allowedReasons = new Set([
        "customer_goodbye",
        "customer_not_interested",
        "do_not_call",
        "signup_flow_complete",
        "conversation_complete"
      ]);

      const reason = allowedReasons.has(args.reason)
        ? args.reason
        : "conversation_complete";

      const finalMessage =
        typeof args.final_message === "string" &&
        args.final_message.trim()
          ? args.final_message.trim().slice(0, 300)
          : "Thank you for your time. Have a great day!";

      return {
        text: finalMessage,
        message: msg,
        endCall: true,
        endReason: reason
      };
    }

    toolConversation.push({
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
      {
        role: "system",
        content: modePrompt
      },
      ...toolConversation
    ],
    tools,
    tool_choice: "none",
    max_tokens: 100,
    temperature: 0.4
  });

  const followMsg = follow?.choices?.[0]?.message;

  if (!followMsg) {
    throw new Error("OpenAI returned no follow-up assistant message.");
  }

  return {
    text: followMsg.content || "Thank you.",
    message: followMsg,
    endCall: false
  };
}

const INBOUND_LANGUAGES = {
  en: {
    label: "English",
    categoryPrompt: "Please say Sales or Billing, Support, or General Inquiry.",
    introductions: {
      sales_billing: "Hi, this is Sofia from WebLynxForge. How can I help you with Sales or Billing today?",
      support: "Hi, this is Sofia from WebLynxForge Support. How can I help you today?",
      general: "Hi, this is Sofia from WebLynxForge. How can I help you today?"
    }
  },
  es: {
    label: "Español",
    categoryPrompt: "Diga Ventas o Facturación, Soporte o Consulta General.",
    introductions: {
      sales_billing: "Hola, soy Sofia de WebLynxForge. ¿Cómo puedo ayudarle con Ventas o Facturación?",
      support: "Hola, soy Sofia del soporte de WebLynxForge. ¿Cómo puedo ayudarle hoy?",
      general: "Hola, soy Sofia de WebLynxForge. ¿Cómo puedo ayudarle hoy?"
    }
  },
  tl: {
    label: "Tagalog",
    categoryPrompt: "Sabihin lamang kung Sales o Billing, Support, o General Inquiry.",
    introductions: {
      sales_billing: "Hi, ako si Sofia mula sa WebLynxForge. Paano kita matutulungan sa Sales o Billing?",
      support: "Hi, ako si Sofia mula sa WebLynxForge Support. Paano kita matutulungan ngayon?",
      general: "Hi, ako si Sofia mula sa WebLynxForge. Paano kita matutulungan ngayon?"
    }
  }
};

function requestedLanguage(text = "", detectedLang = "") {
  const q = String(text).toLowerCase().trim();
  if (/\b(tagalog|filipino|pilipino)\b/.test(q)) return "tl";
  if (/\b(espa[nñ]ol|spanish|castellano)\b/.test(q)) return "es";
  if (/\b(english|ingles|inglés)\b/.test(q)) return "en";

  // Only use Twilio's detected language as a fallback after an actual utterance.
  const d = String(detectedLang).toLowerCase();
  if (d === "tl" || d === "fil") return "tl";
  if (d === "es") return "es";
  if (d === "en") return "en";
  return "";
}

function requestedCategory(text = "") {
  const q = String(text).toLowerCase().trim();

  if (/\b(support|soporte|technical|tech support|help desk|bug|error|issue|problem|problema|not working|isn't working|doesn't work|broken|down|ayaw gumana|hindi gumagana|sira|tulong|website issue|site issue)\b/.test(q)) {
    return "support";
  }

  if (/\b(sales|billing|ventas|facturaci[oó]n|invoice|payment|pricing|price|subscribe|subscription|buy|purchase|quote|quotation|bayad|billing|singil|presyo|magkano|bumili|website service)\b/.test(q)) {
    return "sales_billing";
  }

  if (/\b(general inquiry|general|inquiry|consulta general|consulta|question|tanong|katanungan|information|info)\b/.test(q)) {
    return "general";
  }

  return "";
}

function sendInboundText(ws, text) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: "text",
    token: text,
    lang: "multi",
    last: true
  }));
}

function selectInboundLanguage(ws, language) {
  if (!INBOUND_LANGUAGES[language]) return false;
  ws.ctx.language = language;
  ws.ctx.languageSelected = true;
  ws.ctx.categorySelected = false;
  ws.ctx.callCategory = "";
  sendInboundText(ws, INBOUND_LANGUAGES[language].categoryPrompt);
  console.log("Inbound language selected:", ws.callSid, language);
  return true;
}

function selectInboundCategory(ws, category) {
  const lang = INBOUND_LANGUAGES[ws.ctx.language] ? ws.ctx.language : "en";
  const intro = INBOUND_LANGUAGES[lang].introductions[category];
  if (!intro) return false;
  ws.ctx.callCategory = category;
  ws.ctx.categorySelected = true;
  sendInboundText(ws, intro);
  console.log("Inbound category selected:", ws.callSid, category);
  return true;
}

function trimConversation(conversation, maxMessages = 20) {
  if (conversation.length <= maxMessages) {
    return conversation;
  }

  const systemMessages = conversation.filter(
    (item) => item?.role === "system"
  );

  const normalMessages = conversation.filter(
    (item) =>
      item?.role === "user" ||
      item?.role === "assistant"
  );

  const room = Math.max(
    2,
    maxMessages - systemMessages.length
  );

  return [
    ...systemMessages,
    ...normalMessages.slice(-room)
  ];
}

function sendText(ws, text) {
  ws.send(
    JSON.stringify({
      type: "text",
      token: text,
      lang: ws.ctx.callMode === "inbound" ? "multi" : (ws.ctx.language || "en-US"),
      last: true
    })
  );
}

function endConversationRelay(ws, reason) {
  if (ws.readyState !== 1) {
    return;
  }

  ws.send(
    JSON.stringify({
      type: "end",
      handoffData: JSON.stringify({
        reasonCode: "sofia-call-complete",
        reason: reason || "conversation_complete"
      })
    })
  );
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
          language: cp.call_mode === "inbound" ? "" : "en-US",
          languageSelected: cp.call_mode !== "inbound",
          categorySelected: cp.call_mode !== "inbound",
          callCategory: cp.call_mode === "inbound" ? "" : "outbound_sales"
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
          ws.ctx.leadId || "none",
          "mode:",
          ws.ctx.callMode
        );

        return;
      }

      if (
        message.type !== "prompt" ||
        !message.voicePrompt ||
        message.last === false
      ) {
        return;
      }

      if (ws.ctx.callMode === "inbound") {
        if (!ws.ctx.languageSelected) {
          const language = requestedLanguage(message.voicePrompt, message.lang || "");
          if (language) {
            selectInboundLanguage(ws, language);
          } else {
            sendInboundText(ws, "Please say English, Español, or Tagalog.");
          }
          return;
        }

        if (!ws.ctx.categorySelected) {
          const category = requestedCategory(message.voicePrompt);
          if (category) {
            selectInboundCategory(ws, category);
          } else {
            sendInboundText(ws, INBOUND_LANGUAGES[ws.ctx.language].categoryPrompt);
          }
          return;
        }
      }

      let conversation =
        sessions.get(ws.callSid) || [];

      conversation = conversation.filter(
        (item) =>
          item?.role === "system" ||
          item?.role === "user" ||
          (item?.role === "assistant" &&
            !item?.tool_calls)
      );

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

        conversation = trimConversation(
          conversation,
          20
        );

        sessions.set(
          ws.callSid,
          conversation
        );

        sendText(ws, out.text);

        console.log("Response:", out.text);

        if (out.endCall) {
          console.log(
            "Ending ConversationRelay cleanly:",
            ws.callSid,
            out.endReason
          );

          // Give ConversationRelay a short moment to accept the final
          // spoken text before sending the official end-session message.
          setTimeout(() => {
            endConversationRelay(
              ws,
              out.endReason
            );
          }, 250);
        }
      } catch (err) {
        console.error("Sofia error:", {
          name: err?.name || "Error",
          message: err?.message || String(err),
          status: err?.status || null,
          code: err?.code || null,
          type: err?.type || null,
          callSid: ws.callSid || null,
          mode: ws.ctx.callMode || null
        });

        const errText =
          ws.ctx.language === "es-MX"
            ? "Lo siento, hubo un breve problema. ¿Puede repetirlo?"
            : ws.ctx.language === "fil-PH"
              ? "Paumanhin, nagkaroon ng saglit na problema. Maaari mo bang ulitin?"
              : "I'm sorry, I had a brief problem. Could you say that again?";

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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Server running on 0.0.0.0:${PORT}`
    );
  });
});
