import { spawn } from 'node:child_process';
import { argv, exit, stderr, stdout } from 'node:process';

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { API_ORIGIN, apiOrigin, endpointFromDiscovery, fetchDiscovery, fetchNonce, PUBLIC_DOMAIN } from './api.js';
import { ALL_CLIENTS, installFor, statusAll } from './clients.js';
import type { ClientId, Result } from './clients.js';
import { credentialPath, loadCredential, readableCredentialPath, storeCredential } from './credentials.js';
import { setting } from './env.js';
import { serveSecureProxy } from './proxy.js';

const CLI_VERSION = '1.0.2';
const HELP = `\
kellian-mcp ${CLI_VERSION} — securely install the Kellian MCP server

Usage:
  npx kellian-mcp register --owner <email> [--name <name>] [--client <id>]
  KELLIAN_API_KEY=<key> npx kellian-mcp install [--client <id>]
  npx kellian-mcp status
  npx kellian-mcp --help

Commands:
  register    With --owner: create an agent with its own wallet, register it
              with its owner's email and install it. It reads and quotes at once
              and trades as itself, labelled AI, once the owner claims it from
              the emailed link. The wallet key stays in the private credential
              file; the local bridge signs this agent's orders with it.
              Without --owner: print the two ways to get a key.
  install     Install from an existing private credential or KELLIAN_API_KEY.
              API keys are rejected on command-line arguments.
  status      Show credential and client registration status without exposing secrets.
  serve       Secure local stdio-to-HTTPS proxy used by installed MCP clients;
              without a key it serves the public reads.

Client:
  --client    claude-desktop, claude-code, cursor, codex, or all (default)

Examples:
  npx kellian-mcp register --owner you@example.com
  KELLIAN_API_KEY=<key> npx kellian-mcp install --client cursor
  npx kellian-mcp status

Every KELLIAN_* setting is also read under its earlier PROBLEE_* name, and a
credential stored by problee-mcp is used until this one stores its own.

Docs: https://${PUBLIC_DOMAIN}/for-agents
`;

function parseArgs(args: readonly string[]): {
  command: string;
  flags: Record<string, string>;
} {
  const positional = args[0]?.startsWith('--') ? ['help', ...args] : [...args];
  const [command = 'help', ...rest] = positional;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const argument = rest[i];
    if (!argument?.startsWith('--')) continue;
    const [key, inlineValue] = argument.slice(2).split('=', 2);
    if (!key) continue;
    const next = rest[i + 1];
    const value = inlineValue ?? (next && !next.startsWith('--') ? next : 'true');
    flags[key] = value;
    if (inlineValue === undefined && next && !next.startsWith('--')) i++;
  }
  return { command, flags };
}

function fail(message: string): never {
  stdout.write(`✗ ${message}\n`);
  exit(2);
}

function resolveClients(value: string | undefined): ClientId[] {
  if (!value || value === 'all') return [...ALL_CLIENTS];
  const found = ALL_CLIENTS.find((client) => client === value);
  if (!found) {
    fail(`unknown client: ${value}. valid: ${ALL_CLIENTS.join(', ')}, all`);
  }
  return [found];
}

function assertNoArgvSecret(flags: Record<string, string>): void {
  if (flags['api-key']) {
    fail(
      'refusing --api-key because process arguments are observable; use KELLIAN_API_KEY'
    );
  }
}

function fmtAction(result: Result): string {
  const symbol = {
    added: '✓',
    updated: '↻',
    skipped: '·',
    manual: '!',
    missing: '—',
  }[result.action];
  const detail = result.detail ? `  ${result.detail}` : '';
  const path = result.configPath ? `  (${result.configPath})` : '';
  return `  ${symbol} ${result.client.padEnd(16)} ${result.action}${path}${detail}`;
}

function installClients(clients: readonly ClientId[]): Result[] {
  const results = clients.map((client) => installFor(client));
  for (const result of results) stdout.write(`${fmtAction(result)}\n`);

  const successful = results.filter((result) =>
    ['added', 'updated', 'skipped'].includes(result.action)
  );
  if (successful.length) {
    stdout.write(
      `\nNext: restart the affected app(s) and ask "What MCP tools do you have from Kellian?"\n`
    );
  } else {
    throw new Error(
      'No MCP client was installed. Install a supported client or use --client with an available one, then rerun install.'
    );
  }
  return results;
}

