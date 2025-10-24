# Vapi Assistant: End‑to‑End Standalone Guide

A practical, copy‑pasteable guide to build a voice‑first assistant with Vapi — from defining tools and wiring webhooks to provisioning an assistant and updating tool definitions. This condenses proven patterns from a production implementation into a single, self‑contained setup you can adapt for ExamBot or any domain.


## What You’ll Build

- A set of OpenAI‑style function tools that Vapi can call
- A webhook server that handles `tool-calls` and `end-of-call-report`
- Deterministic tool handler pattern that updates per‑call state and returns results Vapi can speak
- Scripts to patch Vapi tool definitions in place (safe “config‑as‑code”)
- An assistant with voice, model, system prompt, and webhook configuration

This guide uses TypeScript and plain Node/Express for clarity. You can swap Express for a Next.js API route with the same logic.


## Prerequisites

- Node 18+
- TypeScript + tsx (or ts-node)
- Accounts/keys as needed:
  - Vapi API key (`VAPI_API_KEY`)
  - OpenAI API key (`OPENAI_API_KEY`) if your tools call LLMs
  - A public HTTPS URL for your webhook (use ngrok or deploy)
- Optional but recommended: a database for state (Postgres/Supabase). For simplicity, this guide includes an in‑memory fallback you can replace with your DB layer.


## Concepts At A Glance

- Tools: JSON‑schema function definitions the model is allowed to call.
- Webhook: Your server receives events from Vapi, including `tool-calls` and `end-of-call-report`.
- State: Vapi does not persist your conversation state; you do (keyed by `call.id`).
- Results contract: You must respond with `{ results: [{ toolCallId, result, error?, message? }] }`.
- Provisioning: Create/patch tools in Vapi, then attach tool IDs to your assistant config.


## 1) Minimal Vapi Types (copy/paste)

Create `src/vapi-types.ts`:

```ts
export interface VapiToolFunctionParameters {
  type: "object";
  properties: Record<string, { type: "string" | "number" | "boolean"; description: string }>;
  required?: string[];
}

export interface VapiRejectionCondition { type: "liquid"; liquid: string }
export interface VapiRejectionPlan { conditions: VapiRejectionCondition[] }

export interface VapiToolFunction {
  name: string;
  description: string;
  parameters: VapiToolFunctionParameters;
  strict?: boolean;
  maxTokens?: number;
  rejectionPlan?: VapiRejectionPlan;
}

export interface VapiTool {
  type: "function";
  function: VapiToolFunction;
  server?: { url: string; timeoutSeconds?: number; async?: boolean };
  messages?: unknown[]; // optional pre/post tool messages
}

// Incoming webhook message (abbreviated to what you need)
export interface VapiToolCallItem {
  id: string; // toolCallId
  type: "function";
  function: { name: string; arguments: Record<string, unknown> | string };
}

export interface VapiWebhookMessageBase {
  timestamp: number;
  type: string;
  call: { id: string; orgId?: string; assistantId?: string; status?: string; startedAt?: string; endedAt?: string; endedReason?: string; cost?: number };
}

export interface VapiToolCallsMessage extends VapiWebhookMessageBase {
  type: "tool-calls";
  toolCallList?: VapiToolCallItem[]; // primary field Vapi uses
  toolCalls?: VapiToolCallItem[]; // legacy/compat
}

export interface VapiEndOfCallReportMessage extends VapiWebhookMessageBase {
  type: "end-of-call-report";
  summary?: string;
  transcript?: string | { url?: string; text?: string };
}

export type VapiWebhookMessage = VapiToolCallsMessage | VapiEndOfCallReportMessage | VapiWebhookMessageBase;
```


## 2) Define Tools (single source of truth)

Mirror the proven “config‑as‑code” pattern: define all tools in one place and deploy them to Vapi via scripts.

Create `src/tools.ts`:

