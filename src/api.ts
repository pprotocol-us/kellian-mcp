// Tiny client over mcp-discovery — single source of truth for install snippets.

import { setting } from "./env.js";

export interface DiscoveryResponse {
  endpoint?: string;
  transport?: string;
  endpoints?: {
    remote?: {
      url?: string;
      transport?: string;
    };
  };
  installSnippets: {
    claudeCode?: string;
    cursorDeeplink?: string;
    codex?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

/** The public domain; this published package cannot import the monorepo identity module. */
export const PUBLIC_DOMAIN = "kellian.app";
export const API_ORIGIN = `https://api.${PUBLIC_DOMAIN}`;
const DEFAULT_DISCOVERY = `${API_ORIGIN}/api/agent/v1/mcp-discovery`;
const DEFAULT_ENDPOINT = `https://mcp.${PUBLIC_DOMAIN}`;

export async function fetchDiscovery(
  url = setting("MCP_DISCOVERY_URL") ?? DEFAULT_DISCOVERY,
): Promise<DiscoveryResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as DiscoveryResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isReviewedEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === PUBLIC_DOMAIN || url.hostname.endsWith(`.${PUBLIC_DOMAIN}`))
    );
  } catch {
    return false;
  }
}

export function endpointFromDiscovery(d: DiscoveryResponse | null): string {
  // An explicit operator override is useful for local/staging verification.
  // Discovery itself is not allowed to redirect a bearer credential to an
  // unrelated origin.
  const override = setting("MCP_ENDPOINT");
  if (override) return override;
  const discovered = d?.endpoints?.remote?.url ?? d?.endpoint;
  return discovered && isReviewedEndpoint(discovered)
    ? discovered
    : DEFAULT_ENDPOINT;
}

/**
 * A credential stored earlier names the MCP host on a domain the product has
 * since moved from (mcp.problee.com, then mcp.kellian.si). Both still answer,
 * but the host is now mcp.kellian.app (same server, same keys), so the bridge
 * talks to that one; an explicit KELLIAN_MCP_ENDPOINT still wins.
 */
export function storedEndpoint(value: string): string {
  return value.replace(/^https:\/\/mcp\.(?:problee\.com|kellian\.si)(?=\/|$)/u, DEFAULT_ENDPOINT);
}

const DEFAULT_API = API_ORIGIN;

/** The agent API origin: registration, nonces. The override is for local verification only. */
export function apiOrigin(): string {
  return setting("API_URL") ?? DEFAULT_API;
}

/** A single-use server nonce, for a registration signature or a per-tool wallet proof. */
export async function fetchNonce(origin = apiOrigin()): Promise<string> {
  const res = await fetch(`${origin}/api/auth/nonce`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: "{}",
  });
  const body = (await res.json().catch(() => null)) as { nonce?: unknown } | null;
  if (!res.ok || typeof body?.nonce !== "string" || !/^[0-9a-f]{16,128}$/i.test(body.nonce)) {
    throw new Error(`Kellian did not issue a nonce (${res.status})`);
  }
  return body.nonce;
}
