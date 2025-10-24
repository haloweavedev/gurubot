import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveExamId, resolveAttempt } from "../utils";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      examId?: number | string;
      attemptId?: number | string;
      email?: string;
      questionId: string;
      prompt: string;
      answerText: string;
    };
    if (!body?.questionId || !body?.prompt || !body?.answerText) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const examId = await resolveExamId({ examId: body.examId, email: body.email });
    const attempt = await resolveAttempt({ attemptId: body.attemptId, examId, email: body.email });
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const prompt = `You are an evaluator. Score the answer from 0 to 5 (integer) using the objectives and rubric. Return strict JSON {"score":number,"rationale":string,"followup":string}.
Objectives: ${exam.objectives}\nRubric: ${exam.rubric}\nQuestion: ${body.prompt}\nAnswer: ${body.answerText}`;
    const { text } = await generateText({ model: openai("gpt-4o-mini"), prompt });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Model did not return valid JSON", raw: text }, { status: 502 });
    }
    const obj = parsed as { score?: number; rationale?: string; followup?: string };
    const score = Math.max(0, Math.min(5, Math.round(Number(obj.score ?? 0))));
    const rationale = obj.rationale ?? "";
    const followup = obj.followup ?? undefined;

    await prisma.answer.create({
      data: {
        attemptId: attempt.id,
        questionId: body.questionId,
        prompt: body.prompt,
        answerText: body.answerText,
        score,
        rationale,
      },
    });

    return NextResponse.json({ score, rationale, followup, attemptId: attempt.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

