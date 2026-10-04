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
The caller may use English or Spanish only.
Once the caller chooses a language, speak naturally in that language.
Do not offer or switch to any other language.
If the caller asks to change language later, only switch between English and Spanish.

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
7. When appropriate, explain the WebLynxForge plan options that fit the customer's needs.
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

INBOUND DEPARTMENTS:
After an inbound caller selects English or Spanish, the caller chooses one of these five departments:
Sales and Billing, Agent Orientation, Pricing Plans, Technical Support, or General Inquiry.
Respect the selected department and handle that purpose first.

AGENT ORIENTATION:
When the selected inbound department is Agent Orientation, the caller is a WebLynxForge agent or prospective agent, not a customer sales prospect.
Do not try to sell the agent a customer website plan.
Orient the agent clearly and conversationally about WebLynxForge, how to present the service to prospects, the sales process, the customer plan prices, agent commissions, common objections, and questions the agent asks.
The current customer plan prices are $49, $99, and $149 per month.
The corresponding agent commissions are $10, $20, and $30.
Explain these as corresponding tiers: $49 plan earns $10 commission, $99 plan earns $20 commission, and $149 plan earns $30 commission.
Do not invent plan-specific features, commission rules, payout timing, eligibility rules, or policies that are not provided in the current WebLynxForge information.
Encourage the agent to ask questions and answer only from known WebLynxForge information.

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

PRICING AND PLANS:
WebLynxForge has three customer plan prices: $49 per month, $99 per month, and $149 per month.

When a caller asks about pricing, clearly explain the available plan prices and only describe plan-specific features that are actually defined in the current WebLynxForge offer. Never invent differences between plans.

The established managed website service includes a modern professional website, an eligible standard domain and its renewal while the qualifying service remains active, hosting, security, maintenance, basic SEO foundations, and ongoing reasonable website content updates.

Never invent additional charges, discounts, fees, guarantees, plan features, or pricing.

Unless the customer directly asks about price, establish relevant value and interest before introducing pricing.

SIGNUP AND DOMAIN FLOW:
When an interested customer is ready to proceed, guide them to the WebLynxForge signup page.

The customer first enters their contact information and website details.

The customer reviews the information and then continues to secure payment for the WebLynxForge plan they selected.

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

SUPPORT TICKETS:
For INBOUND calls, an existing WebLynxForge customer who reports a problem with their existing website or WebLynxForge service should be handled as support, not as a new sales lead.
If the caller asks for support or asks to create a support ticket, first collect and confirm these three items: the caller's name, the website/project name, and a concise description of the problem.
Do not ask for information that is not needed to understand the support issue.
After the caller confirms those details, call the create_support_ticket tool.
Only tell the caller that a support ticket was created when the tool returns ok=true and an actual ticket_number.
Read the returned ticket number naturally to the caller.
If ticket creation fails, do not invent a ticket number. Apologize briefly and offer a live transfer to the web developer instead.
Do not silently convert a support caller into a Sales Lead.

LIVE WEB DEVELOPER TRANSFER:
For INBOUND calls only, if the caller clearly asks to speak with the web developer, a human, or the person who builds the websites, acknowledge the request and offer an immediate live transfer.
If the caller confirms they want the transfer now, call the transfer_to_developer tool.
Do not use the transfer tool merely because a prospect has an objection or asks a normal question that Sofia can answer.
Do not claim that the developer answered until the transfer actually connects.

