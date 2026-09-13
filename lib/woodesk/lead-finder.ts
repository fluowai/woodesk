export interface LeadFinderInput {
  name: string;
  category?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  address?: string;
  city?: string;
  state?: string;
  rating?: number;
  reviewCount?: number;
  sourceUrl?: string;
  externalId?: string;
  latitude?: number;
  longitude?: number;
}

export interface NormalizedLeadResult extends LeadFinderInput {
  name: string;
  normalizedPhone: string | null;
  hasWhatsapp: boolean | null;
}

export interface LeadFinderFilters {
  minimumRating?: number;
  maximumRating?: number;
  minimumReviewCount?: number;
  maximumReviewCount?: number;
  hasWebsite?: boolean;
  hasWhatsapp?: boolean;
  hasInstagram?: boolean;
}

export function filterLeadResults(results: readonly NormalizedLeadResult[], filters: LeadFinderFilters): NormalizedLeadResult[] {
  return results.filter((result) => {
    if (filters.minimumRating !== undefined && (result.rating === undefined || result.rating < filters.minimumRating)) return false;
    if (filters.maximumRating !== undefined && (result.rating === undefined || result.rating > filters.maximumRating)) return false;
    if (filters.minimumReviewCount !== undefined && (result.reviewCount === undefined || result.reviewCount < filters.minimumReviewCount)) return false;
    if (filters.maximumReviewCount !== undefined && (result.reviewCount === undefined || result.reviewCount > filters.maximumReviewCount)) return false;
    if (filters.hasWebsite !== undefined && Boolean(result.website) !== filters.hasWebsite) return false;
    if (filters.hasWhatsapp !== undefined && Boolean(result.hasWhatsapp) !== filters.hasWhatsapp) return false;
    if (filters.hasInstagram !== undefined && Boolean(result.instagram) !== filters.hasInstagram) return false;
    return true;
  });
}

export function normalizePhone(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function normalizeLeadResult(input: LeadFinderInput): NormalizedLeadResult {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("lead_finder_name_required");
  return { ...input, name, normalizedPhone: normalizePhone(input.phone), hasWhatsapp: null };
}

export interface LeadOpportunitySignals {
  hasWebsite: boolean;
  websiteQuality?: "good" | "poor";
  rating?: number;
  reviewCount?: number;
  localRank?: number;
  instagramQuality?: "good" | "poor";
  postingFrequency?: "regular" | "low";
}

export interface LeadScore {
  score: number;
  band: "low" | "medium" | "high";
  reasons: string[];
}

export function scoreLead(signals: LeadOpportunitySignals): LeadScore {
  let score = 0;
  const reasons: string[] = [];
  if (!signals.hasWebsite) { score += 20; reasons.push("sem site"); }
  if (signals.websiteQuality === "poor") { score += 15; reasons.push("site com baixa qualidade"); }
  if (signals.rating !== undefined && signals.rating < 4) { score += 15; reasons.push("nota abaixo de 4"); }
  if (signals.reviewCount !== undefined && signals.reviewCount < 20) { score += 10; reasons.push("poucas avaliações"); }
  if (signals.localRank !== undefined && signals.localRank > 10) { score += 20; reasons.push("ranking local baixo"); }
  if (signals.instagramQuality === "poor") { score += 10; reasons.push("Instagram fraco"); }
  if (signals.postingFrequency === "low") { score += 10; reasons.push("baixa frequência de posts"); }
  const bounded = Math.max(0, Math.min(100, score));
  return { score: bounded, band: bounded >= 70 ? "high" : bounded >= 40 ? "medium" : "low", reasons };
}
