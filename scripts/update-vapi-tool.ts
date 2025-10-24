/* eslint-disable */
// Usage:
//  pnpm dlx tsx scripts/update-vapi-tool.ts --name "ExamBot Oral Examiner" --baseUrl https://gurubot-eosin.vercel.app --write-env
// Env:
//  VAPI_API_KEY (required)
//  NEXT_PUBLIC_VAPI_ASSISTANT_ID (optional; if absent, a new assistant is created)

import fs from "node:fs";
import path from "node:path";

// Lazy import to avoid type resolution issues if SDK isn't installed yet
// @ts-ignore
import { VapiClient } from "@vapi-ai/server-sdk";

function arg(flag: string, fallback?: string) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function bool(flag: string) {
  return process.argv.includes(flag);
}

function buildBaseUrl() {
  const fromArg = arg("--baseUrl");
  if (fromArg) return fromArg.replace(/\/$/, "");
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

function buildTools(baseUrl: string) {
  const mk = (name: string, path: string, description: string) => ({
    type: "server",
    name,
    description,
    url: `${baseUrl}${path}`,
    method: "POST",
    // Optional: provide a minimal JSON schema
    inputSchema: {
      type: "object",
      properties: {
        examId: { anyOf: [{ type: "number" }, { type: "string" }] },
        attemptId: { anyOf: [{ type: "number" }, { type: "string" }] },
        email: { type: "string" },
        query: { type: "string" },
        questionId: { type: "string" },
        prompt: { type: "string" },
        answerText: { type: "string" },
        role: { type: "string" },
        text: { type: "string" },
      },
      additionalProperties: true,
    },
    // Vapi may expect where to send the payload. Default: JSON body.
    // If needed, add: bodyType: "json"
  });

  return [
    mk("get_exam_context", "/api/vapi/get_exam_context", "Get objectives, rubric, and plan for an exam"),
    mk("get_next_question", "/api/vapi/get_next_question", "Return next unanswered question for an attempt"),
    mk("score_answer", "/api/vapi/score_answer", "Score an answer 0–5 with rationale"),
    mk("record_transcript", "/api/vapi/record_transcript", "Append transcript utterance"),
    mk("finalize_attempt", "/api/vapi/finalize_attempt", "Finalize attempt and compute total score"),
    mk("search_pdf", "/api/vapi/search_pdf", "Search extracted PDF text for a snippet"),
  ];
}

async function run() {
  const token = process.env.VAPI_API_KEY;
  if (!token) throw new Error("Missing VAPI_API_KEY");
  const vapi = new VapiClient({ token });

  const baseUrl = buildBaseUrl();
  const name = arg("--name", "ExamBot Oral Examiner");
  const writeEnv = bool("--write-env");
  const modelProvider = arg("--provider", "openai");
  const modelName = arg("--model", "gpt-4o");
  const firstMessage = arg("--firstMessage", "Hello! I will guide you through this oral exam.");
  const assistantIdArg = arg("--assistantId", process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);

  const tools = buildTools(baseUrl);

  let assistantId = assistantIdArg;
  if (!assistantId) {
    const created = await vapi.assistants.create({
      name,
      firstMessage,
      model: {
        provider: modelProvider,
        model: modelName,
        messages: [
          { role: "system", content: "You are an oral exam proctor. Ask one question at a time, keep responses under 40 words. Use tools to get questions and score answers." },
        ],
      },
      // @ts-ignore actions/tools shape depends on SDK version
      tools,
    } as any);
    assistantId = created?.id || created?.assistantId || created?.data?.id;
    if (!assistantId) throw new Error("Failed to create assistant: missing id in response");
    console.log("Created assistant:", assistantId);
  } else {
    // Update tools and metadata
    await vapi.assistants.update(assistantId, {
      name,
      // @ts-ignore actions/tools shape depends on SDK version
      tools,
      model: {
        provider: modelProvider,
        model: modelName,
      },
    } as any);
    console.log("Updated assistant:", assistantId);
  }

  if (writeEnv) {
    const envPath = path.join(process.cwd(), ".env.local");
    let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    if (contents.includes("NEXT_PUBLIC_VAPI_ASSISTANT_ID=")) {
      contents = contents.replace(/NEXT_PUBLIC_VAPI_ASSISTANT_ID=.*/g, `NEXT_PUBLIC_VAPI_ASSISTANT_ID=${assistantId}`);
    } else {
      contents += `\nNEXT_PUBLIC_VAPI_ASSISTANT_ID=${assistantId}\n`;
    }
    fs.writeFileSync(envPath, contents);
    console.log("Wrote NEXT_PUBLIC_VAPI_ASSISTANT_ID to .env.local");
  }

  // Also print for CI capture
  console.log(JSON.stringify({ assistantId }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

