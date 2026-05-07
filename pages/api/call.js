/**
 * API endpoint to initiate outbound calls.
 *
 * Creates a Twilio Voice call to the specified phone number and connects
 * it to ConversationRelay via the /api/twiml endpoint.
 *
 * @route POST /api/call
 * @body {string} to - Phone number to call (E.164 format)
 * @body {string} workflow - "Customer support" or "Appointment booking"
 * @body {string} voiceId - ElevenLabs voice ID
 * @body {string} model - ElevenLabs model ID
 * @body {number} speed - Voice speed (0.7-1.2)
 * @body {number} stability - Voice stability (0-1)
 * @body {number} similarity - Voice similarity (0-1)
 * @returns {object} { ok: true, callSid: string } on success
 */

import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, workflow, voiceId, model, speed, stability, similarity } = req.body;
  if (!to) return res.status(400).json({ error: "Missing phone number" });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, NGROK_URL } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return res.status(500).json({ error: "Missing Twilio credentials" });
  }
  if (!NGROK_URL) {
    return res.status(500).json({ error: "Missing NGROK_URL" });
  }

  const mode = workflow === "Appointment booking" ? "booking" : "support";

  // Build query params for TwiML endpoint
  const params = new URLSearchParams({ mode });
  if (voiceId) params.set("voiceId", voiceId);
  if (model) params.set("model", model);
  if (speed !== undefined) params.set("speed", speed);
  if (stability !== undefined) params.set("stability", stability);
  if (similarity !== undefined) params.set("similarity", similarity);

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const call = await client.calls.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      url: `https://${NGROK_URL}/api/twiml?${params.toString()}`,
      method: "POST",
    });
    res.json({ ok: true, callSid: call.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
