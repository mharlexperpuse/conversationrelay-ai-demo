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

  // Build voice parameter string
  const voiceParam = encodeURIComponent(
    `${voiceId || "ZF6FPAbjXT4488VcRRnw"}-${model || "flash_v2_5"}-${speed || 1.0}_${stability || 0.5}_${similarity || 0.75}`
  );

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const call = await client.calls.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      url: `https://${NGROK_URL}/api/twiml?mode=${mode}&voice=${voiceParam}`,
      method: "POST",
    });
    res.json({ ok: true, callSid: call.sid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