If the live transfer was attempted but the developer did not answer, Sofia may resume the call. In that fallback state, apologize briefly and offer to create a developer callback request.
Collect and confirm the caller's name, whether to use the same callback number or a different callback number, and a short description of what they need.
If they want to use the same number they called from, callback_phone may be an empty string and the server will use the verified caller number already on the lead.
Only after the caller confirms the callback details should you call request_developer_callback.
Only tell the caller that the callback request was created if the tool reports success.
Do not promise a specific callback time unless WebLynxForge has explicitly provided one.

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
      name: "create_support_ticket",
      description:
        "Create a real WebLynxForge support ticket for an inbound existing-customer support issue. Use only after Sofia has collected and confirmed the caller name, website/project name, and concise problem description.",
      parameters: {
        type: "object",
        properties: {
          caller_name: { type: "string" },
          project_name: { type: "string" },
          concern: { type: "string" },
          category: {
            type: "string",
            enum: [
              "website_issue",
              "domain_dns",
              "billing",
              "email",
              "other"
            ]
          }
        },
        required: [
          "caller_name",
          "project_name",
          "concern",
          "category"
        ],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "transfer_to_developer",
      description:
        "For an inbound call, end the Sofia ConversationRelay session with a live-agent handoff so Twilio can dial the WebLynxForge web developer. Use only after the caller clearly asks for the developer/human and confirms they want the transfer now.",
      parameters: {
        type: "object",
        properties: {
          final_message: {
            type: "string",
            description:
              "One short sentence Sofia should say immediately before starting the live transfer."
          }
        },
        required: ["final_message"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_developer_callback",
      description:
        "Save a developer callback request after a live transfer attempt was not answered. Use only after Sofia has collected and confirmed the caller name, callback-number preference, and concern.",
      parameters: {
        type: "object",
        properties: {
          caller_name: { type: "string" },
          callback_phone: {
            type: "string",
            description:
              "E.164 callback number, or an empty string when the caller confirms the same number they called from."
          },
          concern: { type: "string" }
        },
        required: ["caller_name", "callback_phone", "concern"],
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
      hasSupportToken: Boolean(ctx?.supportToken)
    });

    return {
      ok: false,
      error: "support_context_unavailable"
    };
  }

  let res;

  try {
    res = await fetch(ctx.supportEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        call_sid: ctx.callSid,
        support_token: ctx.supportToken,
        caller_name: String(args?.caller_name || "").trim(),
        project_name: String(args?.project_name || "").trim(),
        concern: String(args?.concern || "").trim(),
        category: String(args?.category || "other").trim()
      })
    });
  } catch (err) {
    const detail = err?.message || String(err);

    console.error("Support ticket API fetch failed:", {
      callSid: ctx.callSid,
      endpoint: ctx.supportEndpoint,
      detail
    });

    return {
      ok: false,
      error: "support_api_fetch_failed",
      detail
    };
  }

  const raw = await res.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {
      ok: false,
      error: "invalid_support_response",
      response_preview: raw.slice(0, 500)
    };
  }

  console.log(
    "Support ticket API result:",
    "HTTP", res.status,
    "ok:", data?.ok === true,
    "error:", data?.error || "none",
    "detail:", data?.detail || "none",
    "ticket:", data?.ticket_number || "none"
  );

  if (data?.error === "invalid_support_response") {
    console.log(
      "Support ticket API response preview:",
      data.response_preview || "(empty)"
    );
  }

  return {
    http_status: res.status,
    ...data
  };
}

async function saveDeveloperCallback(ctx, args) {
  if (
    !ctx?.transferFailed ||
    !ctx?.leadId ||
    !ctx?.parentCallSid ||
    !ctx?.callbackEndpoint ||
    !ctx?.callbackToken
  ) {
    return {
      ok: false,
      error: "callback_context_unavailable"
    };
  }

  const res = await fetch(ctx.callbackEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lead_id: Number(ctx.leadId),
      call_sid: ctx.parentCallSid,
      callback_token: ctx.callbackToken,
      caller_name: String(args?.caller_name || "").trim(),
      callback_phone: String(args?.callback_phone || "").trim(),
      concern: String(args?.concern || "").trim()
    })
  });

  let data = {};

  try {
    data = await res.json();
  } catch {
    data = {
      ok: false,
      error: "invalid_callback_response"
    };
  }

  return {
    http_status: res.status,
    ...data
  };
}

async function runAssistant(conversation, ctx) {
  const modePrompt =
    ctx?.callMode === "agent_orientation"
      ? "CALL MODE: OUTBOUND AGENT ORIENTATION. You called a WebLynxForge agent or prospective agent specifically for orientation. Do not treat them as a customer prospect and do not sell them a website plan. Explain WebLynxForge, the customer plan prices, corresponding agent commissions, how to present the service, the sales process, common objections, and answer the agent's questions. The $49 plan corresponds to a $10 agent commission, the $99 plan to $20, and the $149 plan to $30. Do not invent plan features, payout timing, eligibility rules, or policies that are not defined."
      : ctx?.callMode === "inbound"
        ? (
            ctx?.department === "agent_orientation"
              ? "CALL MODE: INBOUND AGENT ORIENTATION. The caller selected Agent Orientation. Treat the caller as a WebLynxForge agent or prospective agent, not as a customer sales prospect. Orient them about WebLynxForge, customer plans, corresponding agent commissions, sales process, objections, and answer their questions. Do not try to sell them a website plan."
              : `CALL MODE: INBOUND. The caller selected the ${ctx?.department || "general"} department. Handle that purpose first, answer their need, and sell naturally only when relevant.`
          )
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

    if (call.function?.name === "create_support_ticket") {
      let args = {};

      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}

      result = await createSupportTicket(ctx, args);
    }

    if (call.function?.name === "transfer_to_developer") {
      let args = {};

      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}

      if (ctx?.callMode !== "inbound") {
        result = {
          ok: false,
          error: "live_transfer_inbound_only"
        };
      } else {
        const finalMessage =
          typeof args.final_message === "string" &&
          args.final_message.trim()
            ? args.final_message.trim().slice(0, 300)
            : "Certainly. I'll connect you with the web developer now.";

        return {
          text: finalMessage,
          message: msg,
          endCall: false,
          transferCall: true,
          transferReason: "caller_requested_web_developer"
        };
      }
    }

    if (call.function?.name === "request_developer_callback") {
      let args = {};

      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}

      result = await saveDeveloperCallback(ctx, args);
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

