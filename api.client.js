/**
 * PoYMarket Frontend API Client
 * ─────────────────────────────
 * All contract interactions go through the backend.
 * The contract address NEVER appears in this file.
 *
 * Usage:
 *   import api from './api.js';
 *   const stats = await api.getStats();
 *   const tx    = await api.encodeMint({ stakedAmount: '100000' });
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const api = {
  /* ── READ ───────────────────────────────────────────── */

  /** Global marketplace stats (totalSupply, epoch, staked, fee, paused) */
  getStats: () => request('/api/stats'),

  /** Single NFT on-chain data */
  getNFT: (tokenId) => request(`/api/nft/${tokenId}`),

  /** Whether contract is paused */
  isPaused: () => request('/api/paused'),

  /* ── ENCODE (returns {to, data} for wallet signing) ── */

  /** Encode a mint transaction */
  encodeMint: ({ stakedAmount }) =>
    request('/api/encode/mint', {
      method: 'POST',
      body: JSON.stringify({ stakedAmount }),
    }),

  /** Encode a listNFT transaction */
  encodeList: ({ tokenId, priceSats }) =>
    request('/api/encode/list', {
      method: 'POST',
      body: JSON.stringify({ tokenId, priceSats }),
    }),

  /** Encode a delistNFT transaction */
  encodeDelist: ({ tokenId }) =>
    request('/api/encode/delist', {
      method: 'POST',
      body: JSON.stringify({ tokenId }),
    }),

  /** Encode a buyNFT transaction */
  encodeBuy: ({ tokenId, seller }) =>
    request('/api/encode/buy', {
      method: 'POST',
      body: JSON.stringify({ tokenId, seller }),
    }),

  /** Encode a placeOffer transaction */
  encodeOffer: ({ tokenId, offerSats }) =>
    request('/api/encode/offer', {
      method: 'POST',
      body: JSON.stringify({ tokenId, offerSats }),
    }),

  /** Encode a claimYield transaction */
  encodeClaim: ({ tokenId }) =>
    request('/api/encode/claim', {
      method: 'POST',
      body: JSON.stringify({ tokenId }),
    }),

  /** Encode an nftTransfer transaction */
  encodeTransfer: ({ tokenId, to }) =>
    request('/api/encode/transfer', {
      method: 'POST',
      body: JSON.stringify({ tokenId, to }),
    }),
};

export default api;


/* ══════════════════════════════════════════════════════════
   EXAMPLE: How to use with OP_WALLET in your React component
   ══════════════════════════════════════════════════════════

import api from './api';

// 1. Mint an NFT
async function handleMint(stakedAmount) {
  const { to, data } = await api.encodeMint({ stakedAmount: String(stakedAmount) });
  // wallet is your connected wallet object from the WalletModal
  await window.opnet.sendTransaction({ to, data });
}

// 2. List an NFT
async function handleList(tokenId, priceBTC) {
  const priceSats = String(Math.round(priceBTC * 1e8));
  const { to, data } = await api.encodeList({ tokenId: String(tokenId), priceSats });
  await window.opnet.sendTransaction({ to, data });
}

// 3. Buy an NFT
async function handleBuy(tokenId, sellerAddress) {
  const { to, data } = await api.encodeBuy({ tokenId: String(tokenId), seller: sellerAddress });
  await window.opnet.sendTransaction({ to, data });
}

// 4. Claim yield
async function handleClaimYield(tokenId) {
  const { to, data } = await api.encodeClaim({ tokenId: String(tokenId) });
  await window.opnet.sendTransaction({ to, data });
}

// 5. Read stats on component mount
useEffect(() => {
  api.getStats().then(stats => {
    setTotalSupply(parseInt(stats.totalSupply, 16));
    setCurrentEpoch(parseInt(stats.currentEpoch, 16));
  });
}, []);

*/
