import type pg from "pg";

import type { JobHandlerContext } from "@/workers/agent-worker/main";
import type { JobRow } from "@/lib/agent-engine/queue/queue";

const MAX_HTML_BYTES = 256_000;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SOCIAL_RE = /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com)\/[^"'\s<]+/gi;

function safeWebsite(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("website_protocol_not_allowed");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.)/.test(host)) {
    throw new Error("website_private_address_not_allowed");
  }
  const secondOctet = host.match(/^172\.(\d+)\./)?.[1];
  if (secondOctet && Number(secondOctet) >= 16 && Number(secondOctet) <= 31) {
    throw new Error("website_private_address_not_allowed");
  }
  return url;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

export function extractWebsiteEvidence(html: string, httpStatus: number, responseMs: number) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0, 300) ?? null;
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const emails = unique(html.match(EMAIL_RE) ?? []);
  const social = unique(html.match(SOCIAL_RE) ?? []);
  return {
    title,
    hasViewport,
    emails,
    facebook: social.find((value) => value.includes("facebook.com")) ?? null,
    instagram: social.find((value) => value.includes("instagram.com")) ?? null,
    social,
    httpStatus,
    responseMs,
    htmlBytes: Buffer.byteLength(html, "utf8"),
  };
}

export function createLeadEnrichmentHandler() {
  return async (job: JobRow, pool: pg.Pool, _ctx: JobHandlerContext): Promise<void> => {
    const resultId = typeof job.payload.result_id === "string" ? job.payload.result_id : null;
    if (!resultId) throw new Error("lead_enrichment_result_id_missing");

    const result = await pool.query<{ website: string | null }>(
      `select website from lead_finder_results where id=$1 and organization_id=$2`,
      [resultId, job.organization_id],
    );
    if (result.rowCount !== 1) throw new Error("lead_enrichment_result_not_found");

    await pool.query(
      `update lead_enrichment set status='processing', error_code=null where result_id=$1 and organization_id=$2`,
      [resultId, job.organization_id],
    );
    try {
      const website = result.rows[0]?.website;
      if (!website) {
        await pool.query(
          `update lead_enrichment set status='completed', website_analysis=$3, processed_at=now(), updated_at=now() where result_id=$1 and organization_id=$2`,
          [resultId, job.organization_id, { has_website: false }],
        );
        return;
      }
      const url = safeWebsite(website);
      const requestedAt = Date.now();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "WoodeskLeadEnrichment/1.0" },
      });
      if (!response.ok) throw new Error(`website_http_${response.status}`);
      const html = (await response.text()).slice(0, MAX_HTML_BYTES);
      const responseMs = Date.now() - requestedAt;
      const evidence = extractWebsiteEvidence(html, response.status, responseMs);
      await pool.query(
        `update lead_enrichment
            set status='completed', email=$3, facebook=$4, domain=$5, website_analysis=$6, processed_at=now(), updated_at=now()
          where result_id=$1 and organization_id=$2`,
        [resultId, job.organization_id, evidence.emails[0] ?? null, evidence.facebook, url.hostname, { has_website: true, http_status: evidence.httpStatus, response_ms: evidence.responseMs, html_bytes: evidence.htmlBytes, title: evidence.title, has_viewport: evidence.hasViewport, emails_found: evidence.emails.length, social_links: evidence.social, instagram: evidence.instagram }],
      );
      await pool.query(
        `update lead_finder_results set instagram=coalesce($3, instagram), updated_at=now() where id=$1 and organization_id=$2`,
        [resultId, job.organization_id, evidence.instagram],
      );
    } catch (error) {
      await pool.query(
        `update lead_enrichment set status='failed', error_code=$3, processed_at=now(), updated_at=now() where result_id=$1 and organization_id=$2`,
        [resultId, job.organization_id, error instanceof Error ? error.message.slice(0, 120) : "lead_enrichment_failed"],
      );
      throw error;
    }
  };
}
