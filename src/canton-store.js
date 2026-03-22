/**
 * canton-store.js  —  v2 (Time-Lock Staking)
 * ─────────────────────────────────────────────────────────────────────────────
 * Canton PoY Market — simulated ledger state
 *
 * New in v2: Time-lock staking model
 *   - Users choose a lock duration (7d / 30d / 90d / 180d / 365d)
 *   - Longer lock = higher yield multiplier (1x → 7x)
 *   - More CC staked = higher base APY tier (Common → Legendary)
 *   - Effective APY = tier base APY × lock multiplier
 *   - NFT floor price rises as maturity approaches (0% → 100%)
 *   - Stake positions (NFTs) are fully tradeable — buyer inherits the lock
 *   - Yield can be claimed at any time
 *   - Principal locked until expiry (early unlock = 20% yield penalty)
 *
 * Production swap-in notes:
 *   - Replace stakeCC()    with provider.submitTransaction() to Daml staking contract
 *   - Replace buyNFT()     with provider.submitTransaction() to Daml transfer choice
 *   - Replace claimYield() with provider.submitTransaction() to Daml yield claim
 *   - Replace getHolding() with provider.getHolding() for real CC/CBTC balances
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Token metadata ─────────────────────────────────────────────────────────
export const TOKENS = {
  CC: {
    id: 'CC', name: 'Canton Coin', symbol: 'CC',
    description: 'Native token of the Canton Network (Amulet)',
    color: '#F5A623', icon: '◈', decimals: 10,
  },
  CBTC: {
    id: 'CBTC', name: 'Wrapped Bitcoin', symbol: 'CBTC',
    description: 'Institutional Bitcoin on Canton (simulated yield reward)',
    color: '#F7931A', icon: '₿', decimals: 8,
  },
};

// ── Lock duration options ──────────────────────────────────────────────────
export const LOCK_OPTIONS = [
  { days: 7,   ms: 7   * 86400000, label: '7 days',  shortLabel: '7d',   multiplier: 1.0, badge: 'Flexible', color: '#64748B' },
  { days: 30,  ms: 30  * 86400000, label: '30 days', shortLabel: '30d',  multiplier: 1.5, badge: 'Standard', color: '#3B82F6' },
  { days: 90,  ms: 90  * 86400000, label: '90 days', shortLabel: '90d',  multiplier: 2.5, badge: 'Extended', color: '#A855F7' },
  { days: 180, ms: 180 * 86400000, label: '6 months', shortLabel: '6mo', multiplier: 4.0, badge: 'Premium',  color: '#F5A623' },
  { days: 365, ms: 365 * 86400000, label: '1 year',  shortLabel: '1yr',  multiplier: 7.0, badge: 'Maximum',  color: '#F7931A' },
];

// ── Staking tiers (based on CC amount) ────────────────────────────────────
export const STAKING_CONFIG = {
  minStake: 10,
  maxStake: 100000,
  epochDurationDays: 7,
  earlyUnlockPenalty: 0.20,   // 20% of accrued yield forfeited on early unlock
  // Floor price = stakedCC * BASE_PRICE_RATIO * (1 + maturity * PRICE_GROWTH)
  basePriceRatio: 0.10,       // 10% of stake at 0% maturity
  priceGrowth:    2.0,        // ×2 additional at 100% maturity → 30% of stake
  tiers: [
    { label: 'Starter',   minCC: 10,    maxCC: 499,      baseAPY: 0.5,  rarityLabel: 'Common',    rarityColor: '#64748B' },
    { label: 'Builder',   minCC: 500,   maxCC: 1999,     baseAPY: 1.2,  rarityLabel: 'Rare',      rarityColor: '#3B82F6' },
    { label: 'Validator', minCC: 2000,  maxCC: 9999,     baseAPY: 2.8,  rarityLabel: 'Epic',      rarityColor: '#A855F7' },
    { label: 'Sovereign', minCC: 10000, maxCC: Infinity,  baseAPY: 5.5,  rarityLabel: 'Legendary', rarityColor: '#F5A623' },
  ],
};

export function getTier(ccAmount) {
  return STAKING_CONFIG.tiers.find(t => ccAmount >= t.minCC && ccAmount <= t.maxCC)
    || STAKING_CONFIG.tiers[0];
}

export function getLockOption(days) {
  return LOCK_OPTIONS.find(l => l.days === days) || LOCK_OPTIONS[0];
}

/** Effective APY = tier base APY × lock multiplier */
export function getEffectiveAPY(ccAmount, lockDays) {
  const tier = getTier(ccAmount);
  const lock = getLockOption(lockDays);
  return +(tier.baseAPY * lock.multiplier).toFixed(2);
}

