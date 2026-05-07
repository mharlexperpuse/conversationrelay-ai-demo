# AGENTS.md - AI Assistant Guide

> Rules, conventions, and task recipes for AI coding assistants working on this project.

## Project Overview

Voice AI agent using Twilio ConversationRelay + OpenAI GPT + ElevenLabs TTS. Users enter a phone number, receive a call, and talk to an AI assistant.

## Do-Not-Touch Areas

These areas contain security-critical code. Do not modify, remove, or optimize away:

### Webhook Signature Validation
```
lib/twilio-validate.mjs - Twilio request validation middleware
pages/api/twiml.js - Uses validateTwilioRequest() before responding
```
- All Twilio webhooks MUST validate signatures
- Never skip validation "for testing" or "to simplify"
- Tests mock validation; production MUST validate

### PII Handling
- Phone numbers appear in logs only as `+1***` (last 4 digits)
- Never log full conversation transcripts in production
- Session data (`sessions` Map) is ephemeral and never persisted

### Environment Secrets
- Never hardcode credentials
- Never commit `.env` files
- Always use `process.env.*`

## Coding Conventions

### File Organization
- API routes: `pages/api/*.js`
- Shared utilities: `lib/*.mjs`
- React components: `pages/*.jsx`
- Tests: `__tests__/*.test.js`

### Style
- ES Modules (`.mjs` for Node, `.js`/`.jsx` for Next.js)
- No TypeScript (plain JavaScript)
- Twilio Paste for all UI components
- ESLint + Prettier enforced

### Error Handling
- API routes return `{ error: "message" }` with appropriate status
- WebSocket errors send `{ type: "text", token: "error message", last: true }`
- Log errors to console with context

### Naming
- camelCase for variables and functions
- PascalCase for React components
- SCREAMING_SNAKE_CASE for constants and env vars

## Required Tests

Before submitting changes:

```bash
npm test        # Must pass
npm run lint    # Must pass with no errors
```

### What to Test
- API route handlers (mock Twilio client)
- TwiML generation (verify XML structure)
- Input validation (missing/invalid params)
- Error responses (correct status codes)

### Test Patterns
```javascript
// Mock Twilio validation for tests
jest.mock('../lib/twilio-validate.mjs', () => ({
  validateTwilioRequest: () => (req, res, next) => next()
}));
```

## Task Cookbook

### Recipe 1: Add a New Workflow

**Goal**: Add a new conversation mode (e.g., "Order status")

1. **Update UI options** in `pages/index.jsx`:
   ```jsx
   // Find RadioGroup for workflow, add:
   <Radio value="Order status">Order status</Radio>
   ```

2. **Add greeting** in `pages/api/twiml.js`:
   ```javascript
   // In the greeting logic:
   } else if (mode === "order") {
     greeting = "Hi! I can help you check your order status. What's your order number?";
   }
   ```

3. **Add system prompt** in `server.mjs`:
   ```javascript
   // Create mode-specific prompts:
   const PROMPTS = {
     support: "You are a helpful support agent...",
     booking: "You are an appointment scheduler...",
     order: "You are an order status assistant..."
   };
   ```

4. **Update API call** in `pages/api/call.js`:
   ```javascript
   const mode = workflow === "Order status" ? "order" : ...;
   ```

5. **Add tests** for the new mode in `__tests__/twiml.test.js`

### Recipe 2: Add a Status Callback

**Goal**: Track call events (ringing, answered, completed)

1. **Create callback endpoint** `pages/api/status.js`:
   ```javascript
   import { validateTwilioRequest } from '../../lib/twilio-validate.mjs';

   export default async function handler(req, res) {
     // SECURITY: Validate Twilio signature
     const isValid = validateTwilioRequest(req);
     if (!isValid) return res.status(403).end();

     const { CallSid, CallStatus } = req.body;
     console.log(`Call ${CallSid}: ${CallStatus}`);
     res.status(200).end();
   }
   ```

2. **Add callback URL** in `pages/api/call.js`:
   ```javascript
   const call = await client.calls.create({
     to,
     from: TWILIO_PHONE_NUMBER,
     url: `https://${NGROK_URL}/api/twiml?mode=${mode}`,
     statusCallback: `https://${NGROK_URL}/api/status`,
     statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
   });
   ```

3. **Add tests** for status callback validation

### Recipe 3: Switch to a Different LLM

**Goal**: Replace OpenAI with Anthropic Claude

1. **Install SDK**:
   ```bash
   npm install @anthropic-ai/sdk
   ```

2. **Update env.example**:
   ```
   # OPENAI_API_KEY=sk-xxxxxxxx  # Remove or comment
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
   ```

3. **Replace OpenAI calls** in `server.mjs`:
   ```javascript
   import Anthropic from '@anthropic-ai/sdk';
   
   const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

   async function aiResponse(conversation) {
     const response = await anthropic.messages.create({
       model: "claude-sonnet-4-20250514",
       max_tokens: 1024,
       system: SYSTEM_PROMPT,
       messages: conversation,
     });
     return response.content[0].text;
   }
   ```

4. **Update package.json** to remove `openai` dependency

5. **Update tests** to mock Anthropic SDK

### Recipe 4: Add Function Calling / Tool Use

**Goal**: Let the AI check appointment availability

1. **Define tools** in `server.mjs`:
   ```javascript
   const tools = [{
     type: "function",
     function: {
       name: "check_availability",
       description: "Check available appointment slots",
       parameters: {
         type: "object",
         properties: {
           date: { type: "string", description: "Date in YYYY-MM-DD" }
         },
         required: ["date"]
       }
     }
   }];
   ```

2. **Handle tool calls** in the response logic:
   ```javascript
   if (response.choices[0].message.tool_calls) {
     // Execute tool and continue conversation
   }
   ```

3. **Add tool implementations** in `lib/tools.mjs`

4. **Add tests** for tool execution

### Recipe 5: Deploy to Production

**Goal**: Deploy to Vercel/Railway/Render

1. **Remove ngrok dependency** - Update env vars to use production domain

2. **Set environment variables** in hosting platform dashboard

3. **Update NGROK_URL** to production domain (rename to `PUBLIC_URL`)

4. **Enable production mode**:
   ```bash
   npm run build
   npm start
   ```

5. **Configure Twilio webhooks** to point to production URLs

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| WebSocket not connecting | Check ngrok is running, NGROK_URL matches |
| "Invalid signature" errors | Ensure AUTH_TOKEN matches, URL is exact |
| No audio/silence | Check ElevenLabs voice ID is valid |
| Call drops immediately | Check TwiML syntax, ConversationRelay enabled |

## File Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `server.mjs` | Main server, WebSocket, OpenAI | Entry point |
| `pages/api/call.js` | Initiate outbound calls | `handler(req, res)` |
| `pages/api/twiml.js` | Generate ConversationRelay TwiML | `handler(req, res)` |
| `lib/twilio-validate.mjs` | Webhook signature validation | `validateTwilioRequest(req)` |
| `pages/index.jsx` | React UI | `Home` component |
