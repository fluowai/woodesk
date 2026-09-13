export type AiCostRow = {
  agent_id: string | null;
  conversation_id?: string | null;
  provider: string | null;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  cost_cents: number | string | null;
  created_at: string;
};

function numberValue(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function aggregateAiCosts(rows: readonly AiCostRow[]) {
  const byAgent: Record<string, { tokens: number; cost_cents: number }> = {};
  const byProvider: Record<string, { tokens: number; cost_cents: number }> = {};
  const byConversation: Record<string, { tokens: number; cost_cents: number }> = {};
  let tokens = 0;
  let costCents = 0;
  for (const row of rows) {
    const rowTokens = numberValue(row.input_tokens) + numberValue(row.output_tokens);
    const rowCost = numberValue(row.cost_cents);
    const agent = row.agent_id?.trim() || "unassigned";
    const provider = row.provider?.trim() || "unknown";
    tokens += rowTokens;
    costCents += rowCost;
    const agentBucket = byAgent[agent] ??= { tokens: 0, cost_cents: 0 };
    const providerBucket = byProvider[provider] ??= { tokens: 0, cost_cents: 0 };
    agentBucket.tokens += rowTokens;
    agentBucket.cost_cents += rowCost;
    providerBucket.tokens += rowTokens;
    providerBucket.cost_cents += rowCost;
    if (row.conversation_id) {
      const conversationBucket = byConversation[row.conversation_id] ??= { tokens: 0, cost_cents: 0 };
      conversationBucket.tokens += rowTokens;
      conversationBucket.cost_cents += rowCost;
    }
  }
  return { tokens, cost_cents: costCents, by_agent: byAgent, by_provider: byProvider, by_conversation: byConversation };
}
