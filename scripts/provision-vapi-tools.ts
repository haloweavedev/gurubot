/* eslint-disable */
// Create Vapi tool resources (apiRequest) and attach them to a single assistant via model.toolIds.
// Usage examples:
//  export VAPI_API_KEY=sk_vapi_...
//  export ASSISTANT_ID=b7986db2-a232-4c5f-8564-dc9f57970318
//  pnpm tsx scripts/provision-vapi-tools.ts --baseUrl https://gurubot-eosin.vercel.app
//  pnpm tsx scripts/provision-vapi-tools.ts --assistantId $ASSISTANT_ID --only get_exam_context --baseUrl https://gurubot-eosin.vercel.app

import 'dotenv/config';
// @ts-ignore
import { VapiClient } from '@vapi-ai/server-sdk';

function arg(flag: string, fallback?: string) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function buildBaseUrl() {
  const fromArg = arg('--baseUrl');
  if (fromArg) return fromArg.replace(/\/$/, '');
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

type ToolSpec = { name: string; description: string; path: string };

function getToolSpecs(): ToolSpec[] {
  return [
    { name: 'get_exam_context', description: 'Get objectives, rubric, and plan for an exam', path: '/api/vapi/get_exam_context' },
    { name: 'get_next_question', description: 'Return next unanswered question for an attempt', path: '/api/vapi/get_next_question' },
    { name: 'score_answer', description: 'Score an answer 0–5 with rationale', path: '/api/vapi/score_answer' },
    { name: 'record_transcript', description: 'Append transcript utterance', path: '/api/vapi/record_transcript' },
    { name: 'finalize_attempt', description: 'Finalize attempt and compute total score', path: '/api/vapi/finalize_attempt' },
    { name: 'search_pdf', description: 'Search extracted PDF text for a snippet', path: '/api/vapi/search_pdf' },
  ];
}

function buildApiRequestTool(baseUrl: string, spec: ToolSpec) {
  return {
    type: 'apiRequest',
    name: spec.name,
    description: spec.description,
    url: `${baseUrl}${spec.path}`,
    method: 'POST',
    body: {
      type: 'object',
      properties: {
        examId: { anyOf: [{ type: 'number' }, { type: 'string' }] },
        attemptId: { anyOf: [{ type: 'number' }, { type: 'string' }] },
        email: { type: 'string' },
        query: { type: 'string' },
        questionId: { type: 'string' },
        prompt: { type: 'string' },
        answerText: { type: 'string' },
        role: { type: 'string' },
        text: { type: 'string' },
      },
      additionalProperties: true,
    },
  } as any;
}

async function run() {
  const token = process.env.VAPI_API_KEY;
  if (!token) throw new Error('Missing VAPI_API_KEY');
  const assistantId = arg('--assistantId', process.env.ASSISTANT_ID);
  if (!assistantId) throw new Error('Missing --assistantId or ASSISTANT_ID');

  const vapi = new VapiClient({ token });
  const baseUrl = buildBaseUrl();
  const only = arg('--only');

  const specs = getToolSpecs().filter((s) => !only || s.name === only);
  if (specs.length === 0) throw new Error(`No matching tool for --only ${only}`);

  const created: { name: string; id: string }[] = [];
  for (const spec of specs) {
    const req = buildApiRequestTool(baseUrl, spec);
    const resp = await vapi.tools.create(req);
    // Try to normalize id across SDK shapes
    const tool: any = (resp as any)?.data ?? resp;
    const id = tool?.id || tool?.toolId;
    if (!id) throw new Error(`Tool create returned no id for ${spec.name}`);
    created.push({ name: spec.name, id });
    console.log(`Created tool ${spec.name}: ${id}`);
  }

  // Fetch assistant to preserve provider/model
  const a = await vapi.assistants.get(assistantId);
  const assistant: any = a?.data ?? a;
  const provider = assistant?.model?.provider || 'openai';
  const model = assistant?.model?.model || 'gpt-4o';
  const existingToolIds: string[] = assistant?.model?.toolIds ?? [];
  const ids = Array.from(new Set([...existingToolIds, ...created.map((c) => c.id)]));

  await vapi.assistants.update(assistantId, { model: { provider, model, toolIds: ids } } as any);
  console.log('Attached toolIds to assistant', assistantId, ids);

  console.log(JSON.stringify({ assistantId, tools: created }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

