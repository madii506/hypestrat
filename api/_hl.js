// Shared Hyperliquid info helper (files starting with _ are not routes on Vercel).
const HL = 'https://api.hyperliquid.xyz/info';
async function info(body) {
  const r = await fetch(HL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('hl ' + r.status);
  return r.json();
}
let cache = null, at = 0;
// HYPE/USDC spot pair + its live context, resolved from spotMeta (never hard-coded)
async function spot() {
  if (cache && Date.now() - at < 10000) return cache;
  const [meta, ctxs] = await info({ type: 'spotMetaAndAssetCtxs' });
  const hype = meta.tokens.find((t) => t.name === 'HYPE');
  const usdc = meta.tokens.find((t) => t.name === 'USDC');
  const pair = meta.universe.find((u) => u.tokens[0] === hype.index && u.tokens[1] === usdc.index);
  const ctx = ctxs.find((c) => c && c.coin === pair.name) || ctxs[pair.index] || {};
  cache = { pair: pair.name, ctx, hypeIndex: hype.index };
  at = Date.now();
  return cache;
}
module.exports = { info, spot };
