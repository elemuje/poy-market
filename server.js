/**
 * PoYMarket Backend API  —  v2 (FIXED)
 * ─────────────────────────────────────────────────────────────────────────────
 * All selectors corrected to sha256(methodName)[0:4] — OP_NET standard.
 * buyNFT calldata fixed: tokenId only (seller removed — not read by contract).
 * placeOffer calldata fixed: tokenId only (offerSats sent as tx.value, not calldata).
 * Contract address corrected to deployed v7.
 * Rate limiting added.
 */

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3001;

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS ||
                         'opt1sqpasc3xhpfdhex4xpfp26enenj2rq3lvfy4577w9';
const OPNET_RPC        = process.env.OPNET_RPC        || 'https://api.opnet.org';
const NETWORK          = process.env.NETWORK          || 'testnet';
const ALLOWED_ORIGIN   = process.env.FRONTEND_ORIGIN  || 'http://localhost:5173';

// Selectors = sha256(methodName)[0:4] — OP_NET standard (NOT keccak256/full sig)
const SEL = {
  mint:             '0xdc6f17bb',
  mintFor:          '0xd20a45b1',
  nftTransfer:      '0x789e8d32',
  listNFT:          '0xbddede2e',
  delistNFT:        '0xc326f375',
  buyNFT:           '0x75797eb3',
  placeOffer:       '0xe3a30a9c',
  claimYield:       '0x652e4672',
  finalizeEpoch:    '0x6372c535',
  setPaused:        '0xe2f49a0c',
  setFee:           '0x76d218c1',
  ownerOfToken:     '0x986666bf',
  getListingPrice:  '0x0aba4213',
  getPendingYield:  '0xed2d8a6d',
  getTotalSupply:   '0x8e631e9c',
  getCurrentEpoch:  '0xe4b45917',
  getTotalStaked:   '0x8968be05',
  getFeeBP:         '0x9483fde8',
  isPaused:         '0xe3f322e1',
};

app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '16kb' }));

// Simple in-process rate limiter (120 req/min per IP)
const _rl = new Map();
app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const e = _rl.get(ip) || { n: 0, reset: now + 60000 };
  if (now > e.reset) { e.n = 0; e.reset = now + 60000; }
  if (++e.n > 120) { _rl.set(ip, e); return res.status(429).json({ error: 'Rate limit exceeded' }); }
  _rl.set(ip, e);
  next();
});

async function rpcPost(body) {
  const res = await fetch(OPNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

async function contractCall(selectorHex, calldataHex = '') {
  return rpcPost({
    jsonrpc: '2.0', id: 1, method: 'call',
    params: { to: CONTRACT_ADDRESS, data: selectorHex + calldataHex, network: NETWORK },
  });
}

// u256 LE encoding (32 bytes, little-endian) — matches BinaryWriter.writeU256
function encU256(n) {
  const bi = BigInt(n);
  let r = '';
  for (let i = 0; i < 32; i++) r += Number((bi >> BigInt(i * 8)) & 0xffn).toString(16).padStart(2, '0');
  return r;
}

// Taproot address → 32-byte witness program hex (bech32m decode)
function encAddr(addr) {
  const CS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const lo = addr.toLowerCase();
  const sep = lo.lastIndexOf('1');
  if (sep < 1) throw new Error('Bad address');
  const hrp = lo.slice(0, sep);
  const data = [];
  for (let i = sep + 1; i < lo.length; i++) { const d = CS.indexOf(lo[i]); if (d < 0) throw new Error('Bad char'); data.push(d); }
  function pm(v) { let c = 1; for (const x of v) { const t = c >> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((t >> i) & 1) c ^= GEN[i]; } return c; }
  function hx(h) { const r = []; for (let i = 0; i < h.length; i++) r.push(h.charCodeAt(i) >> 5); r.push(0); for (let i = 0; i < h.length; i++) r.push(h.charCodeAt(i) & 31); return r; }
  if (pm([...hx(hrp), ...data]) !== 0x2bc830a3) throw new Error('Bad bech32m checksum');
  if (data[0] !== 1) throw new Error('Not Taproot v1');
  let acc = 0, bits = 0; const res = [];
  for (const v of data.slice(1, -6)) { acc = (acc << 5) | v; bits += 5; while (bits >= 8) { bits -= 8; res.push((acc >> bits) & 0xff); } }
  if (res.length !== 32) throw new Error('Invalid P2TR length');
  return Buffer.from(res).toString('hex');
}

// ── READ ROUTES ─────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const [supply, epoch, staked, fee, paused] = await Promise.all([
      contractCall(SEL.getTotalSupply),
      contractCall(SEL.getCurrentEpoch),
      contractCall(SEL.getTotalStaked),
      contractCall(SEL.getFeeBP),
      contractCall(SEL.isPaused),
    ]);
    res.json({
      totalSupply:    supply?.result  || '0x0',
      currentEpoch:  epoch?.result   || '0x1',
      totalStaked:   staked?.result  || '0x0',
      feeBasisPoints: fee?.result    || '0xfa',
      paused:        paused?.result === '0x01',
    });
  } catch (err) {
    console.error('[/api/stats]', err.message);
    res.status(500).json({ error: 'stats unavailable' });
  }
});

