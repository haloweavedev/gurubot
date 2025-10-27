import { NextResponse } from "next/server";
import type { VapiWebhookMessage, VapiToolCallsMessage } from "@/lib/voice/vapi-types";
import { handlers } from "@/lib/tool-handlers";

// Simple in-memory state for development; replace with DB if needed
const sessionState = new Map<string, Record<string, unknown>>();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: VapiWebhookMessage };
    const msg = body?.message;
    // Lightweight tracing for tool calls
    if (msg?.type) {
      const call = (msg as VapiWebhookMessage).call as { id?: string } | undefined;
      const callIdLog = typeof call?.id === 'string' ? call!.id : '';
      console.log(`[VAPI] message type=${msg.type} callId=${callIdLog}`);
    }
    if (!msg) return NextResponse.json({ status: "ignored" });

    if (msg.type === "tool-calls") {
      const toolMsg = msg as VapiToolCallsMessage;
      const callId = toolMsg.call.id;
      const toolCalls = toolMsg.toolCallList || toolMsg.toolCalls || [];

      if (!toolCalls.length) return NextResponse.json({ results: [] });

      // Load or init state
      const prior = sessionState.get(callId) || {};
      let state: Record<string, unknown> = { ...prior, callId };

      const results: Array<{ toolCallId: string; result?: string; error?: string; message?: { type: string; content: string } }> = [];

      for (const item of toolCalls) {
        const toolCallId = item.id;
        const name = item.function.name;
        const rawArgs = item.function.arguments;
        const args = typeof rawArgs === "string" ? safeParse(rawArgs) : rawArgs;
        try { console.log(`[VAPI] tool=${name} args=${JSON.stringify(args).slice(0, 400)}`); } catch {}
        const handler = handlers[name];
        if (!handler) {
          results.push({ toolCallId, error: `Unknown tool: ${name}` });
          continue;
        }

        try {
          const { toolResponse, newState } = await handler({ callId, state, args, toolCallId });
          state = newState;
          results.push({
            toolCallId: toolResponse.toolCallId,
            result: typeof toolResponse.result === "string" ? toolResponse.result : JSON.stringify(toolResponse.result),
            error: toolResponse.error,
            message: toolResponse.message,
          });
        } catch (err) {
          console.error(`[VAPI] error in ${name}:`, (err as Error)?.message);
          results.push({ toolCallId, error: `Internal error in ${name}` });
        }
      }

      sessionState.set(callId, state);
      return NextResponse.json({ results });
    }

    if (msg.type === "end-of-call-report") {
      // Cleanup ephemeral state
      const callId = msg.call.id;
      sessionState.delete(callId);
      return NextResponse.json({ status: "ok" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
