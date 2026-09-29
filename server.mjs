import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const dev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;

/*
|--------------------------------------------------------------------------
| SOFIA - WEBLYNXFORGE SALES ASSISTANT
|--------------------------------------------------------------------------
*/

const SYSTEM_PROMPT = `
You are Sofia, the sales assistant for WebLynxForge.

You are speaking with business owners by phone.

Your job is to have a natural, friendly, warm, cheerful, professional
conversation and find out whether the business needs a website or
a better website.

WEBLYNXFORGE SERVICE:

WebLynxForge provides a managed website service for $99 per month.

The customer does NOT need to build the website themselves.

The customer does NOT need to use a website builder.

The customer does NOT need to code anything.

The customer does NOT need to understand hosting, servers,
WordPress, website builders, or other technical systems.

WebLynxForge handles the website work for the customer.

The customer's role is simply to tell us about their business,
what they need from their website, and provide the business
information and content needed for the website.

The service costs $99 per month.

SALES CONVERSATION:

Keep the conversation simple and focused on the customer's business.

Ask short, natural questions such as:

Do you currently have a website?

What kind of business do you have?

Are you happy with your current website?

What would you like your website to help your business accomplish?

If they do not have a website, explain that WebLynxForge can
handle the website for them.

If they already have a website, ask whether they are happy with it
and whether they would be interested in having WebLynxForge
improve or manage their website.

When appropriate, explain naturally that the WebLynxForge managed
website service is $99 per month.

Do not pressure the customer.

Do not repeatedly mention the price.

Do not give long sales speeches.

Keep responses short enough for a natural phone conversation.

IMPORTANT:

Never tell the customer to go to a website builder.

Never tell the customer to build their own website.

Never tell the customer to configure hosting.

Never tell the customer to install software.

Never tell the customer to write code.

Never give the customer technical setup instructions.

Never suggest that they need to hire another developer or another
website company.

Do not invent additional WebLynxForge products, fees, discounts,
contracts, guarantees, features, or policies.

Do not promise a specific completion date unless that information
has explicitly been provided.

If you do not know a specific WebLynxForge policy or service detail,
say that a WebLynxForge team member can confirm that detail.

INTERESTED CUSTOMER:

If the customer is interested, acknowledge their interest and
briefly explain that the WebLynxForge team can take care of the
website and the managed service is $99 per month.

Do not invent a payment link.

Do not invent a checkout URL.

Do not claim that payment has been completed unless the system
actually confirms it.

IDENTITY:

Your name is Sofia.

You are calling on behalf of WebLynxForge.

Do not proactively start talking about being AI, automated,
a bot, or artificial intelligence.

If someone asks an unrelated identity question, redirect politely
to the reason for the call.

If they directly and persistently ask whether you are an AI or
automated system, answer truthfully and briefly, then return to
the WebLynxForge conversation.

TONE:

Sound cheerful, warm, friendly, youthful, and professional.

Do not sound aggressive or overly salesy.

Use conversational American English.

Use short sentences.

Ask only one main question at a time.

Do not use bullet points, markdown, emojis, special symbols,
or numbered lists because your responses will be spoken aloud.

Spell out numbers when appropriate for speech.

Do not say dollar sign ninety nine.
Say ninety nine dollars per month.

OPENING:

When continuing after the initial greeting, naturally begin the
conversation about the customer's business.

Do not repeat your introduction unnecessarily.
`;


/*
|--------------------------------------------------------------------------
| OPENAI
|--------------------------------------------------------------------------
*/

const sessions = new Map();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


async function aiResponse(conversation) {

  const response = await openai.chat.completions.create({

    model: process.env.OPENAI_MODEL || "gpt-4o-mini",

    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...conversation,
    ],

    /*
     * Keep Sofia concise for natural phone conversations
     * and lower token usage.
     */
    max_tokens: 180,

    temperature: 0.7,

  });

  return response.choices[0].message.content;
}


/*
|--------------------------------------------------------------------------
| NEXT.JS
|--------------------------------------------------------------------------
*/

const app = next({ dev });

const handle = app.getRequestHandler();


app.prepare().then(() => {

  const server = createServer((req, res) => {

    const parsedUrl = parse(req.url, true);

    handle(req, res, parsedUrl);

  });


  /*
  |--------------------------------------------------------------------------
  | TWILIO CONVERSATIONRELAY WEBSOCKET
  |--------------------------------------------------------------------------
  */

  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });


  wss.on("connection", (ws) => {

    console.log("WebSocket connected");


    ws.on("message", async (data) => {

      try {

        const message = JSON.parse(data);


        /*
        |--------------------------------------------------------------------------
        | CALL SETUP
        |--------------------------------------------------------------------------
        */

        if (message.type === "setup") {

          console.log(
            "Setup for call:",
            message.callSid
          );

          ws.callSid = message.callSid;

          sessions.set(
            message.callSid,
            []
          );

          return;
        }


        /*
        |--------------------------------------------------------------------------
        | CUSTOMER SPEAKS
        |--------------------------------------------------------------------------
        */

        if (message.type === "prompt") {

          console.log(
            "Prompt:",
            message.voicePrompt
          );


          const conversation =
            sessions.get(ws.callSid) || [];


          conversation.push({

            role: "user",

            content:
              message.voicePrompt,

          });


          try {

            const response =
              await aiResponse(
                conversation
              );


            conversation.push({

              role: "assistant",

              content: response,

            });


            /*
             * Prevent conversation history
             * from growing forever.
             *
             * Keep only recent conversation.
             */

            if (conversation.length > 16) {

              conversation.splice(
                0,
                conversation.length - 16
              );

            }


            sessions.set(
              ws.callSid,
              conversation
            );


            /*
             * Send Sofia's answer
             * back to ConversationRelay
             */

            ws.send(
              JSON.stringify({

                type: "text",

                token: response,

                last: true,

              })
            );


            console.log(
              "Response:",
              response
            );


          } catch (err) {

            console.error(
              "OpenAI error:",
              err
            );


            ws.send(
              JSON.stringify({

                type: "text",

                token:
                  "I'm sorry, I had a brief connection problem. Could you say that again?",

                last: true,

              })
            );

          }

        }

      } catch (err) {

        console.error(
          "WebSocket message error:",
          err
        );

      }

    });


    /*
    |--------------------------------------------------------------------------
    | CALL ENDS
    |--------------------------------------------------------------------------
    */

    ws.on("close", () => {

      console.log(
        "WebSocket closed"
      );


      if (ws.callSid) {

        sessions.delete(
          ws.callSid
        );

      }

    });


    ws.on("error", (err) => {

      console.error(
        "WebSocket error:",
        err
      );

    });

  });


  /*
  |--------------------------------------------------------------------------
  | SERVER
  |--------------------------------------------------------------------------
  */

  server.listen(PORT, () => {

    console.log(
      `Server running at http://localhost:${PORT}`
    );

  });

});
