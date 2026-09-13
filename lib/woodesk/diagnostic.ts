import { scoreLead, type LeadOpportunitySignals } from "./lead-finder";

export interface LeadDiagnostic {
  score: number;
  scoreBand: "low" | "medium" | "high";
  problems: readonly string[];
  opportunities: readonly string[];
  priorities: readonly string[];
  pitch: string;
}

function scoreBand(score: number): LeadDiagnostic["scoreBand"] {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function generateLeadDiagnostic(
  businessName: string,
  signals: LeadOpportunitySignals,
): LeadDiagnostic {
  const name = businessName.trim();
  if (!name) throw new Error("diagnostic_business_required");

  const scored = scoreLead(signals);
  const problems: string[] = [];
  const opportunities: string[] = [];
  const priorities: string[] = [];

  if (signals.localRank !== undefined && signals.localRank > 10) {
    problems.push(`Baixa visibilidade local: posição média ${signals.localRank}`);
    opportunities.push("Melhorar presença no Google Maps e cobertura local");
    priorities.push("corrigir posicionamento local");
  }
  if (signals.rating !== undefined && signals.rating < 4) {
    problems.push(`Nota abaixo de 4,0: ${signals.rating.toFixed(1)}`);
    opportunities.push("Criar processo de solicitação e resposta a avaliações");
    priorities.push("aumentar a qualidade e o volume de avaliações");
  }
  if (signals.hasWebsite === false || signals.websiteQuality === "poor") {
    problems.push(signals.hasWebsite === false ? "Empresa sem site identificado" : "Site com sinais de baixa qualidade");
    opportunities.push("Transformar o site em uma origem de contatos qualificados");
    priorities.push("melhorar a conversão do site");
  }
  if (signals.instagramQuality === "poor" || signals.postingFrequency === "low") {
    problems.push("Presença social com baixa consistência");
    opportunities.push("Criar calendário de conteúdo alinhado ao serviço e à cidade");
    priorities.push("retomar a frequência de conteúdo");
  }

  const priorityText = priorities.length > 0 ? priorities.join(", ") : "fortalecer a geração de demanda";
  return {
    score: scored.score,
    scoreBand: scoreBand(scored.score),
    problems,
    opportunities,
    priorities,
    pitch: `Olá! Analisamos a presença digital de ${name}. Identificamos oportunidades para ${priorityText}. Posso apresentar um diagnóstico rápido?`,
  };
}
