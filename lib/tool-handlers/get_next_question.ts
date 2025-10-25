import { prisma } from "@/lib/db/prisma";
import { resolveExamId, resolveAttempt } from "@/app/api/vapi/utils";
import type { ToolHandler } from "./types";

type Plan = { questions?: { id: string; prompt: string }[] } | null;
type Args = { examId?: number | string; attemptId?: number | string; email?: string };

export const getNextQuestionHandler: ToolHandler<Args> = async ({ state, args, toolCallId }) => {
  const examId = await resolveExamId({ examId: args?.examId, email: args?.email });
  const attempt = await resolveAttempt({ attemptId: args?.attemptId, examId, email: args?.email });

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  const plan = (exam?.plan ?? null) as unknown as Plan;
  const questions = plan?.questions ?? [];

  const answered = await prisma.answer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true },
  });
  const answeredIds = new Set(answered.map((a) => a.questionId));
  const next = questions.find((q) => !answeredIds.has(q.id));

  const message = next?.prompt ?? "No more questions.";
  return {
    toolResponse: {
      toolCallId,
      result: { attemptId: attempt.id, question: next ?? null },
      message: { type: "request-complete", content: message },
    },
    newState: { ...state, attempt: { id: attempt.id }, currentQuestionId: next?.id },
  };
};
