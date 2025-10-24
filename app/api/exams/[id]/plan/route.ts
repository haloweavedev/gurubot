import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { generateText } from "ai";
import { fetchAndExtractPdf } from "@/lib/pdf/extract";
import { openai } from "@ai-sdk/openai";

const planSchema = z.object({
  outline: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().optional(),
      })
    )
    .min(1),
  questions: z
    .array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        competency: z.string().optional(),
      })
    )
    .min(3)
    .max(12),
  rubricSummary: z.string(),
  objectives: z.string().min(10),
  rubric: z.string().min(10),
});

export async function POST(
  req: Request,
  context: unknown
) {
  const params = (context as { params?: Record<string, string> }).params ?? {};
  const url = (() => {
    try {
      return new URL(req.url);
    } catch {
      return undefined;
    }
  })();

  // Helper to parse JSON safely without throwing
  async function tryParseJson<T>(): Promise<T | undefined> {
    try {
      return (await req.clone().json()) as T;
    } catch {
      return undefined;
    }
  }

  const pathMatch = url?.pathname.match(/\/api\/exams\/(\d+)\/plan/);
  const pathId = pathMatch ? Number(pathMatch[1]) : NaN;
  let idNum = Number(params.id);
  if (!Number.isFinite(idNum) && Number.isFinite(pathId)) idNum = pathId;
  if (!Number.isFinite(idNum)) {
    const body = await tryParseJson<{ id?: number | string }>();
    if (body?.id != null) idNum = Number(body.id);
  }

  if (!Number.isFinite(idNum)) {
    console.error("[exams:plan] Invalid exam id", {
      url: url?.toString(),
      pathname: url?.pathname,
      params,
    });
    return NextResponse.json({ error: "Invalid exam id" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: idNum },
    include: { documents: true },
  });
  if (!exam) {
    console.error("[exams:plan] Exam not found", { id: idNum });
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const docNames = exam.documents.map((d) => d.name);

  // Extract PDF text if missing, for MVP only PDFs are supported
  let corpus = "";
  for (const doc of exam.documents) {
    if (doc.mimeType.includes("pdf") && !doc.text) {
      try {
        const text = await fetchAndExtractPdf(doc.url);
        await prisma.document.update({ where: { id: doc.id }, data: { text } });
        corpus += `\n\n## Document: ${doc.name}\n${text}`;
      } catch (e) {
        console.warn("[exams:plan] PDF extract failed", { docId: doc.id, name: doc.name, url: doc.url, error: (e as Error)?.message });
      }
    } else if (doc.text) {
      corpus += `\n\n## Document: ${doc.name}\n${doc.text}`;
    }
  }
  // Truncate to avoid excessive tokens
  if (corpus.length > 60000) corpus = corpus.slice(0, 60000);

  const prompt = `You are an expert educator designing an oral exam.
Given the exam title, learning objectives, rubric text, and a list of document names, produce:
- A short outline of 3-6 sections
- 5-10 competency questions
- A brief rubric summary for evaluators.
If documents are not available, infer from objectives and rubric. JSON only.`;

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `${prompt}\n\nReturn strict JSON with this shape: {"outline":[{"title":"string","summary":"string?"}],"questions":[{"id":"string","prompt":"string","competency":"string?"}],"rubricSummary":"string","objectives":"string","rubric":"string"}.\n\nInput:\nTitle: ${exam.title}\nExisting Objectives: ${exam.objectives || '(none)'}\nExisting Rubric: ${exam.rubric || '(none)'}\nDocuments: ${docNames.join(", ")}\n\nCorpus (may be truncated):\n${corpus}`,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Model did not return valid JSON", raw: text }, { status: 502 });
  }
  const object = planSchema.parse(parsed);

  const updated = await prisma.exam.update({
    where: { id: idNum },
    data: {
      plan: object,
      objectives: object.objectives || exam.objectives,
      rubric: object.rubric || exam.rubric,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: updated.id, plan: object });
}