```ts
import type { VapiTool } from "./vapi-types";

export const toolDefinitionMap = {
  // Example 1: classify the user’s request (first step in many flows)
  findAppointmentType(): VapiTool {
    return {
      type: "function",
      function: {
        name: "findAppointmentType",
        description:
          "Identify what the user needs (e.g., cleaning, pain, consult). If they state they are new/existing, include patientStatus.",
        parameters: {
          type: "object",
          properties: {
            patientRequest: { type: "string", description: "User’s stated reason for calling." },
            patientStatus: { type: "string", description: "Optional: 'new' or 'existing' if stated or implied." },
          },
          required: ["patientRequest"],
        },
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  // Example 2: show available slots (pattern shows good JSON parameter design)
  checkAvailableSlots(): VapiTool {
    return {
      type: "function",
      function: {
        name: "checkAvailableSlots",
        description:
          "Find available times for the selected service. Default to first-available; only include preferences the user explicitly mentioned.",
        parameters: {
          type: "object",
          properties: {
            preferredDaysOfWeek: { type: "string", description: "JSON string array: [\"Monday\", \"Wednesday\"]." },
            timeBucket: { type: "string", description: "One of: Early, Morning, Midday, Afternoon, Evening, Late, AllDay." },
            requestedDate: { type: "string", description: "\"tomorrow\", \"next Wednesday\", \"July 10th\"." },
            requestedTime: { type: "string", description: "\"3pm\", \"around 10:30 AM\"." },
            searchWindowDays: { type: "number", description: "Internal: override search days window." },
          },
          required: [],
        },
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  // Example 3: confirm/select a slot and then book with explicit confirmation
  selectAndBookSlot(): VapiTool {
    return {
      type: "function",
      function: {
        name: "selectAndBookSlot",
        description:
          "Match a user’s selection to a specific slot; after user confirms, finalize the booking. Use appointmentNote only on final confirmation.",
        parameters: {
          type: "object",
          properties: {
            userSelection: { type: "string", description: "\"10 AM\", \"the first one\", \"8:30\"." },
            finalConfirmation: { type: "boolean", description: "True only after verbal confirmation of date+time." },
            appointmentNote: { type: "string", description: "Optional note for the office on final confirmation." },
          },
          required: ["userSelection"],
        },
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  // Add more tools as needed (cancel, insuranceInfo, etc.)
} as const;

export function getAllTools(): VapiTool[] {
  return [
    toolDefinitionMap.findAppointmentType(),
    toolDefinitionMap.checkAvailableSlots(),
    toolDefinitionMap.selectAndBookSlot(),
  ];
}
```

Notes
- Match the parameter schema OpenAI tools expect (object → properties → type/description).
- The optional `messages` array lets you define pre/post tool speech, but most logic should live in handlers.
- Keep descriptions directive, short, and safe — they steer the LLM.


## 3) Webhook Server (Express)

Vapi posts events to your webhook. You handle two critical types:
- `tool-calls`: run your tool handlers, update state, return `{ results: [...] }`.
- `end-of-call-report`: log summary/transcript and clean up state.

Create `src/server.ts`:

