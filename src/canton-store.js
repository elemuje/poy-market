/**
 * canton-store.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Simulated Canton ledger state for demo/showcase.
 * Mirrors the Daml contract model:
 *   - CC (Canton Coin / Amulet) — real Canton native token
 *   - CBTC — simulated yield reward (institutional token, mock for now)
 *   - Yield NFTs — simulated as Daml-style contracts with contractId
 *
 * When a real validator node is available:
 *   - Replace mock functions with provider.submitTransaction() calls
 *   - Replace holdings with provider.getHolding()
 *   - Replace NFT state with provider.getActiveContracts()
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Token metadata ─────────────────────────────────────────────────────────
export const TOKENS = {
  CC: {
    id: 'CC',
    name: 'Canton Coin',
    symbol: 'CC',
    description: 'Native token of the Canton Network (Amulet)',
    color: '#F5A623',
    icon: '◈',
    decimals: 10,
  },
  CBTC: {
    id: 'CBTC',
    name: 'Wrapped Bitcoin',
    symbol: 'CBTC',
    description: 'Institutional Bitcoin on Canton (simulated yield reward)',
    color: '#F7931A',
    icon: '₿',
    decimals: 8,
  },
};

// ── Staking config ──────────────────────────────────────────────────────────
export const STAKING_CONFIG = {
  minStake: 10,        // minimum CC to stake
  maxStake: 100000,    // maximum CC per stake
  epochDurationDays: 7,
  // Yield tiers: stake more CC → higher CBTC APY
  tiers: [
    { label: 'Starter',   minCC: 10,    maxCC: 499,   cbTcAPY: 0.5,  rarityLabel: 'Common',    rarityColor: '#64748B' },
    { label: 'Builder',   minCC: 500,   maxCC: 1999,  cbTcAPY: 1.2,  rarityLabel: 'Rare',      rarityColor: '#3B82F6' },
    { label: 'Validator', minCC: 2000,  maxCC: 9999,  cbTcAPY: 2.8,  rarityLabel: 'Epic',      rarityColor: '#A855F7' },
    { label: 'Sovereign', minCC: 10000, maxCC: Infinity, cbTcAPY: 5.5, rarityLabel: 'Legendary', rarityColor: '#F5A623' },
  ],
};

export function getTier(ccAmount) {
  return STAKING_CONFIG.tiers.find(
    t => ccAmount >= t.minCC && ccAmount <= t.maxCC
  ) || STAKING_CONFIG.tiers[0];
}

// ── NFT art generator (emoji-based, deterministic) ─────────────────────────
const NFT_ARTS = ['⬡', '◈', '⬢', '◉', '⬟', '⬛', '◆', '⬠', '◐', '⬣'];
const NFT_NAMES = [
  'Genesis Yield', 'Canton Core', 'Ledger Shard', 'Proof Node',
  'Amulet Forge', 'Signal Prime', 'Epoch Vault', 'Sync Chain',
  'Canton Summit', 'Delta Lock', 'Harmony Root', 'Canton Arc',
];

function genNFTId() {
  return 'NFT-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

function genContractId() {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// ── Initial mock state ──────────────────────────────────────────────────────
function makeInitialNFTs() {
  return Array.from({ length: 14 }, (_, i) => {
    const tier = STAKING_CONFIG.tiers[i % 4];
    const maxForGen = tier.maxCC === Infinity ? tier.minCC * 5 : tier.maxCC;
    const stakedCC = tier.minCC + Math.floor(Math.random() * (maxForGen - tier.minCC));
    const accrued = +(stakedCC * tier.cbTcAPY / 100 * ((Math.random() * 30 + 5) / 365)).toFixed(6);
    return {
      id: genNFTId(),
      contractId: genContractId(),
      num: String(i + 1).padStart(3, '0'),
      name: NFT_NAMES[i % NFT_NAMES.length],
      art: NFT_ARTS[i % NFT_ARTS.length],
      tier: tier.label,
      rarity: tier.rarityLabel,
      rarityColor: tier.rarityColor,
      stakedCC,
      accruedCBTC: accrued,
      apy: tier.cbTcAPY,
      epoch: Math.floor(Math.random() * 12) + 1,
      owner: 'market::demo',
      listed: i < 8,
      listingPrice: i < 8 ? +(stakedCC * 0.12 + Math.random() * 20).toFixed(2) : 0,
      listingToken: i % 3 === 0 ? 'CBTC' : 'CC',
      highBid: i < 8 ? +(stakedCC * 0.09 + Math.random() * 10).toFixed(2) : 0,
      createdAt: Date.now() - Math.random() * 30 * 86400000,
      likes: Math.floor(Math.random() * 120),
    };
  });
}

// ── Ledger state (in-memory simulation) ────────────────────────────────────
export const ledger = {
  // User wallet (populated on connect)
  party: null,
  partyId: null,
  email: null,
  publicKey: null,

  // Balances
  ccBalance: 0,
  cbtcBalance: 0,

  // Staking positions
  stakes: [],     // [{ id, ccAmount, tier, startEpoch, accruedCBTC, nftId }]

  // NFT holdings
  myNFTs: [],

  // Market NFTs
  marketNFTs: makeInitialNFTs(),

  // Activity log
  activity: [],

  // Stats
  totalCCStaked: 284750,
  totalCBTCDistributed: 142.883,
  totalNFTsMinted: 1847,
  currentEpoch: 14,
  nextEpochHours: 72,
};

// ── Simulate wallet connect (populates from Loop provider) ──────────────────
export function connectWallet(provider) {
  ledger.party = provider.party_id || provider.partyId || 'demo-party';
  ledger.partyId = ledger.party;
  ledger.email = provider.email || '';
  ledger.publicKey = provider.public_key || provider.publicKey || '';
  // Simulated balances (replace with provider.getHolding() when node available)
  ledger.ccBalance = +(1200 + Math.random() * 3800).toFixed(2);
  ledger.cbtcBalance = +(Math.random() * 0.08).toFixed(8);
  ledger.stakes = [];
  ledger.myNFTs = [];
}

export function disconnectWallet() {
  // Remove any NFTs the user had listed in the marketplace
  if (ledger.partyId) {
    ledger.marketNFTs = ledger.marketNFTs.filter(n => n.owner !== ledger.partyId);
  }
  ledger.party = null;
  ledger.partyId = null;
  ledger.email = null;
  ledger.ccBalance = 0;
  ledger.cbtcBalance = 0;
  ledger.stakes = [];
  ledger.myNFTs = [];
}

// ── Staking operations ──────────────────────────────────────────────────────
export function stakeCC(ccAmount) {
  if (!Number.isFinite(ccAmount) || ccAmount <= 0) throw new Error('Invalid stake amount');
  if (ccAmount < STAKING_CONFIG.minStake) throw new Error(`Minimum stake is ${STAKING_CONFIG.minStake} CC`);
  if (ccAmount > STAKING_CONFIG.maxStake) throw new Error(`Maximum stake is ${STAKING_CONFIG.maxStake.toLocaleString()} CC`);
  if (ccAmount > ledger.ccBalance) throw new Error('Insufficient CC balance');
  const tier = getTier(ccAmount);
  const stake = {
    id: 'STAKE-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    ccAmount,
    tier: tier.label,
    apy: tier.cbTcAPY,
    startEpoch: ledger.currentEpoch,
    startTime: Date.now(),
    accruedCBTC: 0,
    nftId: null,
  };
  ledger.ccBalance = +(ledger.ccBalance - ccAmount).toFixed(2);
  ledger.stakes.push(stake);
  ledger.totalCCStaked += ccAmount;
  addActivity('Staked', `Staked ${ccAmount} CC in ${tier.label} tier`);
  return stake;
}

export function mintYieldNFT(stakeId) {
  const stake = ledger.stakes.find(s => s.id === stakeId);
  if (!stake) throw new Error('Stake not found');
  if (stake.nftId) throw new Error('NFT already minted for this stake');
  const tier = STAKING_CONFIG.tiers.find(t => t.label === stake.tier);
  const nft = {
    id: genNFTId(),
    contractId: genContractId(),
    num: String(ledger.myNFTs.length + 1).padStart(3, '0'),
    name: NFT_NAMES[Math.floor(Math.random() * NFT_NAMES.length)],
    art: NFT_ARTS[Math.floor(Math.random() * NFT_ARTS.length)],
    tier: tier.label,
    rarity: tier.rarityLabel,
    rarityColor: tier.rarityColor,
    stakedCC: stake.ccAmount,
    accruedCBTC: stake.accruedCBTC,
    apy: tier.cbTcAPY,
    epoch: ledger.currentEpoch,
    owner: ledger.partyId,
    listed: false,
    listingPrice: 0,
    listingToken: 'CC',
    highBid: 0,
    createdAt: Date.now(),
    likes: 0,
  };
  stake.nftId = nft.id;
  ledger.myNFTs.push(nft);
  ledger.totalNFTsMinted++;
  addActivity('Minted', `Minted ${nft.name} #${nft.num} (${tier.rarityLabel})`);
  return nft;
}

// ── Simulate yield accrual (called periodically) ────────────────────────────
export function accrueYield() {
  ledger.stakes.forEach(stake => {
    if (!stake.nftId) return;
    const hoursElapsed = (Date.now() - stake.startTime) / 3600000;
    const dailyRate = stake.apy / 100 / 365;
    stake.accruedCBTC = +(stake.ccAmount * dailyRate * (hoursElapsed / 24) * 0.00001).toFixed(8);
    const nft = ledger.myNFTs.find(n => n.id === stake.nftId);
    if (nft) nft.accruedCBTC = stake.accruedCBTC;
  });
}

export function claimYield(nftId) {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  // Use a minimum threshold to avoid floating-point dust claims
  if (nft.accruedCBTC < 0.00000001) throw new Error('No yield to claim');
  const claimed = nft.accruedCBTC;
  ledger.cbtcBalance = +(ledger.cbtcBalance + claimed).toFixed(8);
  ledger.totalCBTCDistributed += claimed;
  // Reset BOTH nft and its parent stake so accrueYield() doesn't re-populate from stale stake value
  nft.accruedCBTC = 0;
  const stake = ledger.stakes.find(s => s.nftId === nftId);
  if (stake) {
    stake.accruedCBTC = 0;
    stake.startTime = Date.now(); // reset accrual window from claim point
  }
  addActivity('Claimed', `Claimed ${claimed.toFixed(8)} CBTC from ${nft.name}`);
  return claimed;
}

// ── Marketplace operations ──────────────────────────────────────────────────
export function listNFT(nftId, price, token = 'CC') {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  if (price <= 0) throw new Error('Price must be greater than 0');
  if (nft.listed) throw new Error('NFT is already listed');
  nft.listed = true;
  nft.listingPrice = price;
  nft.listingToken = token;
  // Push the actual object reference (not a copy) so delistNFT mutations stay in sync
  ledger.marketNFTs.push(nft);
  addActivity('Listed', `Listed ${nft.name} for ${price} ${token}`);
  return nft;
}

export function delistNFT(nftId) {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  nft.listed = false;
  nft.listingPrice = 0;
  const idx = ledger.marketNFTs.findIndex(n => n.id === nftId);
  if (idx !== -1) ledger.marketNFTs.splice(idx, 1);
  addActivity('Delisted', `Delisted ${nft.name}`);
}

export function buyNFT(nftId) {
  const mkt = ledger.marketNFTs.find(n => n.id === nftId);
  if (!mkt) throw new Error('NFT not found in market');
  if (!mkt.listed) throw new Error('NFT is not listed');
  const price = mkt.listingPrice;
  const token = mkt.listingToken;
  if (token === 'CC' && ledger.ccBalance < price) throw new Error('Insufficient CC balance');
  if (token === 'CBTC' && ledger.cbtcBalance < price) throw new Error('Insufficient CBTC balance');
  if (token === 'CC') ledger.ccBalance = +(ledger.ccBalance - price).toFixed(2);
  else ledger.cbtcBalance = +(ledger.cbtcBalance - price).toFixed(8);
  const owned = { ...mkt, owner: ledger.partyId, listed: false, listingPrice: 0 };
  ledger.myNFTs.push(owned);
  const idx = ledger.marketNFTs.findIndex(n => n.id === nftId);
  if (idx !== -1) ledger.marketNFTs.splice(idx, 1);
  addActivity('Bought', `Bought ${mkt.name} for ${price} ${token}`);
  return owned;
}

export function placeBid(nftId, bidAmount, token = 'CC') {
  const mkt = ledger.marketNFTs.find(n => n.id === nftId);
  if (!mkt) throw new Error('NFT not found');
  if (bidAmount <= 0) throw new Error('Bid amount must be greater than 0');
  if (!Number.isFinite(bidAmount)) throw new Error('Invalid bid amount');
  if (mkt.owner === ledger.partyId) throw new Error('You cannot bid on your own NFT');
  if (bidAmount <= mkt.highBid) throw new Error('Bid must be higher than current highest bid');
  // Validate bidder balance
  if (token === 'CC' && ledger.ccBalance < bidAmount) throw new Error('Insufficient CC balance to place this bid');
  if (token === 'CBTC' && ledger.cbtcBalance < bidAmount) throw new Error('Insufficient CBTC balance to place this bid');
  mkt.highBid = bidAmount;
  addActivity('Bid', `Placed bid of ${bidAmount} ${token} on ${mkt.name}`);
}

// ── Activity log ────────────────────────────────────────────────────────────
function addActivity(type, message) {
  ledger.activity.unshift({
    type,
    message,
    time: Date.now(),
    txId: genContractId().slice(0, 16),
  });
  if (ledger.activity.length > 50) ledger.activity.pop();
}
