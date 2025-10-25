import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function scoreUsingRubric(input: {
  objectives: string;
  rubric: string;
  questionPrompt: string;
  answerText: string;
}): Promise<{ score: number; rationale: string; followup?: string }> {
  const prompt = `You are an evaluator. Score the answer from 0 to 5 (integer) using the objectives and rubric. Return strict JSON {"score":number,"rationale":string,"followup":string}.
Objectives: ${input.objectives}\nRubric: ${input.rubric}\nQuestion: ${input.questionPrompt}\nAnswer: ${input.answerText}`;

  const { text } = await generateText({ model: openai("gpt-4o-mini"), prompt });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Model did not return valid JSON");
  }
  const obj = parsed as { score?: number; rationale?: string; followup?: string };
  const score = Math.max(0, Math.min(5, Math.round(Number(obj.score ?? 0))));
  const rationale = obj.rationale ?? "";
  const followup = obj.followup ?? undefined;
  return { score, rationale, followup };
}

