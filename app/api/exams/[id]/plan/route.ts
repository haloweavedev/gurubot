import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { generateText } from "ai";
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
});

export async function POST(
  _req: Request,
  context: unknown
) {
  const params = (context as { params?: Record<string, string> }).params ?? {};
  const idNum = Number(params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Invalid exam id" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: idNum },
    include: { documents: true },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const docNames = exam.documents.map((d) => d.name);

  const prompt = `You are an expert educator designing an oral exam.
Given the exam title, learning objectives, rubric text, and a list of document names, produce:
- A short outline of 3-6 sections
- 5-10 competency questions
- A brief rubric summary for evaluators.
If documents are not available, infer from objectives and rubric. JSON only.`;

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `${prompt}\n\nReturn strict JSON with this shape: {"outline":[{"title":"string","summary":"string?"}],"questions":[{"id":"string","prompt":"string","competency":"string?"}],"rubricSummary":"string"}.\n\nInput:\nTitle: ${exam.title}\nObjectives: ${exam.objectives}\nRubric: ${exam.rubric}\nDocuments: ${docNames.join(", ")}`,
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
    data: { plan: object },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: updated.id, plan: object });
}
