import type { ProviderHealth, WoodeskProvider } from "../capabilities";
import { normalizeLeadResult, type LeadFinderInput, type NormalizedLeadResult } from "../lead-finder";

export interface BrowserImportProvider extends WoodeskProvider {
  search(input: { keyword: string; city?: string; state?: string; limit: number; latitude?: number; longitude?: number }): Promise<NormalizedLeadResult[]>;
}

/**
 * O Lead Finder recebe o CSV/JSON produzido pelo extractor de navegador.
 * Não faz scraping server-side nem chama a API do Google.
 */
export function createBrowserImportProvider(): BrowserImportProvider {
  return {
    id: "browser_import",
    capabilities: ["lead_search"],
    priority: 100,
    enabled: false,
    async healthCheck(): Promise<ProviderHealth> {
      return { providerId: "browser_import", status: "disabled", checkedAt: new Date(), message: "Aguardando importação manual do extractor de navegador." };
    },
    async search(): Promise<NormalizedLeadResult[]> {
      throw new Error("browser_import_required");
    },
  };
}

export function normalizeBrowserLead(input: LeadFinderInput): NormalizedLeadResult {
  return normalizeLeadResult(input);
}