const LANGUAGE_MAP = {
  "en-US": {
    label: "English",
    ready: "Sales and Billing, Agent Orientation, Pricing Plans, Technical Support, or General Inquiry?"
  },
  "es-MX": {
    label: "Spanish",
    ready: "¿Ventas y Facturación, Orientación para Agentes, Planes de Precios, Soporte Técnico o Consulta General?"
  }
};

function requestedDepartment(text = "") {
  const q = String(text).toLowerCase().trim();

  if (/\b(agent orientation|agent training|orientation|orientaci[oó]n para agentes|orientaci[oó]n de agentes|orientaci[oó]n del agente|capacitaci[oó]n de agentes)\b/.test(q)) {
    return "agent_orientation";
  }

  if (/\b(pricing plans|pricing|price|prices|plans|plan pricing|planes de precios|precios|precio|planes)\b/.test(q)) {
    return "pricing";
  }

  if (/\b(technical support|support|tech support|help|soporte t[eé]cnico|soporte|ayuda)\b/.test(q)) {
    return "support";
  }

  if (/\b(sales and billing|sales|billing|payment|invoice|charge|ventas y facturaci[oó]n|ventas|facturaci[oó]n|pago|factura|cargo)\b/.test(q)) {
    return "billing";
  }

  if (/\b(general inquiry|general|inquiry|question|consulta general|consulta|pregunta)\b/.test(q)) {
    return "general";
  }

  return "";
}

function departmentIntroduction(language, department) {
  if (language === "es-MX") {
    if (department === "support") {
      return "Hola, soy Sofia de WebLynxForge. ¿Cómo puedo ayudarle con Soporte Técnico?";
    }
    if (department === "billing") {
      return "Hola, soy Sofia de WebLynxForge. ¿Cómo puedo ayudarle con Ventas y Facturación?";
    }
    if (department === "agent_orientation") {
      return "Hola, soy Sofia de WebLynxForge. Bienvenido a la orientación para agentes. Le explicaré WebLynxForge, nuestros planes, sus comisiones y cómo presentar el servicio. También puede hacerme preguntas en cualquier momento.";
    }
    if (department === "pricing") {
      return "Hola, soy Sofia de WebLynxForge. ¿Qué le gustaría saber sobre nuestros Planes de Precios?";
    }
    return "Hola, soy Sofia de WebLynxForge. ¿Cómo puedo ayudarle con su consulta?";
  }

  if (department === "support") {
    return "Hi, this is Sofia from WebLynxForge. How can I help you with Technical Support?";
  }
  if (department === "billing") {
    return "Hi, this is Sofia from WebLynxForge. How can I help you with Sales and Billing?";
  }
  if (department === "agent_orientation") {
    return "Hi, this is Sofia from WebLynxForge. Welcome to Agent Orientation. I'll walk you through WebLynxForge, our plans, your commissions, and how to present the service. You can ask me questions at any time.";
  }
  if (department === "pricing") {
    return "Hi, this is Sofia from WebLynxForge. What would you like to know about our Pricing Plans?";
  }
  return "Hi, this is Sofia from WebLynxForge. How can I help you with your inquiry?";
}

function requestedLanguage(text = "") {
  const q = text.toLowerCase().trim();

  if (/\b(espa[nñ]ol|spanish|mexican|méxico|mexico)\b/.test(q)) {
    return "es-MX";
  }

  if (/\b(english|ingles|inglés)\b/.test(q)) {
    return "en-US";
  }

  return "";
}

