import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Heading,
  Input,
  Label,
  Paragraph,
  Text,
  Topbar,
  TopbarActions,
  RadioGroup,
  Radio,
  Alert,
  Spinner,
  Select,
  Option,
  Slider,
  Separator,
} from "@twilio-paste/core";

const VOICES = [
  { id: "ZF6FPAbjXT4488VcRRnw", name: "Amelia (British, Female)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (American, Female)" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (American, Female)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (American, Female)" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (American, Male)" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold (American, Male)" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (American, Male)" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam (American, Male)" },
];

const MODELS = [
  { id: "flash_v2_5", name: "Flash v2.5 (Fastest)" },
  { id: "turbo_v2_5", name: "Turbo v2.5 (Higher Quality)" },
];

export default function Home() {
  const [phone, setPhone] = useState("");
  const [workflow, setWorkflow] = useState("Customer support");
  const [status, setStatus] = useState("idle");
  const [callSid, setCallSid] = useState("");
  const [error, setError] = useState("");

  // ElevenLabs settings
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [model, setModel] = useState(MODELS[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);

  const handleCall = async () => {
    if (!phone.trim()) return;
    setStatus("calling");

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone.trim(),
          workflow,
          voiceId,
          model,
          speed,
          stability,
          similarity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCallSid(data.callSid || "");
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  return (
    <Box minHeight="100vh" backgroundColor="colorBackgroundBody">
      <Topbar id="topbar">
        <TopbarActions justify="start">
          <Box display="flex" alignItems="center" columnGap="space40">
            <img src="/twilio-wordmark.svg" alt="Twilio" height="32" />
            <Text as="span" color="colorTextWeak">|</Text>
            <Text as="span" fontWeight="fontWeightSemibold" fontSize="fontSize40">
              ConversationRelay Demo
            </Text>
          </Box>
        </TopbarActions>
      </Topbar>

      <Box maxWidth="500px" margin="0 auto" paddingY="space130" paddingX="space60">
        <Card padding="space80">
          <Heading as="h1" variant="heading20" marginBottom="space0">
            Voice AI Agent
          </Heading>
          <Paragraph marginBottom="space70">
            Enter your phone number and the AI agent will call you.
          </Paragraph>

          {status === "idle" && (
            <>
              <Box marginBottom="space60">
                <Label htmlFor="phone" required>Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+15555550123"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Box>

              <Box marginBottom="space60">
                <RadioGroup
                  name="workflow"
                  legend="Workflow"
                  value={workflow}
                  onChange={setWorkflow}
                >
                  <Radio value="Customer support">Customer support</Radio>
                  <Radio value="Appointment booking">Appointment booking</Radio>
                </RadioGroup>
              </Box>

              <Separator orientation="horizontal" verticalSpacing="space60" />

              <Text as="p" fontWeight="fontWeightSemibold" marginBottom="space50">
                ElevenLabs Voice Settings
              </Text>

              <Box marginBottom="space50">
                <Label htmlFor="voice">Voice</Label>
                <Select id="voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                  {VOICES.map((v) => (
                    <Option key={v.id} value={v.id}>{v.name}</Option>
                  ))}
                </Select>
              </Box>

              <Box marginBottom="space50">
                <Label htmlFor="model">Model</Label>
                <Select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODELS.map((m) => (
                    <Option key={m.id} value={m.id}>{m.name}</Option>
                  ))}
                </Select>
              </Box>

              <Box marginBottom="space50">
                <Label htmlFor="speed">Speed: {speed.toFixed(2)}</Label>
                <Slider
                  id="speed"
                  value={speed}
                  minValue={0.7}
                  maxValue={1.2}
                  step={0.05}
                  onChange={(val) => setSpeed(val)}
                />
                <Text as="p" fontSize="fontSize20" color="colorTextWeak">
                  0.7 (slower) to 1.2 (faster)
                </Text>
              </Box>

              <Box marginBottom="space50">
                <Label htmlFor="stability">Stability: {stability.toFixed(2)}</Label>
                <Slider
                  id="stability"
                  value={stability}
                  minValue={0}
                  maxValue={1}
                  step={0.05}
                  onChange={(val) => setStability(val)}
                />
                <Text as="p" fontSize="fontSize20" color="colorTextWeak">
                  Lower = more expressive, Higher = more consistent
                </Text>
              </Box>

              <Box marginBottom="space70">
                <Label htmlFor="similarity">Similarity: {similarity.toFixed(2)}</Label>
                <Slider
                  id="similarity"
                  value={similarity}
                  minValue={0}
                  maxValue={1}
                  step={0.05}
                  onChange={(val) => setSimilarity(val)}
                />
                <Text as="p" fontSize="fontSize20" color="colorTextWeak">
                  Higher = closer to original voice
                </Text>
              </Box>

              <Button variant="primary" fullWidth onClick={handleCall} disabled={!phone.trim()}>
                Call me
              </Button>
            </>
          )}

          {status === "calling" && (
            <Box display="flex" flexDirection="column" alignItems="center" rowGap="space50" paddingY="space70">
              <Spinner decorative size="sizeIcon80" />
              <Text>Calling {phone}...</Text>
            </Box>
          )}

          {status === "success" && (
            <Box display="flex" flexDirection="column" alignItems="center" rowGap="space50" paddingY="space70">
              <Alert variant="neutral">
                <strong>Call initiated!</strong> Answer your phone to talk to the AI agent.
              </Alert>
              {callSid && <Text fontSize="fontSize20" color="colorTextWeak">{callSid}</Text>}
              <Button variant="secondary" onClick={() => setStatus("idle")}>Start over</Button>
            </Box>
          )}

          {status === "error" && (
            <Box display="flex" flexDirection="column" alignItems="center" rowGap="space50" paddingY="space70">
              <Alert variant="error">{error}</Alert>
              <Button variant="secondary" onClick={() => setStatus("idle")}>Try again</Button>
            </Box>
          )}
        </Card>
      </Box>
    </Box>
  );
}
