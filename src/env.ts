/**
 * A setting read from the environment: `KELLIAN_<name>`, else the
 * `PROBLEE_<name>` it was called before the rename, so an existing setup keeps
 * working.
 */
export function setting(name: string): string | undefined {
  return process.env[`KELLIAN_${name}`] ?? process.env[`PROBLEE_${name}`];
}
