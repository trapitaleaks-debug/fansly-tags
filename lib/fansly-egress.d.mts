// Types for the vendored lib/fansly-egress.mjs (kept byte-identical to the onboarding copy, so the
// types live here instead of in the .mjs). Only what this site uses is typed precisely.
export type EgressIdentity =
  | string
  | { handle: string }
  | { modelId: string }
  | { poolAccountId: string }
  | { email: string }
  | { label: string }

export class NoProxyError extends Error {
  constructor(who: string, why?: string)
}
export const DEAD_PROXY: Readonly<{ server: string }>
export function isFanslyUrl(u: unknown): boolean
export function clearEgressCache(): void
export function describe(identity: EgressIdentity): string
export function getProxy(identity: EgressIdentity): Promise<{
  proxyId: string; type: string; host: string; port: number; username: string; password: string
  server: string; egressIp: string
}>
export function playwrightProxy(identity: EgressIdentity): Promise<{ server: string; username: string; password: string }>
export function fanslyFetch(identity: EgressIdentity, url: string | URL, init?: RequestInit): Promise<Response>
export function egressIp(identity: EgressIdentity, opts?: { timeoutMs?: number }): Promise<string>
export function installFanslyEgressGuard(): void
export function mintStamp(identity: EgressIdentity): Promise<{ proxyId: string; egressIp: string; stampedAt: string }>
export function assertDocProxy(
  identity: EgressIdentity,
  doc: unknown,
  opts?: { adopt?: boolean },
): Promise<{ adopted: boolean; stamp: { proxyId: string; egressIp: string; stampedAt: string } }>