```ts
import express from "express";
import bodyParser from "body-parser";
import type { VapiWebhookMessage, VapiToolCallsMessage, VapiToolCallItem } from "./vapi-types";

// Simple in-memory state (replace with DB in production)
const sessionState = new Map<string, any>(); // key: callId → your arbitrary state object

// Optional: protect webhook with a static Bearer credential from Vapi dashboard
const REQUIRED_BEARER = process.env.VAPI_WEBHOOK_BEARER || ""; // set to the credential secret you configure in Vapi

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));

function authOk(req: express.Request): boolean {
  if (!REQUIRED_BEARER) return true; // no auth configured
  const h = req.header("authorization") || req.header("Authorization");
  if (!h) return false;
  const token = h.replace(/^Bearer\s+/i, "");
  return token === REQUIRED_BEARER;
}

// Dispatch tool calls to handlers by function name
const handlers: Record<string, (ctx: { orgId?: string; state: any; args: any; toolCallId: string }) => Promise<{ toolResponse: any; newState: any }>> = {
  async findAppointmentType({ state, args, toolCallId }) {
    // Example deterministic logic (swap for your domain):
    const acknowledgment = `Got it — ${args.patientRequest}.`;
    const newState = { ...state, intent: { request: args.patientRequest, status: args.patientStatus } };
    return {
      toolResponse: { toolCallId, result: { success: true, acknowledgment } },
      newState,
    };
  },

  async checkAvailableSlots({ state, args, toolCallId }) {
    // Demo: mock three times. In production, query your scheduling system.
    const offered = ["9:00 AM", "11:30 AM", "3:15 PM"];
    const message = `For your ${state?.intent?.request || "appointment"}, I have ${offered.join(", ")}. Would any of those work?`;
    const newState = { ...state, slots: offered };
    return { toolResponse: { toolCallId, result: message, message: { type: "request-complete", content: message } }, newState };
  },

  async selectAndBookSlot({ state, args, toolCallId }) {
    const selection = String(args.userSelection || "").toLowerCase();
    const matched = (state?.slots || []).find((s: string) => s.toLowerCase().includes(selection.replace(/[^\dapm:]/g, "")));
    if (!matched) {
      const err = "I’m not sure which time you mean. Could you repeat the time?";
      return { toolResponse: { toolCallId, error: err, message: { type: "request-failed", content: err } }, newState: state };
    }

    // If not yet confirmed, ask for explicit confirmation
    if (!args.finalConfirmation) {
      const confirm = `Just to confirm, I have you down for ${matched}. Does that sound right?`;
      return { toolResponse: { toolCallId, result: confirm, message: { type: "request-complete", content: confirm } }, newState: { ...state, selected: matched } };
    }

    // On confirmation, "book" and clear options
    const success = `You’re all set for ${state.selected || matched}. I’ll send a confirmation shortly. Anything else I can help with?`;
    const newState = { ...state, bookedFor: state.selected || matched, slots: [], selected: undefined };
    return { toolResponse: { toolCallId, result: success, message: { type: "request-complete", content: success } }, newState };
  },
};

app.post("/webhook/:orgId", async (req, res) => {
  if (!authOk(req)) return res.status(401).json({ error: "unauthorized" });

  const body = req.body as { message: VapiWebhookMessage };
  const msg = body?.message;
  if (!msg) return res.status(200).json({ status: "ignored" });

  const orgId = (req.params?.orgId || (msg as any)?.call?.orgId) as string | undefined;

  // tool-calls
  if (msg.type === "tool-calls") {
    const toolMsg = msg as VapiToolCallsMessage;
    const callId = toolMsg.call.id;
    const toolCalls = toolMsg.toolCallList || toolMsg.toolCalls || [];

    if (!toolCalls.length) return res.status(200).json({ message: "No tool calls" });

    // Load or initialize state
    const prior = sessionState.get(callId) || {};
    let state = { ...prior, callId };

    const results: Array<{ toolCallId: string; result?: any; error?: string; message?: { type: string; content: string } }> = [];

    for (const item of toolCalls) {
      const toolCallId = item.id;
      const name = item.function.name;
      const rawArgs = item.function.arguments;
      const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;

      const handler = handlers[name];
      if (!handler) {
        results.push({ toolCallId, error: `Unknown tool: ${name}` });
        continue;
      }

      try {
        const { toolResponse, newState } = await handler({ orgId, state, args, toolCallId });
        state = newState;
        results.push({
          toolCallId: toolResponse.toolCallId,
          result: typeof toolResponse.result === "string" ? toolResponse.result : JSON.stringify(toolResponse.result),
          error: toolResponse.error,
          message: toolResponse.message,
        });
      } catch (e) {
        results.push({ toolCallId, error: `Internal error in ${name}` });
      }
    }

    sessionState.set(callId, state);
    return res.status(200).json({ results });
  }

  // end-of-call-report
  if (msg.type === "end-of-call-report") {
    const callId = msg.call.id;
    const summary = (msg as any).summary;
    const transcript = (msg as any).transcript;

    // Persist or process as needed. For demo, log and cleanup.
    console.log("[EOC] call:", callId, { summary, transcript });
    sessionState.delete(callId);
    return res.status(200).json({ status: "logged" });
  }

  return res.status(200).json({ status: "ignored" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Vapi webhook listening on :${port}`));
