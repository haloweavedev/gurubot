import type { VapiMessage } from "@/lib/voice/vapi-types";

export type JsonState = Record<string, unknown>;

export type HandlerCtx<A = unknown, S extends JsonState = JsonState> = {
  callId: string;
  state: S;
  args: A;
  toolCallId: string;
};

export type HandlerResult<S extends JsonState = JsonState> = {
  toolResponse: { toolCallId: string; result?: unknown; error?: string; message?: VapiMessage };
  newState: S;
};

export type ToolHandler<A = unknown, S extends JsonState = JsonState> = (ctx: HandlerCtx<A, S>) => Promise<HandlerResult<S>>;
