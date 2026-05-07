# Twilio ConversationRelay Demo

Voice AI agent using Twilio ConversationRelay + OpenAI.

![Demo UI](demo.png)

## Prerequisites

- **Twilio Account** with a phone number and [ConversationRelay enabled](https://www.twilio.com/docs/voice/conversationrelay/onboarding)
- **OpenAI API key**
- **ngrok**
- **Node.js** 18+

## Quick Start

```bash
npm install
cp env.example .env
```

Edit `.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+15555550123
OPENAI_API_KEY=sk-xxxxxxxx
NGROK_URL=your-domain.ngrok.app
```

Start ngrok:

```bash
ngrok http 3000
```

Set the ngrok domain as `NGROK_URL` in `.env`.

Run the app:

```bash
npm run dev
```

Open http://localhost:3000, enter your phone number, and click "Call me".

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Yes | Your Twilio phone number |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `NGROK_URL` | Yes | ngrok domain (without https://) |
| `OPENAI_MODEL` | No | Default: `gpt-4o-mini` |