app.get('/api/nft/:tokenId', async (req, res) => {
  try {
    const tid = encU256(req.params.tokenId);
    const [owner, price, pendingYield] = await Promise.all([
      contractCall(SEL.ownerOfToken,    tid),
      contractCall(SEL.getListingPrice, tid),
      contractCall(SEL.getPendingYield, tid),
    ]);
    res.json({
      tokenId:      req.params.tokenId,
      owner:        owner?.result        || null,
      listingPrice: price?.result        || '0x0',
      pendingYield: pendingYield?.result || '0x0',
    });
  } catch (err) {
    console.error('[/api/nft]', err.message);
    res.status(500).json({ error: 'nft data unavailable' });
  }
});

// ── ENCODE ROUTES (for UniSat/OKX/Leather PSBT path) ───────────────────────

app.post('/api/encode/mint', (req, res) => {
  const { stakedAmount } = req.body;
  if (!stakedAmount || BigInt(stakedAmount) <= 0n)
    return res.status(400).json({ error: 'stakedAmount required (satoshis > 0)' });
  res.json({ to: CONTRACT_ADDRESS, data: SEL.mint + encU256(stakedAmount) });
});

app.post('/api/encode/list', (req, res) => {
  const { tokenId, priceSats } = req.body;
  if (!tokenId || !priceSats || BigInt(priceSats) <= 0n)
    return res.status(400).json({ error: 'tokenId and priceSats required' });
  res.json({ to: CONTRACT_ADDRESS, data: SEL.listNFT + encU256(tokenId) + encU256(priceSats) });
});

app.post('/api/encode/delist', (req, res) => {
  const { tokenId } = req.body;
  if (!tokenId) return res.status(400).json({ error: 'tokenId required' });
  res.json({ to: CONTRACT_ADDRESS, data: SEL.delistNFT + encU256(tokenId) });
});

app.post('/api/encode/buy', (req, res) => {
  // buyNFT reads tokenId ONLY from calldata. Payment is in tx.value.
  const { tokenId, priceSats } = req.body;
  if (!tokenId) return res.status(400).json({ error: 'tokenId required' });
  if (!priceSats || BigInt(priceSats) <= 0n)
    return res.status(400).json({ error: 'priceSats required (exact listing price in satoshis)' });
  res.json({
    to:        CONTRACT_ADDRESS,
    data:      SEL.buyNFT + encU256(tokenId),  // selector + tokenId ONLY
    value:     priceSats.toString(),            // tx.value = listing price
    callValue: priceSats.toString(),
  });
});

app.post('/api/encode/offer', (req, res) => {
  // placeOffer reads tokenId ONLY from calldata. Offer amount is in tx.value.
  const { tokenId, offerSats } = req.body;
  if (!tokenId) return res.status(400).json({ error: 'tokenId required' });
  if (!offerSats || BigInt(offerSats) <= 0n)
    return res.status(400).json({ error: 'offerSats required (your bid amount in satoshis)' });
  res.json({
    to:        CONTRACT_ADDRESS,
    data:      SEL.placeOffer + encU256(tokenId), // selector + tokenId ONLY
    value:     offerSats.toString(),               // tx.value = offer amount
    callValue: offerSats.toString(),
  });
});

app.post('/api/encode/claim', (req, res) => {
  const { tokenId } = req.body;
  if (!tokenId) return res.status(400).json({ error: 'tokenId required' });
  res.json({ to: CONTRACT_ADDRESS, data: SEL.claimYield + encU256(tokenId) });
});

app.post('/api/encode/transfer', (req, res) => {
  const { tokenId, to } = req.body;
  if (!tokenId || !to) return res.status(400).json({ error: 'tokenId and to required' });
  let encodedAddr;
  try { encodedAddr = encAddr(to); }
  catch (e) { return res.status(400).json({ error: 'Invalid Taproot address: ' + e.message }); }
  res.json({ to: CONTRACT_ADDRESS, data: SEL.nftTransfer + encU256(tokenId) + encodedAddr });
});

app.post('/api/encode/finalize', (req, res) => {
  const { adminKey, epochRewardUnits } = req.body;
  if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY)
    return res.status(403).json({ error: 'Forbidden' });
  if (!epochRewardUnits) return res.status(400).json({ error: 'epochRewardUnits required' });
  res.json({ to: CONTRACT_ADDRESS, data: SEL.finalizeEpoch + encU256(epochRewardUnits) });
});

app.get('/health', (_, res) => res.json({ ok: true, network: NETWORK }));

app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  PoYMarket Backend v2  —  port ${PORT}       ║`);
  console.log(`║  Selectors: sha256(name)[0:4] ✓        ║`);
  console.log(`║  buyNFT/placeOffer: tokenId only ✓     ║`);
  console.log(`║  Contract: [PRIVATE]                   ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
