// Any Hyperliquid address as a HYPE treasury: spot HYPE, staked HYPE, value, and its HYPE spot trades. Cached 15 s.
const { info, spot } = require('./_hl');
module.exports = async (req, res) => {
  const addr = String(req.query.addr || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return res.status(400).json({ error: 'That is not a Hyperliquid address (0x + 40 characters).' });
  try {
    const [s, bal, stake, fills, mids] = await Promise.all([
      spot(),
      info({ type: 'spotClearinghouseState', user: addr }),
      info({ type: 'delegatorSummary', user: addr }).catch(() => null),
      info({ type: 'userFills', user: addr }).catch(() => []),
      info({ type: 'allMids' }).catch(() => ({})),
    ]);
    const hb = ((bal && bal.balances) || []).find((b) => b.coin === 'HYPE' || b.token === s.hypeIndex);
    const spotHype = hb ? Number(hb.total || 0) : 0;
    const staked = stake ? Number(stake.delegated || 0) : 0;
    const idle = stake ? Number(stake.undelegated || 0) : 0;
    const pending = stake ? Number(stake.totalPendingWithdrawal || 0) : 0;
    const px = Number(s.ctx.markPx || s.ctx.midPx || mids[s.pair] || 0);
    const hf = (Array.isArray(fills) ? fills : []).filter((f) => f && f.coin === s.pair);
    const buys = hf.filter((f) => f.side === 'B');
    const sells = hf.filter((f) => f.side === 'A');
    const bSz = buys.reduce((t, f) => t + Number(f.sz || 0), 0);
    const bUsd = buys.reduce((t, f) => t + Number(f.sz || 0) * Number(f.px || 0), 0);
    const total = spotHype + staked + idle + pending;
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    res.json({
      addr, px,
      hype: { spot: spotHype, staked: staked + idle, pending, total, usd: total * px },
      buys: { n: buys.length, sz: bSz, usd: bUsd, avg: bSz ? bUsd / bSz : 0 },
      sells: { n: sells.length, sz: sells.reduce((t, f) => t + Number(f.sz || 0), 0) },
      fills: hf.slice(0, 400).map((f) => ({ t: f.time, side: f.side, sz: Number(f.sz), px: Number(f.px), hash: f.hash })),
    });
  } catch (e) {
    res.status(502).json({ error: 'Hyperliquid is not answering right now.' });
  }
};
