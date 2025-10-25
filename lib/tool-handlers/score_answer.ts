import { prisma } from "@/lib/db/prisma";
import { resolveExamId, resolveAttempt } from "@/app/api/vapi/utils";
import { scoreUsingRubric } from "@/lib/ai/scoring";
import type { ToolHandler } from "./types";

type Args = {
  examId?: number | string;
  attemptId?: number | string;
  email?: string;
  questionId: string;
  prompt: string;
  answerText: string;
};

export const scoreAnswerHandler: ToolHandler<Args> = async ({ state, args, toolCallId }) => {
  if (!args?.questionId || !args?.prompt || !args?.answerText) {
    const err = "Missing fields (questionId, prompt, answerText)";
    return { toolResponse: { toolCallId, error: err, message: { type: "request-failed", content: err } }, newState: state };
  }

  const examId = await resolveExamId({ examId: args?.examId, email: args?.email });
  const attempt = await resolveAttempt({ attemptId: args?.attemptId, examId, email: args?.email });
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    const err = "Exam not found";
    return { toolResponse: { toolCallId, error: err, message: { type: "request-failed", content: err } }, newState: state };
  }

  const scored = await scoreUsingRubric({
    objectives: exam.objectives,
    rubric: exam.rubric,
    questionPrompt: String(args.prompt),
    answerText: String(args.answerText),
  });

  await prisma.answer.create({
    data: {
      attemptId: attempt.id,
      questionId: String(args.questionId),
      prompt: String(args.prompt),
      answerText: String(args.answerText),
      score: scored.score,
      rationale: scored.rationale,
    },
  });

  const speak = `Thanks. I scored that ${scored.score} out of 5.${scored.followup ? " " + scored.followup : ""}`.trim();
  return {
    toolResponse: {
      toolCallId,
      result: { score: scored.score, rationale: scored.rationale, followup: scored.followup, attemptId: attempt.id },
      message: { type: "request-complete", content: speak },
    },
    newState: state,
  };
};
