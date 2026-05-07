# Twilio ConversationRelay Voice AI Demo

**Build AI-powered voice agents that handle real phone conversations**

Create intelligent phone assistants using Twilio ConversationRelay, OpenAI GPT, and ElevenLabs. This template demonstrates how to build a complete voice AI system that can call users, understand their speech, respond naturally, and handle multi-turn conversations for customer support or appointment booking.

![Demo UI](demo.png)

## Twilio Products Used

- **[Twilio Voice](https://www.twilio.com/docs/voice)** - Outbound calling
- **[ConversationRelay](https://www.twilio.com/docs/voice/conversationrelay)** - Real-time voice-to-AI bridge via WebSocket

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  User Phone  │◄───►│ Twilio Voice │◄───►│ ConversationRelay   │◄───►│   Your App   │
└──────────────┘     └──────────────┘     │  (Speech-to-Text)   │     │  server.mjs  │
                                          │  (Text-to-Speech)   │     │              │
                                          └─────────────────────┘     └──────┬───────┘
                                                    │                        │
                                                    ▼                        ▼
                                          ┌─────────────────┐         ┌──────────────┐
                                          │   ElevenLabs    │         │   OpenAI     │
                                          │   TTS Voices    │         │   GPT API    │
                                          └─────────────────┘         └──────────────┘
```

## Features

- **Real-time voice AI**: Bidirectional audio streaming via WebSocket
- **Natural conversations**: OpenAI GPT powers intelligent responses
- **Premium voices**: ElevenLabs TTS with 8 voice options and customizable parameters
- **Multiple workflows**: Customer support and appointment booking modes
- **Professional UI**: Built with Twilio Paste design system
- **Webhook security**: Request validation on all Twilio webhooks

## Prerequisites

- **Twilio Account** with a phone number and [ConversationRelay enabled](https://www.twilio.com/docs/voice/conversationrelay/onboarding)
- **OpenAI API key**
- **ngrok** (or similar tunneling service)
- **Node.js** 18+

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp env.example .env
   ```

3. **Edit `.env`** with your credentials (see [env.example](env.example) for where to find each value)

4. **Start ngrok** for local tunneling
   ```bash
   ngrok http 3000
   ```
   Copy the domain (without `https://`) to `NGROK_URL` in `.env`.

5. **Run the app**
   ```bash
   npm run dev
   ```

6. **Run tests**
   ```bash
   npm test
   ```

7. **Test it**: Open http://localhost:3000, enter your phone number, and click "Call me".

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix linting issues |

## Environment Variables

See [env.example](env.example) for all variables with documentation and links to obtain credentials.

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Yes | Your Twilio phone number |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `NGROK_URL` | Yes | ngrok domain (without https://) |
| `OPENAI_MODEL` | No | GPT model (default: `gpt-4o-mini`) |

## Project Structure

```
├── server.mjs              # WebSocket server + OpenAI integration
├── lib/
│   └── twilio-validate.mjs # Webhook signature validation
├── pages/
│   ├── index.jsx           # React UI (Twilio Paste)
│   └── api/
│       ├── call.js         # Initiates outbound calls
│       └── twiml.js        # ConversationRelay TwiML (validated)
├── __tests__/              # Test suite
│   ├── call.test.js
│   └── twiml.test.js
├── AGENTS.md               # AI assistant rules and task cookbook
└── env.example             # Environment template with docs
```

## AI Assistant Guide

See **[AGENTS.md](AGENTS.md)** for:
- Coding conventions and do-not-touch areas
- Task cookbook with common recipes
- Testing requirements

## Related Documentation

- [ConversationRelay Documentation](https://www.twilio.com/docs/voice/conversationrelay)
- [ConversationRelay Onboarding](https://www.twilio.com/docs/voice/conversationrelay/onboarding)
- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [OpenAI Chat Completions](https://platform.openai.com/docs/guides/text-generation)
- [ElevenLabs API](https://elevenlabs.io/docs)

## License

MIT
