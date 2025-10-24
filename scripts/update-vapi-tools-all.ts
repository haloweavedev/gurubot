/* eslint-disable */
// Usage:
//  pnpm dlx tsx scripts/update-vapi-tools-all.ts --baseUrl https://gurubot-eosin.vercel.app

// @ts-ignore
import { VapiClient } from "@vapi-ai/server-sdk";

function arg(flag: string, fallback?: string) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
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
    inputSchema: { type: "object", additionalProperties: true },
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
  const tools = buildTools(baseUrl);
  const assistants = await vapi.assistants.list();
  const items = (assistants?.data ?? assistants ?? []) as any[];
  for (const a of items) {
    const id = a.id || a.assistantId;
    if (!id) continue;
    await vapi.assistants.update(id, { tools } as any);
    console.log("Updated tools for:", id);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

