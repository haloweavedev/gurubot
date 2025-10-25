#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/*
 Simulate an ExamBot conversation against a deployed app.
 - Reads /admin/exams/:id (HTML) and /api/exams/:id (JSON)
 - Optionally fetches assistant + tools from Vapi (if VAPI_API_KEY and assistantId provided)
 - Runs the exam flow via API tools: get_exam_context → get_next_question → score_answer → finalize_attempt

 Usage:
   pnpm tsx scripts/simulate-exam.ts --baseUrl https://gurubot-eosin.vercel.app --examId 1 --email you@example.com \
     --assistantId b7986db2-a232-4c5f-8564-dc9f57970318

 Env:
   VAPI_API_KEY=sk_vapi_...
*/

import 'dotenv/config';

function arg(flag: string, fallback?: string) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function trimUrl(u: string) { return u.replace(/\/$/, ''); }

type FetchJson = <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
const fetchJson: FetchJson = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return (await res.json()) as any;
};

async function getAssistantAndTools(opts: { token?: string; assistantId?: string }) {
  if (!opts.token || !opts.assistantId) return undefined;
  // Lazy import to avoid type coupling
  const sdk = await import('@vapi-ai/server-sdk').catch(() => undefined);
  if (!sdk) return undefined;
  const vapi = new (sdk as any).VapiClient({ token: opts.token });
  const a: any = await vapi.assistants.get(opts.assistantId);
  const assistant: any = a?.data ?? a;
  const toolIds: string[] = assistant?.model?.toolIds ?? [];
  const tools: any[] = [];
  for (const id of toolIds) {
    try { const t = await vapi.tools.get(id); tools.push(t?.data ?? t); } catch {}
  }
  const system = Array.isArray(assistant?.model?.messages)
    ? assistant.model.messages.find((m: any) => m?.role === 'system')?.content
    : undefined;
  return { assistant, tools, systemPrompt: system };
}

async function simulate() {
  const baseUrl = trimUrl(arg('--baseUrl', process.env.BASE_URL || 'http://localhost:3000') || 'http://localhost:3000');
  const examId = Number(arg('--examId', '1'));
  const email = arg('--email', 'test@example.com')!;
  const assistantId = arg('--assistantId');
  const vapiKey = process.env.VAPI_API_KEY;

  console.log('--- Fetch Admin Exam HTML ---');
  const adminHtml = await fetch(`${baseUrl}/admin/exams/${examId}`);
  console.log('Admin page status:', adminHtml.status, adminHtml.statusText);

  console.log('\n--- Fetch Exam JSON ---');
  try {
    const exam = await fetchJson<{ exam: any }>(`${baseUrl}/api/exams/${examId}`);
    console.log('Exam:', { id: exam.exam.id, title: exam.exam.title, documents: exam.exam.documents.length });
  } catch (e) {
    console.log('Exam JSON unavailable, continuing (non-fatal).');
  }

  console.log('\n--- Assistant + Tools (Vapi) ---');
  const meta = await getAssistantAndTools({ token: vapiKey, assistantId });
  if (meta) {
    console.log('Assistant name:', meta.assistant?.name);
    console.log('System prompt (first 160 chars):', String(meta.systemPrompt || '').slice(0, 160));
    console.log('Tools:', meta.tools.map((t: any) => ({ id: t.id, name: t?.function?.name || t?.name })));
  } else {
    console.log('Skipped Vapi metadata (missing VAPI_API_KEY or --assistantId).');
  }

  console.log('\n--- Conversation Simulation ---');
  // 1) Context
  const ctx = await fetchJson<{ exam: any } & { attemptId?: number }>(`${baseUrl}/api/vapi/get_exam_context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId, email })
  });
  console.log('Loaded context. Title:', ctx.exam?.title);

  let attemptId: number | undefined = (ctx as any).attemptId;
  let turn = 0;
  const scores: Array<{ qid: string; score: number }> = [];

  while (true) {
    // 2) Next question
    const next = await fetchJson<{ attemptId: number; question: { id: string; prompt: string } | null }>(`${baseUrl}/api/vapi/get_next_question`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ examId, attemptId, email })
    });
    attemptId = next.attemptId;
    if (!next.question) { console.log('No more questions.'); break; }
    turn++;
    console.log(`Q${turn}:`, next.question.prompt);

    // 3) Fake answer
    const answerText = `Here is a concise answer about: ${next.question.prompt.slice(0, 60)}`;

    // 3a) Optionally record transcript
    await fetchJson(`${baseUrl}/api/vapi/record_transcript`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, role: 'user', text: answerText })
    }).catch(() => undefined);

    // 4) Score
    const scored = await fetchJson<{ score: number; rationale: string; followup?: string } & { attemptId: number }>(`${baseUrl}/api/vapi/score_answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, attemptId, email, questionId: next.question.id, prompt: next.question.prompt, answerText })
    });
    console.log(`→ Score: ${scored.score} | Rationale:`, scored.rationale.slice(0, 100));
    if (scored.followup) console.log('Follow-up suggested:', scored.followup);
    scores.push({ qid: next.question.id, score: scored.score });
  }

  if (attemptId) {
    const final = await fetchJson<{ ok: boolean; totalScore: number }>(`${baseUrl}/api/vapi/finalize_attempt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId })
    });
    console.log('\nFinalized attempt:', { totalScore: final.totalScore, qCount: scores.length });
  }

  console.log('\nDone.');
}

simulate().catch((e) => { console.error(e); process.exit(1); });
