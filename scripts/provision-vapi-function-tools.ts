/* eslint-disable */
// Provision function-type tools in Vapi and attach them to an assistant.
// Usage examples:
//  export VAPI_API_KEY=sk_vapi_...
//  pnpm tsx scripts/provision-vapi-function-tools.ts --assistantId b7986db2-a232-4c5f-8564-dc9f57970318 --baseUrl https://your-app.example
//  pnpm tsx scripts/provision-vapi-function-tools.ts --assistantId $ASSISTANT_ID --orgId demo --baseUrl https://gurubot-eosin.vercel.app

import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
// @ts-ignore
import { VapiClient } from '@vapi-ai/server-sdk';
import type { VapiFunctionTool } from '@/lib/voice/vapi-types';
import { getAllFunctionTools } from '@/lib/voice/vapi-tools';

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

async function main() {
  const token = process.env.VAPI_API_KEY;
  if (!token) throw new Error('Missing VAPI_API_KEY');
  const assistantId = arg('--assistantId', process.env.ASSISTANT_ID);
  if (!assistantId) throw new Error('Missing --assistantId or ASSISTANT_ID');

  const vapi = new VapiClient({ token });

  // Fetch existing tools and build name→tool map
  const listRaw: any = await (vapi as any).tools.list();
  const remoteList: any[] = Array.isArray(listRaw) ? listRaw : (listRaw?.data ?? listRaw?.items ?? []);
  const byName = new Map(remoteList.map((t: any) => [t?.function?.name || t?.name, t]));

  // Prepare local function tools
  const localTools: VapiFunctionTool[] = getAllFunctionTools();

  const created: { name: string; id: string }[] = [];
  const ensured: { name: string; id: string }[] = [];

  for (const t of localTools) {
    const name = t.function.name;
    const remote = byName.get(name);
    if (remote?.id) {
      // Patch function fields
      const payload: any = { function: { name: t.function.name, description: t.function.description, parameters: t.function.parameters } };
      if (t.function.rejectionPlan) (payload as any).rejectionPlan = t.function.rejectionPlan;
      await vapi.tools.update(remote.id, payload);
      ensured.push({ name, id: remote.id });
    } else {
      // Create as function-type tool
      const createPayload: any = {
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
          ...(t.function.strict !== undefined ? { strict: t.function.strict } : {}),
          ...(t.function.maxTokens !== undefined ? { maxTokens: t.function.maxTokens } : {}),
        },
        ...(t.messages ? { messages: t.messages } : {}),
        ...(t.server ? { server: t.server } : {}),
        ...(t.function.rejectionPlan ? { rejectionPlan: t.function.rejectionPlan } : {}),
      };
      const createdResp: any = await vapi.tools.create(createPayload);
      const id = createdResp?.id || createdResp?.data?.id;
      if (!id) throw new Error(`Create returned no id for ${name}`);
      created.push({ name, id });
      ensured.push({ name, id });
    }
  }

  // Update assistant: attach toolIds and system prompt; set webhook server URL
  const baseUrl = buildBaseUrl();
  const orgId = arg('--orgId', process.env.VAPI_ORG_ID || 'demo');
  const serverUrl = `${baseUrl}/api/vapi/webhook/${orgId}`;

  // Read system prompt from prompts/exambot-system-prompt.txt if present
  const promptPath = path.join(process.cwd(), 'prompts', 'exambot-system-prompt.txt');
  const systemPrompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : 'You are a voice-first AI examiner. Be concise; drive the exam.';

  const assistantRaw: any = await vapi.assistants.get(assistantId);
  const assistant: any = assistantRaw?.data ?? assistantRaw;
  const provider = assistant?.model?.provider || 'openai';
  const model = assistant?.model?.model || 'gpt-4o-mini';
  const existingToolIds: string[] = assistant?.model?.toolIds ?? [];
  const ids = Array.from(new Set([...existingToolIds, ...ensured.map((e) => e.id)]));

  await vapi.assistants.update(assistantId, {
    model: {
      provider,
      model,
      toolIds: ids,
      messages: [{ role: 'system', content: systemPrompt }],
    },
    server: { url: serverUrl },
    serverMessages: ['function-call', 'end-of-call-report'],
  } as any);

  console.log(JSON.stringify({ assistantId, serverUrl, tools: ensured }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
