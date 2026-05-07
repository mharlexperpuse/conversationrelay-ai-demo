export default function handler(req, res) {
  const { NGROK_URL } = process.env;
  const mode = req.query.mode || "support";
  const voice = req.query.voice || "";
  const wsUrl = `wss://${NGROK_URL}/ws`;

  const greeting = mode === "booking"
    ? "Hi! I can help you book an appointment. What day works best for you?"
    : "Hi! I am your support agent. How can I help you today?";

  // Build TwiML with ElevenLabs voice settings
  const voiceAttr = voice ? `voice="${decodeURIComponent(voice)}"` : "";
  const ttsProvider = voice ? 'ttsProvider="ElevenLabs"' : "";

  res.setHeader("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay
      url="${wsUrl}"
      welcomeGreeting="${greeting}"
      ${ttsProvider}
      ${voiceAttr}
    />
  </Connect>
</Response>`);
}
