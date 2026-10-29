// Live HYPE market data from Hyperliquid (+ the coin's market cap from Dexscreener once a CA is set). Cached 10 s.
const { info, spot } = require('./_hl');
module.exports = async (req, res) => {
  try {
    const [s, mids, vals] = await Promise.all([
      spot(),
      info({ type: 'allMids' }),
      info({ type: 'validatorSummaries' }).catch(() => null),
    ]);
    const c = s.ctx;
    const px = Number(c.markPx || c.midPx || mids[s.pair] || mids.HYPE || 0);
    const prev = Number(c.prevDayPx || 0);
    const circ = Number(c.circulatingSupply || 0);
    // stake-weighted predicted staking APR across active validators
    let apr = null;
    if (Array.isArray(vals)) {
      let w = 0, sum = 0;
      for (const v of vals) {
        if (!v || v.isJailed || v.isActive === false) continue;
        const st = Number(v.stake || 0);
        const row = (v.stats || []).find((x) => x && x[0] === 'week') || (v.stats || [])[0];
        const a = row && row[1] ? Number(row[1].predictedApr) : NaN;
        if (!st || !isFinite(a)) continue;
        w += st; sum += st * a;
      }
      if (w) { apr = sum / w; if (apr < 1) apr *= 100; }
    }
    let coin = null;
    const ca = String(req.query.ca || '').trim();
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) {
      try {
        const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + ca);
        const j = await r.json();
        const pairs = (j.pairs || []).filter((p) => p.chainId === 'solana');
        pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
        const p = pairs[0];
        if (p) coin = { mcap: Number(p.marketCap || p.fdv || 0), px: Number(p.priceUsd || 0) };
      } catch (e) {}
    }
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    res.json({
      at: Date.now(),
      hype: { px, prev, chg: prev ? (px / prev - 1) * 100 : 0, vol: Number(c.dayNtlVlm || 0), circ, mcap: circ * px, pair: s.pair },
      sol: { px: Number(mids.SOL || 0) },
      apr, coin,
    });
  } catch (e) {
    res.status(502).json({ error: 'Hyperliquid is not answering right now.' });
  }
};