function isExplicitLiveTransferRequest(text = "", ctx = {}) {
  if (
    ctx?.callMode !== "inbound" ||
    ctx?.transferFailed === true
  ) {
    return false;
  }

  const q = String(text)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!q) {
    return false;
  }

  // Do not trigger on an explicit refusal or negated transfer request.
  if (
    /\b(?:do not|don't|dont|no need to|never)\b.{0,40}\b(?:transfer|connect|speak|talk)\b/.test(q)
  ) {
    return false;
  }

  const asksForPerson =
    /\b(?:web\s*developer|developer|human|real person|representative|live agent|person who (?:builds?|makes?) (?:the )?websites?|website (?:builder|developer))\b/.test(q);

  const asksToConnect =
    /\b(?:transfer|connect|put me through|speak|talk|talking|let me speak|let me talk|can i speak|could i speak|may i speak|want to speak|want to talk|need to speak|need to talk)\b/.test(q);

  return asksForPerson && asksToConnect;
}

function startDeterministicDeveloperTransfer(ws) {
  const text =
    ws.ctx.language === "es-MX"
      ? "Claro. Le conectaré con nuestro desarrollador web ahora."
      : "Sure. I'll connect you with our web developer now.";

  sendText(ws, text);

  console.log(
    "Deterministic live transfer intent detected:",
    ws.callSid
  );
  console.log(
    "Handing ConversationRelay to live developer transfer:",
    ws.callSid
  );

  // Give ConversationRelay a brief moment to accept the final spoken line,
  // then end the AI session with the handoff Twilio expects.
  setTimeout(() => {
    endConversationRelay(
      ws,
      "caller_requested_web_developer",
      "live-agent-handoff"
    );
  }, 3200);
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
      lang: ws.ctx.language || "en-US",
      last: true
    })
  );
}

function endConversationRelay(
  ws,
  reason,
  reasonCode = "sofia-call-complete"
) {
  if (ws.readyState !== 1) {
    return;
  }

  ws.send(
    JSON.stringify({
      type: "end",
      handoffData: JSON.stringify({
        reasonCode,
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
          department: "",
          departmentSelected: cp.call_mode !== "inbound"
        };

        const context = [];

        if (ws.ctx.businessName) {
          context.push(`Business: ${ws.ctx.businessName}`);
        }

        if (ws.ctx.contactName) {
          context.push(`Contact: ${ws.ctx.contactName}`);
        }

        if (ws.ctx.transferFailed) {
          context.push(
            "The attempted live transfer to the web developer was not answered. Offer to create a developer callback request and collect/confirm the caller name, callback-number preference, and concern before using the callback tool."
          );
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
              token: "Please say English or Spanish.",
              lang: "en-US",
              last: true
            })
          );

          return;
        }
      }

      if (
        ws.ctx.callMode === "inbound" &&
        ws.ctx.languageSelected &&
        !ws.ctx.departmentSelected
      ) {
        const department = requestedDepartment(message.voicePrompt);

        if (!department) {
          ws.send(
            JSON.stringify({
              type: "text",
              token:
                ws.ctx.language === "es-MX"
                  ? "¿Ventas y Facturación, Orientación para Agentes, Planes de Precios, Soporte Técnico o Consulta General?"
                  : "Sales and Billing, Agent Orientation, Pricing Plans, Technical Support, or General Inquiry?",
              lang: ws.ctx.language,
              last: true
            })
          );
          return;
        }

        ws.ctx.department = department;
        ws.ctx.departmentSelected = true;

        const intro = departmentIntroduction(
          ws.ctx.language,
          department
        );

        ws.send(
          JSON.stringify({
            type: "text",
            token: intro,
            lang: ws.ctx.language,
            last: true
          })
        );

        console.log(
          "Inbound department selected:",
          ws.callSid,
          department
        );

        return;
      }

      // Live-transfer requests are a deterministic call-control action.
      // Do not rely on the LLM to choose the transfer tool: if an inbound
      // caller explicitly asks to speak with the developer/human, perform
      // the Twilio ConversationRelay handoff immediately.
      if (
        isExplicitLiveTransferRequest(
          message.voicePrompt,
          ws.ctx
        )
      ) {
        startDeterministicDeveloperTransfer(ws);
        return;
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

        if (out.transferCall) {
          console.log(
            "Handing ConversationRelay to live developer transfer:",
            ws.callSid
          );

          setTimeout(() => {
            endConversationRelay(
              ws,
              out.transferReason || "caller_requested_web_developer",
              "live-agent-handoff"
            );
          }, 3200);
        } else if (out.endCall) {
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