async function currentEndpoint(): Promise<string> {
  return endpointFromDiscovery(await fetchDiscovery());
}

async function cmdInstall(flags: Record<string, string>): Promise<void> {
  assertNoArgvSecret(flags);
  const clients = resolveClients(flags.client);
  const endpoint = await currentEndpoint();
  const envApiKey = setting('API_KEY');
  const existing = loadCredential();
  const apiKey = envApiKey ?? existing?.apiKey;
  if (!apiKey) {
    fail('no private credential found; run `npx kellian-mcp register`');
  }

  // A registered agent's id and wallet belong to its key: kept with it, dropped for another key.
  const sameKey = existing?.apiKey === apiKey;
  storeCredential({
    apiKey,
    endpoint,
    apiKeyId: sameKey ? existing?.apiKeyId : undefined,
    keyPrefix: sameKey ? existing?.keyPrefix ?? apiKey.slice(0, 8) : apiKey.slice(0, 8),
    agentId: sameKey ? existing?.agentId : undefined,
    wallet: sameKey ? existing?.wallet : undefined,
  });
  stdout.write(`Credential: ${credentialPath()} (private; key not printed)\n`);
  stdout.write(`Endpoint:   ${endpoint}\n`);
  stdout.write(`Clients:    ${clients.join(', ')}\n\n`);
  installClients(clients);
}

function openVerificationUrl(url: string): void {
  if (setting('NO_BROWSER') === '1') return;
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(opener, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // The complete URL is printed so browser launch is only a convenience.
  }
}

const REGISTER_URL = `https://${PUBLIC_DOMAIN}/me/settings/agents`;

/**
 * Without --owner: the two ways to a key (the account's own, and the claimed
 * agent). It exits non-zero because it produced no credential, so a
 * `register && install` chain stops here rather than installing nothing.
 */
function printKeyPaths(clients: readonly ClientId[]): never {
  stdout.write(
    [
      'There are two ways to get an API key:',
      '',
      `  1. Your account   ${REGISTER_URL}`,
      '                    Sign in, then Create agent key (shown once). It reads markets, prices',
      "                    and your positions as you; every order also needs your account's",
      '                    signature, which this bridge does not make.',
      '  2. Claimed agent  npx kellian-mcp register --owner <email>',
      "                    Creates the agent's own wallet here and registers it with ownerEmail",
      `                    (POST ${API_ORIGIN}/api/agent/v1/register). It reads and quotes`,
      '                    at once, and trades as itself once its owner claims it from the emailed link.',
      '                    Closed by default. Read registration.claim.status on',
      `                    GET ${API_ORIGIN}/api/agent/v1/mcp-discovery before calling it.`,
      '',
      'With a key from your account, install without putting it in process arguments:',
      `  KELLIAN_API_KEY=<key> npx kellian-mcp install --client ${clients.join(',')}`,
      '',
    ].join('\n')
  );
  openVerificationUrl(REGISTER_URL);
  fail('no credential was created; run install with KELLIAN_API_KEY once you hold a key');
}

interface RegisterReply {
  id?: unknown;
  rawApiKey?: unknown;
  apiKeyId?: unknown;
  keyPrefix?: unknown;
  claim?: { expiresAt?: unknown };
  detail?: unknown;
  title?: unknown;
  reason?: unknown;
}

/**
 * The claimed-agent path in one command (row 38). The wallet is made here and
 * never leaves this machine: its key goes into the private credential file
 * beside the API key, and the local bridge signs this agent's wallet proofs and
 * orders with it (walletSigner.ts). The owner email is the person accountable
 * for the agent; the server emails them the claim link.
 */
