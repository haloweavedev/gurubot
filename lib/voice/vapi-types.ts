export type ParamType = "string" | "number" | "boolean";

export type VapiMessage = { type: string; content: string; blocking?: boolean };

export interface VapiToolFunctionParameters {
  type: "object";
  properties: Record<string, { type: ParamType; description: string }>;
  required?: string[];
}

export interface VapiRejectionCondition { type: "liquid"; liquid: string }
export interface VapiRejectionPlan { conditions: VapiRejectionCondition[] }

export interface VapiToolFunction {
  name: string;
  description: string;
  parameters: VapiToolFunctionParameters;
  strict?: boolean;
  maxTokens?: number;
  rejectionPlan?: VapiRejectionPlan;
}

export interface VapiFunctionTool {
  type: "function";
  function: VapiToolFunction;
  server?: { url: string; timeoutSeconds?: number; async?: boolean };
  messages?: VapiMessage[];
}

export type VapiWebhookToolCallItem = {
  id: string; // toolCallId
  type: "function";
  function: { name: string; arguments: Record<string, unknown> | string };
};

export type VapiWebhookMessageBase = {
  timestamp: number;
  type: string;
  call: { id: string; orgId?: string; assistantId?: string; status?: string };
};

export interface VapiToolCallsMessage extends VapiWebhookMessageBase {
  type: "tool-calls";
  toolCallList?: VapiWebhookToolCallItem[];
  toolCalls?: VapiWebhookToolCallItem[]; // legacy compat
}

export interface VapiEndOfCallReportMessage extends VapiWebhookMessageBase {
  type: "end-of-call-report";
  summary?: string;
  transcript?: string | { url?: string; text?: string };
}

export type VapiWebhookMessage = VapiToolCallsMessage | VapiEndOfCallReportMessage | VapiWebhookMessageBase;

