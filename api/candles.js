// HYPE/USDC spot candles from Hyperliquid. Cached 60 s.
const { info, spot } = require('./_hl');
const SPAN = { '15m': 2 * 864e5, '1h': 7 * 864e5, '4h': 30 * 864e5, '1d': 200 * 864e5 };
module.exports = async (req, res) => {
  try {
    const s = await spot();
    const iv = SPAN[req.query.i] ? req.query.i : '1h';
    const end = Date.now();
    let k = await info({ type: 'candleSnapshot', req: { coin: s.pair, interval: iv, startTime: end - SPAN[iv], endTime: end } });
    if (!Array.isArray(k) || !k.length) k = await info({ type: 'candleSnapshot', req: { coin: 'HYPE', interval: iv, startTime: end - SPAN[iv], endTime: end } });
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.json({ i: iv, candles: (k || []).map((x) => [x.t, +x.o, +x.h, +x.l, +x.c, +x.v]) });
  } catch (e) {
    res.status(502).json({ error: 'Hyperliquid is not answering right now.' });
  }
};