/** Maturity progress 0..1 — clamped so it never exceeds 1 */
export function getMaturity(startTime, lockMs) {
  return Math.min(1, (Date.now() - startTime) / lockMs);
}

/** Floor price in CC — rises as maturity approaches */
export function getFloorPrice(stakedCC, maturity) {
  return +(stakedCC * STAKING_CONFIG.basePriceRatio * (1 + maturity * STAKING_CONFIG.priceGrowth)).toFixed(2);
}

/** Time remaining until lock expiry as a human string */
export function timeRemaining(lockExpiry) {
  const ms = lockExpiry - Date.now();
  if (ms <= 0) return 'Matured';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ── NFT content pools ──────────────────────────────────────────────────────
const NFT_ARTS  = ['⬡', '◈', '⬢', '◉', '⬟', '⬛', '◆', '⬠', '◐', '⬣'];
const NFT_NAMES = [
  'Genesis Yield', 'Canton Core', 'Ledger Shard', 'Proof Node',
  'Amulet Forge',  'Signal Prime','Epoch Vault',  'Sync Chain',
  'Canton Summit', 'Delta Lock',  'Harmony Root', 'Canton Arc',
];

function genNFTId()      { return 'NFT-'   + Math.random().toString(36).slice(2, 10).toUpperCase(); }
function genContractId() { return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

// ── Build initial market NFTs ──────────────────────────────────────────────
function makeInitialNFTs() {
  return Array.from({ length: 14 }, (_, i) => {
    const tier = STAKING_CONFIG.tiers[i % 4];
    const lock = LOCK_OPTIONS[i % 5];
    const maxForGen = tier.maxCC === Infinity ? tier.minCC * 5 : tier.maxCC;
    const stakedCC  = tier.minCC + Math.floor(Math.random() * (maxForGen - tier.minCC));
    const effectiveAPY = +(tier.baseAPY * lock.multiplier).toFixed(2);
    // Simulate NFTs at various stages of maturity
    const maturityFraction = Math.random();
    const lockMs    = lock.ms;
    const startTime = Date.now() - Math.floor(lockMs * maturityFraction);
    const lockExpiry = startTime + lockMs;
    const maturity   = getMaturity(startTime, lockMs);
    const floorPrice = getFloorPrice(stakedCC, maturity);
    const accrued    = +(stakedCC * effectiveAPY / 100 / 365 * (lock.days * maturityFraction) * 0.00001).toFixed(8);
    return {
      id: genNFTId(), contractId: genContractId(),
      num: String(i + 1).padStart(3, '0'),
      name: NFT_NAMES[i % NFT_NAMES.length],
      art:  NFT_ARTS[i % NFT_ARTS.length],
      tier: tier.label, rarity: tier.rarityLabel, rarityColor: tier.rarityColor,
      stakedCC, accruedCBTC: accrued, effectiveAPY,
      lockDays: lock.days, lockLabel: lock.label, lockMultiplier: lock.multiplier,
      lockBadge: lock.badge, lockColor: lock.color,
      startTime, lockExpiry, lockMs,
      floorPrice, highBid: +(floorPrice * 0.9 + Math.random() * 10).toFixed(2),
      epoch: Math.floor(Math.random() * 12) + 1,
      owner: 'market::demo',
      listed: i < 9,
      listingPrice: i < 9 ? floorPrice : 0,
      listingToken: i % 3 === 0 ? 'CBTC' : 'CC',
      createdAt: startTime,
      likes: Math.floor(Math.random() * 120),
    };
  });
}

// ── Ledger state ───────────────────────────────────────────────────────────
export const ledger = {
  party: null, partyId: null, email: null, publicKey: null,
  ccBalance: 0, cbtcBalance: 0,
  stakes: [],
  myNFTs: [],
  marketNFTs: makeInitialNFTs(),
  activity: [],
  totalCCStaked: 284750, totalCBTCDistributed: 142.883,
  totalNFTsMinted: 1847, currentEpoch: 14, nextEpochHours: 72,
};

// ── Wallet ─────────────────────────────────────────────────────────────────
export function connectWallet(provider) {
  ledger.party    = provider.party_id || provider.partyId || 'demo-party';
  ledger.partyId  = ledger.party;
  ledger.email    = provider.email      || '';
  ledger.publicKey = provider.public_key || provider.publicKey || '';
  ledger.ccBalance   = +(1200 + Math.random() * 3800).toFixed(2);
  ledger.cbtcBalance = +(Math.random() * 0.08).toFixed(8);
  ledger.stakes  = [];
  ledger.myNFTs  = [];
}

export function disconnectWallet() {
  if (ledger.partyId) {
    ledger.marketNFTs = ledger.marketNFTs.filter(n => n.owner !== ledger.partyId);
  }
  Object.assign(ledger, { party:null, partyId:null, email:null, ccBalance:0, cbtcBalance:0, stakes:[], myNFTs:[] });
}

// ── Staking ────────────────────────────────────────────────────────────────
export function stakeCC(ccAmount, lockDays) {
  if (!Number.isFinite(ccAmount) || ccAmount <= 0) throw new Error('Invalid stake amount');
  if (ccAmount < STAKING_CONFIG.minStake) throw new Error(`Minimum stake is ${STAKING_CONFIG.minStake} CC`);
  if (ccAmount > STAKING_CONFIG.maxStake) throw new Error(`Maximum stake is ${STAKING_CONFIG.maxStake.toLocaleString()} CC`);
  if (ccAmount > ledger.ccBalance) throw new Error('Insufficient CC balance');
  const lock = getLockOption(lockDays);
  if (!lock) throw new Error('Invalid lock period');
  const tier = getTier(ccAmount);
  const effectiveAPY = getEffectiveAPY(ccAmount, lockDays);
  const startTime  = Date.now();
  const lockExpiry = startTime + lock.ms;
  const stake = {
    id: 'STAKE-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    ccAmount, effectiveAPY,
    tier: tier.label, apy: tier.baseAPY,
    lockDays: lock.days, lockLabel: lock.label,
    lockMultiplier: lock.multiplier, lockBadge: lock.badge, lockColor: lock.color,
    lockMs: lock.ms, startTime, lockExpiry,
    accruedCBTC: 0, nftId: null,
  };
  ledger.ccBalance = +(ledger.ccBalance - ccAmount).toFixed(2);
  ledger.stakes.push(stake);
  ledger.totalCCStaked += ccAmount;
  addActivity('Staked', `Staked ${ccAmount} CC for ${lock.label} @ ${effectiveAPY}% APY`);
  return stake;
}

export function mintYieldNFT(stakeId) {
  const stake = ledger.stakes.find(s => s.id === stakeId);
  if (!stake) throw new Error('Stake not found');
  if (stake.nftId) throw new Error('NFT already minted for this stake');
  const tier = STAKING_CONFIG.tiers.find(t => t.label === stake.tier);
  const maturity   = getMaturity(stake.startTime, stake.lockMs);
  const floorPrice = getFloorPrice(stake.ccAmount, maturity);
  const nft = {
    id: genNFTId(), contractId: genContractId(),
    num: String(ledger.myNFTs.length + 1).padStart(3, '0'),
    name: NFT_NAMES[Math.floor(Math.random() * NFT_NAMES.length)],
    art:  NFT_ARTS[Math.floor(Math.random() * NFT_ARTS.length)],
    tier: tier.label, rarity: tier.rarityLabel, rarityColor: tier.rarityColor,
    stakedCC: stake.ccAmount, accruedCBTC: stake.accruedCBTC,
    effectiveAPY: stake.effectiveAPY,
    lockDays: stake.lockDays, lockLabel: stake.lockLabel,
    lockMultiplier: stake.lockMultiplier, lockBadge: stake.lockBadge, lockColor: stake.lockColor,
    lockMs: stake.lockMs, startTime: stake.startTime, lockExpiry: stake.lockExpiry,
    floorPrice, highBid: 0,
    epoch: ledger.currentEpoch, owner: ledger.partyId,
    listed: false, listingPrice: 0, listingToken: 'CC',
    createdAt: Date.now(), likes: 0,
  };
  stake.nftId = nft.id;
  ledger.myNFTs.push(nft);
  ledger.totalNFTsMinted++;
  addActivity('Minted', `Minted ${nft.name} #${nft.num} — locked ${nft.lockLabel} @ ${nft.effectiveAPY}% APY`);
  return nft;
}

// ── Yield accrual (called every 5s) ───────────────────────────────────────
export function accrueYield() {
  ledger.stakes.forEach(stake => {
    if (!stake.nftId) return;
    const hoursElapsed = (Date.now() - stake.startTime) / 3600000;
    const dailyRate    = stake.effectiveAPY / 100 / 365;
    stake.accruedCBTC  = +(stake.ccAmount * dailyRate * (hoursElapsed / 24) * 0.00001).toFixed(8);
    // Update floor price on the NFT too
    const nft = ledger.myNFTs.find(n => n.id === stake.nftId);
    if (nft) {
      nft.accruedCBTC = stake.accruedCBTC;
      const mat = getMaturity(stake.startTime, stake.lockMs);
      nft.floorPrice = getFloorPrice(stake.ccAmount, mat);
    }
  });
  // Update floor prices on market NFTs too
  ledger.marketNFTs.forEach(nft => {
    const mat = getMaturity(nft.startTime, nft.lockMs);
    nft.floorPrice = getFloorPrice(nft.stakedCC, mat);
  });
}

export function claimYield(nftId) {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  if (nft.accruedCBTC < 0.00000001) throw new Error('No yield to claim');
  const claimed = nft.accruedCBTC;
  ledger.cbtcBalance = +(ledger.cbtcBalance + claimed).toFixed(8);
  ledger.totalCBTCDistributed += claimed;
  nft.accruedCBTC = 0;
  const stake = ledger.stakes.find(s => s.nftId === nftId);
  if (stake) { stake.accruedCBTC = 0; stake.startTime = Date.now(); }
  addActivity('Claimed', `Claimed ${claimed.toFixed(8)} CBTC from ${nft.name}`);
  return claimed;
}

/** Early unlock — returns principal CC but forfeits 20% of accrued yield */
export function earlyUnlock(nftId) {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  if (Date.now() >= nft.lockExpiry) throw new Error('Lock already matured — use standard unlock');
  const penalty = +(nft.accruedCBTC * STAKING_CONFIG.earlyUnlockPenalty).toFixed(8);
  const received = +(nft.accruedCBTC - penalty).toFixed(8);
  ledger.ccBalance   = +(ledger.ccBalance + nft.stakedCC).toFixed(2);
  ledger.cbtcBalance = +(ledger.cbtcBalance + received).toFixed(8);
  ledger.totalCBTCDistributed += received;
  // Remove from myNFTs and stakes
  ledger.myNFTs  = ledger.myNFTs.filter(n => n.id !== nftId);
  ledger.stakes  = ledger.stakes.filter(s => s.nftId !== nftId);
  ledger.marketNFTs = ledger.marketNFTs.filter(n => n.id !== nftId);
  addActivity('Unlocked', `Early unlock ${nft.name} — received ${nft.stakedCC} CC + ${received} CBTC (penalty: ${penalty})`);
  return { ccReturned: nft.stakedCC, cbtcReceived: received, penalty };
}

/** Mature unlock — lock has expired, no penalty */
export function matureUnlock(nftId) {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  if (Date.now() < nft.lockExpiry) throw new Error('Lock has not matured yet');
  const cbtc = nft.accruedCBTC;
  ledger.ccBalance   = +(ledger.ccBalance + nft.stakedCC).toFixed(2);
  ledger.cbtcBalance = +(ledger.cbtcBalance + cbtc).toFixed(8);
  ledger.totalCBTCDistributed += cbtc;
  ledger.myNFTs  = ledger.myNFTs.filter(n => n.id !== nftId);
  ledger.stakes  = ledger.stakes.filter(s => s.nftId !== nftId);
  ledger.marketNFTs = ledger.marketNFTs.filter(n => n.id !== nftId);
  addActivity('Matured', `Matured unlock ${nft.name} — received ${nft.stakedCC} CC + ${cbtc.toFixed(8)} CBTC`);
  return { ccReturned: nft.stakedCC, cbtcReceived: cbtc };
}

// ── Marketplace ────────────────────────────────────────────────────────────
export function listNFT(nftId, price, token = 'CC') {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be greater than 0');
  if (nft.listed) throw new Error('NFT is already listed');
  nft.listed = true; nft.listingPrice = price; nft.listingToken = token;
  ledger.marketNFTs.push(nft); // live reference — mutations stay in sync
  addActivity('Listed', `Listed ${nft.name} for ${price} ${token}`);
  return nft;
}

export function delistNFT(nftId) {
  const nft = ledger.myNFTs.find(n => n.id === nftId);
  if (!nft) throw new Error('NFT not found');
  nft.listed = false; nft.listingPrice = 0;
  const idx = ledger.marketNFTs.findIndex(n => n.id === nftId);
  if (idx !== -1) ledger.marketNFTs.splice(idx, 1);
  addActivity('Delisted', `Delisted ${nft.name}`);
}

export function buyNFT(nftId) {
  const mkt = ledger.marketNFTs.find(n => n.id === nftId);
  if (!mkt) throw new Error('NFT not found in market');
  if (!mkt.listed) throw new Error('NFT is not listed');
  const { listingPrice: price, listingToken: token } = mkt;
  if (token === 'CC'   && ledger.ccBalance   < price) throw new Error('Insufficient CC balance');
  if (token === 'CBTC' && ledger.cbtcBalance < price) throw new Error('Insufficient CBTC balance');
  if (token === 'CC')   ledger.ccBalance   = +(ledger.ccBalance   - price).toFixed(2);
  else                  ledger.cbtcBalance = +(ledger.cbtcBalance - price).toFixed(8);
  // Buyer inherits the stake position — lock, expiry, accrued yield all transfer
  const owned = { ...mkt, owner: ledger.partyId, listed: false, listingPrice: 0 };
  ledger.myNFTs.push(owned);
  const idx = ledger.marketNFTs.findIndex(n => n.id === nftId);
  if (idx !== -1) ledger.marketNFTs.splice(idx, 1);
  addActivity('Bought', `Bought ${mkt.name} for ${price} ${token} — inherited ${mkt.lockLabel} lock position`);
  return owned;
}

export function placeBid(nftId, bidAmount, token = 'CC') {
  const mkt = ledger.marketNFTs.find(n => n.id === nftId);
  if (!mkt) throw new Error('NFT not found');
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) throw new Error('Invalid bid amount');
  if (mkt.owner === ledger.partyId) throw new Error('Cannot bid on your own NFT');
  if (bidAmount <= mkt.highBid) throw new Error('Bid must exceed current highest bid');
  if (token === 'CC'   && ledger.ccBalance   < bidAmount) throw new Error('Insufficient CC balance');
  if (token === 'CBTC' && ledger.cbtcBalance < bidAmount) throw new Error('Insufficient CBTC balance');
  mkt.highBid = bidAmount;
  addActivity('Bid', `Bid ${bidAmount} ${token} on ${mkt.name}`);
}

// ── Activity ───────────────────────────────────────────────────────────────
function addActivity(type, message) {
  ledger.activity.unshift({ type, message, time: Date.now(), txId: genContractId().slice(0, 16) });
  if (ledger.activity.length > 50) ledger.activity.pop();
}
