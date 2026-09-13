export type VoiceCallDirection = "inbound" | "outbound";
export type VoiceCallStatus = "queued" | "connecting" | "in_progress" | "completed" | "failed" | "cancelled";

export interface VoiceCallRequest {
  organizationId: string;
  contactId?: string;
  direction: VoiceCallDirection;
  metadata?: Record<string, unknown>;
}

export interface VoiceCallReceipt {
  providerId: string;
  externalId: string;
  status: VoiceCallStatus;
}

export interface VoiceProvider {
  readonly id: string;
  readonly enabled: boolean;
  startCall(request: VoiceCallRequest): Promise<VoiceCallReceipt>;
  endCall(externalId: string): Promise<void>;
  healthCheck(): Promise<{ status: "healthy" | "degraded" | "unavailable"; latencyMs?: number }>;
}

export interface VoiceOutboundGuardInput {
  consented: boolean;
  optedOut: boolean;
  withinAllowedHours: boolean;
  callsToday: number;
  dailyLimit: number;
}

export function canStartVoiceOutbound(input: VoiceOutboundGuardInput): { allowed: true } | { allowed: false; reason: "no_consent" | "opted_out" | "outside_hours" | "daily_limit" } {
  if (!input.consented) return { allowed: false, reason: "no_consent" };
  if (input.optedOut) return { allowed: false, reason: "opted_out" };
  if (!input.withinAllowedHours) return { allowed: false, reason: "outside_hours" };
  if (input.callsToday >= input.dailyLimit) return { allowed: false, reason: "daily_limit" };
  return { allowed: true };
}

export function assertVoiceCallTransition(from: VoiceCallStatus, to: VoiceCallStatus): void {
  const allowed: Record<VoiceCallStatus, readonly VoiceCallStatus[]> = {
    queued: ["connecting", "cancelled", "failed"],
    connecting: ["in_progress", "cancelled", "failed"],
    in_progress: ["completed", "cancelled", "failed"],
    completed: [], failed: [], cancelled: [],
  };
  if (!allowed[from].includes(to)) throw new Error(`voice_transition_invalid:${from}->${to}`);
}
