import { prisma } from "@/lib/db/prisma";
import type { ToolHandler } from "./types";

type Args = { attemptId: number | string };

export const finalizeAttemptHandler: ToolHandler<Args> = async ({ state, args, toolCallId }) => {
  const idNum = Number(args?.attemptId);
  if (!Number.isFinite(idNum)) {
    const err = "Missing attemptId";
    return { toolResponse: { toolCallId, error: err, message: { type: "request-failed", content: err } }, newState: state };
  }
  const answers = await prisma.answer.findMany({ where: { attemptId: idNum } });
  const total = answers.length > 0 ? answers.reduce((s, a) => s + a.score, 0) / answers.length : 0;
  const updated = await prisma.attempt.update({
    where: { id: idNum },
    data: { status: "completed", completedAt: new Date(), totalScore: total },
  });
  const speak = `All set. Overall score: ${Number(total.toFixed(2))} out of 5.`;
  return {
    toolResponse: { toolCallId, result: { ok: true, attemptId: updated.id, totalScore: total }, message: { type: "request-complete", content: speak } },
    newState: { ...state, attempt: { id: updated.id, completed: true } },
  };
};
