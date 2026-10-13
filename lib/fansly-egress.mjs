// One proxy per model for every direct contact with Fansly (Vito, 13 Oct 2026).
// apiv3.fansly.com, fansly.com logins, cdn*.fansly.com: all of it leaves through the proxy that is
// assigned to that Fansly account in the CRM (fansly_proxies + fansly_proxy_assignments).
// FAIL CLOSED: no proxy for the account → NoProxyError. There is no direct fallback anywhere.
// Never log a proxy password; log only the proxy id and its egress IP.
//
// Canonical copy: onboarding/scripts/lib/fansly-egress.mjs. Other projects vendor this file
// unchanged (check with scripts/proxy-sync-check.mjs).
//
// identity forms: "@handle" | "handle" | { handle } | { modelId } | { poolAccountId } | { email } | { label }
import { readFileSync, existsSync } from "node:fs";
import { fetch as undiciFetch, ProxyAgent, Socks5ProxyAgent } from "undici";

export class NoProxyError extends Error {
  constructor(who, why = "no proxy assigned") {
    super(`[egress] refused ${who}: ${why} (fail closed, no direct Fansly call)`);
    this.name = "NoProxyError";
  }
}

const MAC_ENV = "/Users/leonardoguizzo/Documents/01 — Agency/Fansly/onboarding/.env";
function env(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync(MAC_ENV)) return undefined;
  for (const line of readFileSync(MAC_ENV, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && line.slice(0, i).trim() === name) return line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

async function db(path) {
  const url = String(env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL") || "").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new NoProxyError("all models", "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  const res = await undiciFetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new NoProxyError("all models", `proxy table read ${res.status}`);
  return res.json();
}

// Launch-level proxy for a shared browser: nothing listens there, so any context opened without
// her own proxy reaches nothing (fail closed). Per-context proxies override it.
export const DEAD_PROXY = Object.freeze({ server: "http://127.0.0.1:9" });

export const isFanslyUrl = (u) => {
  try { const h = new URL(String(u)).hostname.toLowerCase(); return h === "fansly.com" || h.endsWith(".fansly.com"); }
  catch { return false; }
};

// Cache the whole map for 5 min: 60 rows, and it keeps Railway jobs from re-reading per call.
let cache = null, cacheAt = 0;
async function loadMap() {
  if (cache && Date.now() - cacheAt < 5 * 60_000) return cache;
  const [proxies, assigns, models, pool] = await Promise.all([
    db("fansly_proxies?select=id,type,host,port,username,password,status,egress_ip"),
    db("fansly_proxy_assignments?select=proxy_id,model_id,pool_account_id,label&released_at=is.null"),
    db("models?select=id,num,username"),
    db("fansly_account_pool?select=id,model_id,email"),
  ]);
  const byId = new Map(proxies.map((p) => [p.id, p]));
  cache = {
    byModel: new Map(), byPool: new Map(), byLabel: new Map(),
    modelByHandle: new Map(models.filter((m) => m.username).map((m) => [m.username.toLowerCase(), m])),
    modelById: new Map(models.map((m) => [m.id, m])),
    poolById: new Map(pool.map((r) => [r.id, r])),
    poolByEmail: new Map(pool.filter((r) => r.email).map((r) => [r.email.toLowerCase(), r])),
    poolByModel: new Map(pool.filter((r) => r.model_id).map((r) => [r.model_id, r])),
  };
  for (const a of assigns) {
    const p = byId.get(a.proxy_id);
    if (!p || p.status === "dead" || p.status === "retired") continue;
    if (a.model_id) cache.byModel.set(a.model_id, p);
    if (a.pool_account_id) cache.byPool.set(a.pool_account_id, p);
    if (a.label) cache.byLabel.set(a.label, p);
  }
  cacheAt = Date.now();
  return cache;
}
export function clearEgressCache() { cache = null; }

function norm(identity) {
  if (typeof identity === "string") return { handle: identity };
  return identity || {};
}
export function describe(identity) {
  const i = norm(identity);
  if (i.handle) return "@" + String(i.handle).replace(/^@/, "");
  if (i.modelId) return `model ${i.modelId}`;
  if (i.poolAccountId) return `pool ${String(i.poolAccountId).slice(0, 8)}`;
  if (i.email) return "pool email";
  if (i.label) return `label ${i.label}`;
  return "unknown identity";
}

// → { proxyId, type, host, port, username, password, server, egressIp }
export async function getProxy(identity) {
  const i = norm(identity), m = await loadMap(), who = describe(identity);
  let p;
  if (i.label) p = m.byLabel.get(i.label);
  else {
    let modelId = i.modelId, poolId = i.poolAccountId;
    if (i.handle) modelId = m.modelByHandle.get(String(i.handle).replace(/^@/, "").toLowerCase())?.id;
    if (i.email) poolId = m.poolByEmail.get(String(i.email).toLowerCase())?.id;
    if (poolId && !modelId) modelId = m.poolById.get(poolId)?.model_id || undefined;
    if (modelId && !poolId) poolId = m.poolByModel.get(modelId)?.id;
    p = (modelId && m.byModel.get(modelId)) || (poolId && m.byPool.get(poolId));
    if (!modelId && !poolId) throw new NoProxyError(who, "not found in CRM");
  }
  if (!p) throw new NoProxyError(who);
  const scheme = p.type === "socks5" ? "socks5" : "http";
  return {
    proxyId: p.id, type: p.type, host: p.host, port: p.port, username: p.username, password: p.password,
    server: `${scheme}://${p.host}:${p.port}`, egressIp: p.egress_ip || p.host,
  };
}

// Playwright: chromium.launch({ proxy }) / browser.newContext({ proxy }). Chromium cannot do
// SOCKS5 with a password, so browser use requires an http proxy.
export async function playwrightProxy(identity) {
  const p = await getProxy(identity);
  if (p.type === "socks5") throw new NoProxyError(describe(identity), "socks5 proxy cannot be used by Chromium (needs http)");
  return { server: p.server, username: p.username, password: p.password };
}

const agents = new Map();
export function dispatcherFor(p) {
  if (!agents.has(p.proxyId)) {
    agents.set(p.proxyId, p.type === "socks5"
      ? new Socks5ProxyAgent(`socks5://${encodeURIComponent(p.username)}:${encodeURIComponent(p.password)}@${p.host}:${p.port}`)
      : new ProxyAgent({ uri: p.server, token: "Basic " + Buffer.from(`${p.username}:${p.password}`).toString("base64") }));
  }
  return agents.get(p.proxyId);
}

// Node-side Fansly call through her proxy. Same signature as fetch plus the identity first.
export async function fanslyFetch(identity, url, init = {}) {
  const p = await getProxy(identity);
  return undiciFetch(url, { ...init, dispatcher: dispatcherFor(p) });
}

// The IP Fansly sees for this identity.
export async function egressIp(identity, { timeoutMs = 15000 } = {}) {
  const p = await getProxy(identity);
  const res = await undiciFetch("https://api.ipify.org?format=json", { dispatcher: dispatcherFor(p), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`ipify ${res.status}`);
  return (await res.json()).ip;
}

// Browser helpers. They check, inside the browser, that the page really leaves from her proxy IP
// before any Fansly page is opened; a mismatch closes the browser and throws.
async function assertBrowserEgress(ctxOrBrowser, p, who) {
  const page = await ctxOrBrowser.newPage();
  try {
    await page.goto("https://api.ipify.org?format=json", { timeout: 30000 });
    const ip = JSON.parse(await page.locator("body").innerText()).ip;
    if (ip !== p.egressIp) throw new NoProxyError(who, `browser egress ${ip} is not her proxy IP`);
    console.log(`[egress] ${who} browser via ${p.proxyId.slice(0, 8)} ${ip}`);
  } finally { await page.close().catch(() => {}); }
}

export async function launchFansly(chromium, identity, opts = {}) {
  const { verifyEgress = true, ...launchOpts } = opts;
  const p = await getProxy(identity), who = describe(identity);
  const browser = await chromium.launch({ ...launchOpts, proxy: await playwrightProxy(identity) });
  if (verifyEgress) {
    const ctx = await browser.newContext();
    try { await assertBrowserEgress(ctx, p, who); }
    catch (e) { await browser.close().catch(() => {}); throw e; }
    finally { await ctx.close().catch(() => {}); }
  }
  return browser;
}

export async function launchPersistentFansly(chromium, userDataDir, identity, opts = {}) {
  const { verifyEgress = true, ...ctxOpts } = opts;
  const p = await getProxy(identity), who = describe(identity);
  const ctx = await chromium.launchPersistentContext(userDataDir, { ...ctxOpts, proxy: await playwrightProxy(identity) });
  if (verifyEgress) {
    try { await assertBrowserEgress(ctx, p, who); }
    catch (e) { await ctx.close().catch(() => {}); throw e; }
  }
  return ctx;
}

// For code that opens several models in one browser: each context gets her own proxy.
// (Chromium needs a launch-level proxy for per-context proxies to work; pass
// { proxy: { server: "http://per-context" } } at launch, as Playwright documents.)
export async function newFanslyContext(browser, identity, opts = {}) {
  const { verifyEgress = true, ...ctxOpts } = opts;
  const p = await getProxy(identity);
  const ctx = await browser.newContext({ ...ctxOpts, proxy: await playwrightProxy(identity) });
  if (verifyEgress) {
    try { await assertBrowserEgress(ctx, p, describe(identity)); }
    catch (e) { await ctx.close().catch(() => {}); throw e; }
  }
  return ctx;
}

// Safety net: after this, any plain fetch() to *.fansly.com throws instead of leaving directly.
// fanslyFetch() is not affected (it uses undici's own fetch with her dispatcher).
export function installFanslyEgressGuard() {
  if (globalThis.__fanslyEgressGuard) return;
  const orig = globalThis.fetch;
  globalThis.fetch = function guardedFetch(input, init) {
    const url = typeof input === "string" || input instanceof URL ? input : input?.url;
    if (isFanslyUrl(url)) {
      return Promise.reject(new NoProxyError("plain fetch", `DIRECT FANSLY BLOCKED ${new URL(String(url)).hostname} — use fanslyFetch(identity, …)`));
    }
    return orig.call(this, input, init);
  };
  globalThis.__fanslyEgressGuard = true;
}

// Header docs / session files carry the proxy that minted them. Readers refuse a doc minted on a
// different proxy. Docs from before 13 Oct have no stamp: adopt=true lets the caller stamp them.
export async function mintStamp(identity) {
  const p = await getProxy(identity);
  return { proxyId: p.proxyId, egressIp: p.egressIp, stampedAt: new Date().toISOString() };
}
export async function assertDocProxy(identity, doc, { adopt = false } = {}) {
  const p = await getProxy(identity), who = describe(identity);
  const stamp = doc?.egress;
  if (!stamp?.proxyId) {
    if (adopt) return { adopted: true, stamp: await mintStamp(identity) };
    throw new NoProxyError(who, "session/header doc has no proxy stamp (re-mint through her proxy)");
  }
  if (stamp.proxyId !== p.proxyId) throw new NoProxyError(who, "session/header doc was minted on a different proxy (re-mint needed)");
  return { adopted: false, stamp };
}