async function cmdRegister(flags: Record<string, string>): Promise<void> {
  assertNoArgvSecret(flags);
  const clients = resolveClients(flags.client);
  const owner = flags.owner?.trim();
  if (!owner || owner === 'true') printKeyPaths(clients);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)) fail('--owner must be the email address of the person accountable for the agent');

  const existing = loadCredential();
  if (existing) {
    fail(
      `a credential already exists at ${readableCredentialPath()} (${existing.keyPrefix ?? 'stored'}…); ` +
        'to register another agent, set KELLIAN_CREDENTIALS_FILE to a new path'
    );
  }
  const discovery = await fetchDiscovery();
  const claim = (discovery?.registration as { claim?: { status?: unknown } } | undefined)?.claim;
  if (claim?.status !== 'open') {
    fail('claimed-agent registration is not open right now (registration.claim.status); nothing was created');
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const wallet = account.address.toLowerCase();
  const name = flags.name && flags.name !== 'true' ? flags.name : `Agent ${wallet.slice(2, 8)}`;
  const origin = apiOrigin();
  const signedMessage = `problee-register:${wallet}:${await fetchNonce(origin)}`;
  const res = await fetch(`${origin}/api/agent/v1/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      name,
      walletAddress: account.address,
      walletSignature: await account.signMessage({ message: signedMessage }),
      signedMessage,
      ownerEmail: owner,
    }),
  });
  const reply = (await res.json().catch(() => ({}))) as RegisterReply;
  if (res.status !== 201 || typeof reply.rawApiKey !== 'string' || typeof reply.id !== 'string') {
    const why = [reply.reason, reply.detail ?? reply.title].filter((part) => typeof part === 'string').join(': ');
    fail(`registration was refused (${res.status})${why ? `: ${why}` : ''}; nothing was stored`);
  }

  storeCredential({
    apiKey: reply.rawApiKey,
    endpoint: endpointFromDiscovery(discovery),
    apiKeyId: typeof reply.apiKeyId === 'string' ? reply.apiKeyId : undefined,
    keyPrefix: typeof reply.keyPrefix === 'string' ? reply.keyPrefix : reply.rawApiKey.slice(0, 8),
    agentId: reply.id,
    wallet: { address: account.address, privateKey },
  });
  const until = typeof reply.claim?.expiresAt === 'string' ? ` (the link lasts until ${reply.claim.expiresAt})` : '';
  stdout.write(
    [
      `Registered "${name}" (agent ${reply.id})`,
      `Wallet:     ${account.address}`,
      `Credential: ${credentialPath()} (private; the wallet key and API key are not printed)`,
      `Owner:      ${owner} was emailed a claim link${until}.`,
      '            The agent reads and quotes now, and trades as itself once the owner claims it.',
      '',
      '',
    ].join('\n')
  );
  try {
    installClients(clients);
  } catch (error) {
    stdout.write(
      `${error instanceof Error ? error.message : String(error)}\nThe agent is registered; install it later with: npx kellian-mcp install\n`
    );
  }
}

function cmdStatus(): void {
  const credential = loadCredential();
  stdout.write(`Kellian MCP — credential and registered clients\n\n`);
  stdout.write(
    credential
      ? `  ✓ credential       ${credential.keyPrefix ?? 'stored'}… (${readableCredentialPath()}, private)\n`
      : `  · credential       not found (${credentialPath()})\n`
  );
  if (credential?.wallet) {
    stdout.write(`  ✓ agent wallet     ${credential.wallet.address} (signs this agent's orders locally)\n`);
  }
  for (const entry of statusAll()) {
    const symbol = entry.registered ? '✓' : '·';
    const where = entry.endpoint ? `→ ${entry.endpoint}` : '';
    stdout.write(
      `  ${symbol} ${entry.client.padEnd(16)} ${entry.registered ? 'registered' : 'not registered'} ${where}\n      ${entry.configPath}\n`
    );
  }
  stdout.write(`\nTo create an agent and install it: \`npx kellian-mcp register --owner <email>\`\n`);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(argv.slice(2));
  if (command === 'help' || flags.help === 'true' || flags.h === 'true') {
    stdout.write(HELP);
    return;
  }
  if (command === 'install') return cmdInstall(flags);
  if (command === 'status') return cmdStatus();
  if (command === 'register') return cmdRegister(flags);
  if (command === 'serve') return serveSecureProxy(CLI_VERSION);
  fail(`unknown command: ${command}\n\n${HELP}`);
}

main().catch((error: unknown) => {
  const output = argv[2] === 'serve' ? stderr : stdout;
  output.write(`✗ error: ${error instanceof Error ? error.message : String(error)}\n`);
  exit(1);
});
