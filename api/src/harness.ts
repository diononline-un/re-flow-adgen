import type { ListingResult, PlatformConfig, ProviderAdapter } from "./providers.ts";

export interface ValidationIssue {
  field: string;
  limit: number;
  actual: number;
}

export function validateListing(
  listing: ListingResult,
  config: PlatformConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const titleLimit = config.title_limit ?? 80;
  const descLimit = config.description_limit ?? 3500;

  if (titleLimit > 0 && listing.title && listing.title.length > titleLimit) {
    issues.push({ field: "title", limit: titleLimit, actual: listing.title.length });
  }
  if (listing.description && listing.description.length > descLimit) {
    issues.push({ field: "description", limit: descLimit, actual: listing.description.length });
  }
  // Depop: ein gemeinsames Titel+Beschreibungsfeld
  if (titleLimit === 0 && listing.title && listing.description &&
      listing.title.length + listing.description.length > descLimit) {
    issues.push({
      field: "title+description",
      limit: descLimit,
      actual: listing.title.length + listing.description.length,
    });
  }
  const hashLimit = config.hashtag_limit ?? 0;
  if (hashLimit > 0 && listing.hashtags && listing.hashtags.length > hashLimit) {
    issues.push({ field: "hashtags", limit: hashLimit, actual: listing.hashtags.length });
  }
  return issues;
}

function truncateWords(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > limit * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/** Hard-enforces limits after retries. Never throws. */
export function enforceLimits(listing: ListingResult, config: PlatformConfig): ListingResult {
  const out = structuredClone(listing);
  const titleLimit = config.title_limit ?? 80;
  const descLimit = config.description_limit ?? 3500;
  const hashLimit = config.hashtag_limit ?? 0;

  if (titleLimit > 0 && out.title.length > titleLimit) out.title = truncateWords(out.title, titleLimit);
  if (titleLimit === 0 && out.title.length + out.description.length > descLimit) {
    // Depop: gemeinsames Feld — Beschreibung kürzen, Titel behalten
    const budget = Math.max(0, descLimit - out.title.length - 1);
    out.description = truncateWords(out.description, budget);
  }
  if (out.description.length > descLimit) out.description = truncateWords(out.description, descLimit);
  if (hashLimit > 0 && out.hashtags) out.hashtags = out.hashtags.slice(0, hashLimit);
  return out;
}

export function retryHint(issues: ValidationIssue[]): string {
  return issues
    .map((i) => `Das Feld "${i.field}" war mit ${i.actual} Zeichen zu lang (Limit ${i.limit}). Kürze es deutlich.`)
    .join(" ");
}

/**
 * Runs the harness with retries: prompt-advised retry first (max MAX_RETRIES),
 * then hard truncation so the result always fits the platform limits.
 */
export async function runHarness(
  adapter: ProviderAdapter,
  opts: Parameters<ProviderAdapter["generateListing"]>[0],
  maxRetries: number,
): Promise<{ listing: ListingResult; truncated: boolean }> {
  let last: ListingResult = await adapter.generateListing(opts);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const issues = validateListing(last, opts.config);
    if (issues.length === 0) return { listing: last, truncated: false };
    last = await adapter.generateListing({ ...opts, retryHint: retryHint(issues) });
  }
  const issues = validateListing(last, opts.config);
  if (issues.length === 0) return { listing: last, truncated: false };
  return { listing: enforceLimits(last, opts.config), truncated: true };
}
