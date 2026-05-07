/**
 * TwiML endpoint for ConversationRelay.
 *
 * Generates TwiML that connects incoming calls to ConversationRelay WebSocket.
 * Configures ElevenLabs TTS voice settings and greeting based on workflow mode.
 *
 * ElevenLabs voice format: [VoiceID]-[Model]-[Speed]_[Stability]_[Similarity]
 * Example: ZF6FPAbjXT4488VcRRnw-flash_v2_5-1.2_1.0_1.0
 *
 * @route POST /api/twiml
 * @query {string} mode - Workflow mode: "support" or "booking"
 * @query {string} voiceId - ElevenLabs voice ID
 * @query {string} model - ElevenLabs model ID
 * @query {number} speed - Voice speed (0.7-1.2)
 * @query {number} stability - Voice stability (0-1)
 * @query {number} similarity - Voice similarity (0-1)
 * @returns {string} TwiML XML response
 */

import { validateTwilioRequest } from "../../lib/twilio-validate.mjs";

export default function handler(req, res) {
  // ============================================================
  // SECURITY: WEBHOOK SIGNATURE VALIDATION
  // Do not remove or bypass this check.
  // ============================================================
  if (process.env.NODE_ENV === "production") {
    if (!validateTwilioRequest(req)) {
      return res.status(403).json({ error: "Invalid Twilio signature" });
    }
  }
  // ============================================================

  const { NGROK_URL } = process.env;
  const mode = req.query.mode || "support";
  const voiceId = req.query.voiceId || "";
  const model = req.query.model || "flash_v2_5";
  const speed = parseFloat(req.query.speed) || 1.0;
  const stability = parseFloat(req.query.stability) || 0.5;
  const similarity = parseFloat(req.query.similarity) || 0.75;
  const wsUrl = `wss://${NGROK_URL}/ws`;

  const greeting =
    mode === "booking"
      ? "Hi! I can help you book an appointment. What day works best for you?"
      : "Hi! I am your support agent. How can I help you today?";

  // Build TTS attributes for ElevenLabs
  // Format: [VoiceID]-[Model]-[Speed]_[Stability]_[Similarity]
  let ttsAttrs = "";
  if (voiceId) {
    const voiceString = `${voiceId}-${model}-${speed.toFixed(1)}_${stability.toFixed(1)}_${similarity.toFixed(1)}`;
    ttsAttrs = `ttsProvider="ElevenLabs" voice="${voiceString}" elevenlabsTextNormalization="on"`;
  }

  res.setHeader("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay
      url="${wsUrl}"
      welcomeGreeting="${greeting}"
      ${ttsAttrs}
    />
  </Connect>
</Response>`);
}
