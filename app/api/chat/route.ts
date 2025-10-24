import { openai } from "@ai-sdk/openai";
import { streamText, convertToCoreMessages, type Message } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json();

  const result = await streamText({
    model: openai("gpt-4o"),
    messages: convertToCoreMessages(messages),
  });

  return result.toTextStreamResponse();
}
