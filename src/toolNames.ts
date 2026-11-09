/**
 * The venue's MCP tools carry one of two prefixes. mcp.kellian.app (and
 * mcp.kellian.si) lists them as `kellian_*`; mcp.problee.com, the host they had
 * before the rename, still lists `problee_*`; the server answers both names everywhere. This bridge
 * takes whichever the server it talks to lists, and matches a tool by what
 * follows the prefix.
 *
 * A wallet proof is different: the server binds it to the tool's canonical
 * name, which is the `problee_*` one, whatever name the call used.
 */
export const TOOL_PREFIXES = ['kellian_', 'problee_'] as const;
export type ToolPrefix = (typeof TOOL_PREFIXES)[number];

const CANONICAL_PREFIX: ToolPrefix = 'problee_';

/** `kellian_get_market` and `problee_get_market` → `get_market`; anything else → null. */
export function toolSuffix(name: string): string | null {
  const prefix = TOOL_PREFIXES.find((candidate) => name.startsWith(candidate));
  return prefix ? name.slice(prefix.length) : null;
}

/** The prefix a tool name carries; a name with neither is taken as the current one. */
export function prefixOf(name: string): ToolPrefix {
  return TOOL_PREFIXES.find((candidate) => name.startsWith(candidate)) ?? TOOL_PREFIXES[0];
}

/** The name the server binds a wallet proof to. */
export function canonicalToolName(suffix: string): string {
  return `${CANONICAL_PREFIX}${suffix}`;
}