```

Key points from production patterns
- Always return 200 with the `{ results: [...] }` envelope; include `toolCallId` exactly as received.
- `arguments` may arrive as stringified JSON or an object; parse defensively.
- Persist state by `call.id`. In production, use a DB keyed on `callId` with JSON state.


## 4) Update Vapi Tools In‑Place (safe patch scripts)

Keep tools in code and push changes to Vapi. The API accepts updates to `function.{name,description,parameters}` and top‑level `rejectionPlan` (do not send `type/strict/maxTokens` at top level).

Create `scripts/update-vapi-tool.ts`:

```ts
#!/usr/bin/env tsx
import axios from "axios";
import prompts from "prompts";
import { diffJson } from "diff";
import { toolDefinitionMap } from "../src/tools";
import "dotenv/config";

const VAPI_API_BASE_URL = "https://api.vapi.ai";
const VAPI_API_KEY = process.env.VAPI_API_KEY!;
const headers = { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" };

function buildPatchPayload(local: any) {
  const f = local.function;
  const payload: any = { function: { name: f.name, description: f.description, parameters: f.parameters } };
  if (f.rejectionPlan) payload.rejectionPlan = f.rejectionPlan;
  return payload;
}

function printDiff(a: object, b: object) {
  diffJson(a, b).forEach(part => {
    const color = part.added ? "\x1b[32m" : part.removed ? "\x1b[31m" : "\x1b[90m";
    process.stdout.write(color + part.value);
  });
  console.log("\x1b[0m");
}

async function main() {
  const [toolName, toolId] = process.argv.slice(2);
  if (!toolName || !toolId) {
    console.error("Usage: tsx scripts/update-vapi-tool.ts <toolName> <toolId>");
    process.exit(1);
  }
  const getTool = (toolDefinitionMap as any)[toolName];
  if (!getTool) throw new Error(`Local tool not found: ${toolName}`);

  const local = getTool();
  const { data: remote } = await axios.get(`${VAPI_API_BASE_URL}/tool/${toolId}`, { headers });
  const payload = buildPatchPayload(local);

  const target = { ...remote, function: { ...remote.function, ...payload.function } };
  if (payload.rejectionPlan !== undefined) (target as any).rejectionPlan = payload.rejectionPlan;

  console.log("\n--- Proposed diff ---\n");
  printDiff(remote, target);
  const { ok } = await prompts({ type: "confirm", name: "ok", message: `Patch ${toolName} (${toolId})?`, initial: false });
  if (!ok) return console.log("Cancelled");

  await axios.patch(`${VAPI_API_BASE_URL}/tool/${toolId}`, payload, { headers });
  console.log("✅ Updated");
}

main().catch(e => { console.error(e); process.exit(1); });
```

Create `scripts/update-vapi-tools-all.ts`:

```ts
#!/usr/bin/env tsx
import axios from "axios";
import prompts from "prompts";
import { diffJson } from "diff";
import { toolDefinitionMap } from "../src/tools";
import "dotenv/config";

const VAPI_API_BASE_URL = "https://api.vapi.ai";
const VAPI_API_KEY = process.env.VAPI_API_KEY!;
const headers = { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" };

const buildPayload = (t: any) => {
  const f = t.function; const p: any = { function: { name: f.name, description: f.description, parameters: f.parameters } };
  if (f.rejectionPlan) p.rejectionPlan = f.rejectionPlan; return p;
};

async function fetchRemote() { const r = await axios.get(`${VAPI_API_BASE_URL}/tool`, { headers }); return r.data as any[]; }
async function patch(id: string, payload: any) { await axios.patch(`${VAPI_API_BASE_URL}/tool/${id}`, payload, { headers }); }
function printDiff(a: object, b: object) { diffJson(a, b).forEach(p => { const c = p.added?"\x1b[32m":p.removed?"\x1b[31m":"\x1b[90m"; process.stdout.write(c + p.value); }); console.log("\x1b[0m"); }

async function main() {
  const remote = await fetchRemote();
  const byName = new Map(remote.map((r: any) => [r?.function?.name || r?.name, r]));

  const plans: Array<{ name: string; id: string; payload: any; target: any; remote: any }> = [];
  for (const [k, get] of Object.entries(toolDefinitionMap) as Array<[string, () => any]>) {
    const local = get(); const name = local?.function?.name || k; const r = byName.get(name);
    if (!r?.id) { console.warn(`Skip: no remote for ${name}`); continue; }
    const payload = buildPayload(local);
    const target = { ...r, function: { ...r.function, ...payload.function } };
    if (payload.rejectionPlan !== undefined) (target as any).rejectionPlan = payload.rejectionPlan;
    console.log(`\n🔧 ${name} (${r.id})`); printDiff(r, target);
    plans.push({ name, id: r.id, payload, target, remote: r });
  }

  if (!plans.length) return console.log("Nothing to update");
  const { ok } = await prompts({ type: "confirm", name: "ok", message: `Apply ${plans.length} updates?`, initial: false });
  if (!ok) return console.log("Cancelled");

  let success = 0, failure = 0; for (const p of plans) { try { await patch(p.id, p.payload); success++; } catch (e) { console.error(e); failure++; } }
  console.log(`Done. Success: ${success}, Failed: ${failure}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

Usage

- Set `VAPI_API_KEY` in your environment.
- Ensure your tools exist in Vapi (created once via dashboard or API). These scripts patch existing tools by matching `function.name`.
- Run a single tool update:
  - `tsx scripts/update-vapi-tool.ts checkAvailableSlots <VAPI_TOOL_ID>`
- Patch all tools in place:
  - `tsx scripts/update-vapi-tools-all.ts`


## 5) Create an Assistant (API)

Provision an assistant with voice, prompt, and webhook. Set `server.url` to your public webhook and, optionally, attach a Vapi Bearer credential you created in the Vapi dashboard.

Create `scripts/create-assistant.ts`:

```ts
#!/usr/bin/env tsx
import "dotenv/config";

const VAPI_API_BASE_URL = "https://api.vapi.ai";
const VAPI_API_KEY = process.env.VAPI_API_KEY!;

// Provide your existing tool IDs here (from Vapi dashboard or API)
const TOOL_IDS = (process.env.VAPI_TOOL_IDS || "").split(",").filter(Boolean);

async function main() {
  const res = await fetch(`${VAPI_API_BASE_URL}/assistant`, {
    method: "POST",
    headers: { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "ExamBot-Prototype",
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 0.6,
        maxTokens: 1500,
        messages: [
          { role: "system", content: process.env.EXAMBOT_SYSTEM_PROMPT || "You are a voice-first AI examiner." }
        ],
        toolIds: TOOL_IDS,
      },
      voice: { provider: "vapi", voiceId: "Elliot" },
      firstMessage: "Hi there — ready to begin?",
      server: process.env.VAPI_WEBHOOK_CREDENTIAL_ID ? { url: process.env.WEBHOOK_URL, credentialId: process.env.VAPI_WEBHOOK_CREDENTIAL_ID } : undefined,
      serverMessages: ["function-call", "end-of-call-report"],
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 1800,
      backgroundSound: "office",
      backchannelingEnabled: true,
      backgroundDenoisingEnabled: true,
      modelOutputInMessagesEnabled: false,
      metadata: { app: "exambot" },
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  console.log("Assistant:", JSON.stringify(json, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
```

Notes
- You can also attach phone numbers via the Vapi API (`/phone-number`) or use web calls in Vapi clients.
- To change TTS provider/voice, update the `voice` block (e.g., ElevenLabs/PlayHT/Lmnt).


## 6) Webhook Payloads and Responses (exact shapes)

Incoming `tool-calls` (example):

```json
{
  "message": {
    "timestamp": 1678901234567,
    "type": "tool-calls",
    "toolCallList": [
      {
        "id": "toolu_01DTPAzUm5Gk3zxrpJ969oMF",
        "type": "function",
        "function": { "name": "checkAvailableSlots", "arguments": { "timeBucket": "Morning" } }
      }
    ],
    "call": { "id": "call-uuid", "orgId": "org-uuid" }
  }
}
```

Your response must be:

```json
{
  "results": [
    { "toolCallId": "toolu_01DTPAzUm5Gk3zxrpJ969oMF", "result": "I have 9:00 AM or 11:30 AM — do either work?" }
  ]
}
```

You can also send an explicit message for the assistant to speak:

```json
{
  "results": [
    {
      "toolCallId": "abc123",
      "result": "ok",
      "message": { "type": "request-complete", "content": "All set. Ready for the next step." }
    }
  ]
}
```

Error shape (still HTTP 200):

```json
{
  "results": [
    {
      "toolCallId": "abc123",
      "error": "No available slots found",
      "message": { "type": "request-failed", "content": "I couldn’t find any available times." }
    }
  ]
}
```

End‑of‑call report example:

```json
{
  "message": {
    "type": "end-of-call-report",
    "summary": "User scheduled a cleaning.",
    "transcript": "... full call transcript ...",
    "call": { "id": "call-uuid", "startedAt": "...", "endedAt": "...", "endedReason": "assistant-ended-call" }
  }
}
```


## 7) System Prompt Pattern (voice‑first)

Use a short, directive system prompt that forbids filler, keeps a brisk cadence, and drives the flow — a proven pattern from production voice agents:

```text
You are a friendly, highly efficient voice assistant. Speak concisely, never narrate your tools or thinking (no “let me check”). Pause briefly (~0.8s) while tools run, then deliver results.
Always drive the conversation to the next step.
```

For ExamBot, seed domain guidance and the core loop (ask → listen → score → follow‑up → wrap‑up). Keep the rubric/learning objectives out of model chat if possible and load them via tools for privacy/rotation.


## 8) Adaptation Notes For ExamBot

- Tools to consider:
  - `startExam(examId)` → loads questions, rubric, context
  - `nextQuestion(state)` → returns the next question, may tailor based on past answers
  - `submitAnswer(questionId, transcript)` → stores the response, returns optional follow‑up prompt
  - `scoreExam(transcript, rubric)` → structured rubric scores + feedback
  - `finalizeExam()` → generates written + spoken summary, persists results
- Your webhook logic stays identical: Vapi calls tools, you mutate state keyed by `call.id`, you reply with `{ results: [...] }`.
- For voice polish, set `firstMessage` to a brief welcome and ensure your tools return “assistant‑speakable” sentences via the `message` field.
- For instant feedback: call `scoreExam` at the end‑of‑call (triggered from `end-of-call-report`) so the user hears a tight summary right after the last answer.


## 9) Security, State, and Ops

- Webhook auth: In Vapi dashboard, create a Server Credential (Bearer). Configure it on the assistant and check the `Authorization: Bearer ...` header in your webhook (as shown above).
- State: Persist by `call.id`. Clean up on `end-of-call-report`. For idempotency, make handlers safe to re‑run.
- Logging: Log tool names, args, and state IN/OUT per tool for fast triage.
- Availability: Always respond 200; never block long work in webhooks — fire and forget background tasks when needed.
- Testing: Use Vapi’s console, or create web calls via API and watch logs. Simulate tool payloads locally with curl/postman.


## 10) Common Pitfalls

- Arguments sometimes arrive as a JSON string; parse if `typeof args === 'string'`.
- Returning objects is fine, but many stacks prefer `result` as a string; stringify deterministically when in doubt.
- Over‑prompting: keep system prompts directive and short; put procedural details in tools and handlers.
- Assistant not speaking your exact copy: include `message: { type, content }` in your tool results to control speech.


## 11) Quick Checklist

- Tool definitions live in code and are patched into Vapi via scripts.
- Webhook receives `tool-calls`, dispatches handlers, updates state, and returns `{ results }`.
- `end-of-call-report` logs summary/transcript and clears state.
- Assistant configured with `server.url`, `serverMessages`, model + voice, and `toolIds`.
- Local testing via ngrok and Vapi console before production.


## 12) Example .env

```env
PORT=3001
WEBHOOK_URL=https://your-ngrok-or-domain/webhook/my-org
VAPI_API_KEY=sk_vapi_...
VAPI_WEBHOOK_BEARER=your-server-credential-secret  # created in Vapi dashboard
VAPI_WEBHOOK_CREDENTIAL_ID=cred_...                # optional: attach on assistant creation
VAPI_TOOL_IDS=tool_abc,tool_def                    # existing tool IDs to attach to assistant
OPENAI_API_KEY=sk_...
EXAMBOT_SYSTEM_PROMPT=You are a voice-first AI examiner. Be concise; drive the exam.
```


---

This “standalone” pattern matches production‑grade agents without relying on any monorepo wiring. For a deeper dive, extend the handlers to call your own services, swap the in‑memory state for a database, and enforce webhook authentication in all environments.