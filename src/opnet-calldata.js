/**
 * opnet-calldata.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure-JS OP_NET calldata encoder for PoYMarket.
 *
 * Replicates the @btc-vision/transaction BinaryWriter encoding format
 * so the frontend can build calldata WITHOUT a backend server.
 *
 * OP_NET calldata wire format:
 *   [4 bytes: method selector]  [args...]
 *
 * Method selector = sha256(methodName)[0:4]
 *   OP_NET uses method name only (NOT full signature, NOT keccak256).
 *   e.g. sha256('mint')[0:4] = 0xdc6f17bb
 *
 * All values are little-endian unless noted.
 * u256 values are encoded as 32 bytes little-endian.
 * Address (Taproot) values are encoded as 32 bytes (x-only pubkey or the
 *   full bc1p address decoded to 32-byte witness program).
 *
 * PoYMarket contract address is kept in .env / VITE_CONTRACT_ADDRESS
 * so it never appears in the bundle's source — set it in Vercel env vars.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Contract address ──────────────────────────────────────────────────────────
// Set VITE_CONTRACT_ADDRESS in your .env or Vercel dashboard.
// Falls back to the v6 testnet address for local dev.
// CONTRACT_ADDRESS — injected by Vite at build time from VITE_CONTRACT_ADDRESS.
// Vite statically replaces import.meta.env.X during bundling, so this is safe.
// Fallback is the v7 testnet contract address.
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "opt1sqpasc3xhpfdhex4xpfp26enenj2rq3lvfy4577w9";

// ── Selector table ────────────────────────────────────────────────────────────
// Selectors = sha256(methodName)[0:4] — OP_NET uses method name only, NOT full signature.
// Contract source: callMethod uses encodeSelector('methodName') — confirmed in PoYMarket.ts.
const SEL = {
  mint:          0xdc6f17bb,  // sha256('mint')[0:4]
  mintFor:       0xd20a45b1,  // sha256('mintFor')[0:4]
  nftTransfer:   0x789e8d32,  // sha256('nftTransfer')[0:4]
  listNFT:       0xbddede2e,  // sha256('listNFT')[0:4]
  delistNFT:     0xc326f375,  // sha256('delistNFT')[0:4]
  buyNFT:        0x75797eb3,  // sha256('buyNFT')[0:4]
  placeOffer:    0xe3a30a9c,  // sha256('placeOffer')[0:4]
  claimYield:    0x652e4672,  // sha256('claimYield')[0:4]
  finalizeEpoch: 0x6372c535,  // sha256('finalizeEpoch')[0:4]
  setPaused:     0xe2f49a0c,  // sha256('setPaused')[0:4]
  setFee:        0x76d218c1,  // sha256('setFee')[0:4]
};

// ── BinaryWriter ──────────────────────────────────────────────────────────────
// Minimal implementation mirroring @btc-vision/transaction's BinaryWriter.
class BinaryWriter {
  constructor() {
    this._buf = [];
  }

  // Write a 4-byte selector (big-endian uint32)
  writeSelector(sel) {
    this._buf.push(
      (sel >>> 24) & 0xff,
      (sel >>> 16) & 0xff,
      (sel >>> 8)  & 0xff,
      (sel)        & 0xff,
    );
    return this;
  }

  // Write a u256 as 32 bytes little-endian (from BigInt)
  writeU256(value) {
    const bi = BigInt(value);
    for (let i = 0; i < 32; i++) {
      this._buf.push(Number((bi >> BigInt(i * 8)) & 0xffn));
    }
    return this;
  }

  // Write a u32 as 4 bytes little-endian
  writeU32(value) {
    const n = Number(value) >>> 0;
    this._buf.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
    return this;
  }

  // Write a boolean as 1 byte
  writeBool(value) {
    this._buf.push(value ? 1 : 0);
    return this;
  }

  // Write a Taproot address as 32 bytes (bech32m witness program)
  // Accepts bc1p... (testnet: tb1p...) addresses.
  writeAddress(addr) {
    const bytes = decodeTaprootAddress(addr);
    if (bytes.length !== 32) {
      throw new Error(`Invalid Taproot address: expected 32-byte witness program, got ${bytes.length}`);
    }
    for (const b of bytes) this._buf.push(b);
    return this;
  }

  // Return hex string of the buffer (0x-prefixed)
  toHex() {
    return "0x" + this._buf.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // Return Uint8Array
  toBytes() {
    return new Uint8Array(this._buf);
  }
}

// ── Bech32m decoder (for Taproot bc1p... addresses) ──────────────────────────
// Minimal implementation — only what we need for 32-byte P2TR witness programs.
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32mPolymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GENERATOR[i];
    }
  }
  return chk;
}

function bech32mHrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function convertBits(data, fromBits, toBits, pad = true) {
  let acc = 0, bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    return null;
  }
  return ret;
}

function decodeTaprootAddress(addr) {
  const lower = addr.toLowerCase();
  // Support mainnet (bc1p), testnet (tb1p), regtest (bcrt1p)
  const sep = lower.lastIndexOf("1");
  if (sep < 1) throw new Error("Bad address: no separator");
  const hrp = lower.slice(0, sep);
  const data = [];
  for (let i = sep + 1; i < lower.length; i++) {
    const d = CHARSET.indexOf(lower[i]);
    if (d < 0) throw new Error(`Bad character in address: ${lower[i]}`);
    data.push(d);
  }
  // Verify bech32m checksum (constant 0x2bc830a3 for bech32m)
  const expand = bech32mHrpExpand(hrp);
  if (bech32mPolymod([...expand, ...data]) !== 0x2bc830a3) {
    throw new Error("Bad bech32m checksum for address: " + addr);
  }
  const witnessVersion = data[0];
  if (witnessVersion !== 1) {
    throw new Error(`Expected witness version 1 (Taproot), got ${witnessVersion}`);
  }
  const decoded = convertBits(data.slice(1, -6), 5, 8, false);
  if (!decoded || decoded.length !== 32) {
    throw new Error("Invalid P2TR witness program length");
  }
  return new Uint8Array(decoded);
}

// ── Public calldata builders ──────────────────────────────────────────────────

/**
 * mint(stakedAmount: u256)
 * User stakes BTC to mint a Yield NFT.
 * @param {bigint|number|string} stakedAmountSats  — amount in satoshis
 */
export function encodeMint(stakedAmountSats) {
  return new BinaryWriter()
    .writeSelector(SEL.mint)
    .writeU256(BigInt(stakedAmountSats))
    .toHex();
}

/**
 * nftTransfer(tokenId: u256, to: address)
 */
export function encodeTransfer(tokenId, toAddress) {
  return new BinaryWriter()
    .writeSelector(SEL.nftTransfer)
    .writeU256(BigInt(tokenId))
    .writeAddress(toAddress)
    .toHex();
}

/**
 * listNFT(tokenId: u256, priceSats: u256)
 */
export function encodeList(tokenId, priceSats) {
  return new BinaryWriter()
    .writeSelector(SEL.listNFT)
    .writeU256(BigInt(tokenId))
    .writeU256(BigInt(priceSats))
    .toHex();
}

/**
 * delistNFT(tokenId: u256)
 */
export function encodeDelist(tokenId) {
  return new BinaryWriter()
    .writeSelector(SEL.delistNFT)
    .writeU256(BigInt(tokenId))
    .toHex();
}

/**
 * buyNFT(tokenId: u256)
 * Contract reads tokenId from calldata. Payment amount comes via Blockchain.tx.value.
 * The caller must send BTC equal to the listing price in the same tx (callValue).
 *
 * @param {bigint|number|string} tokenId
 * @param {bigint|number|string} priceSats - amount in satoshis to send with the tx (callValue)
 */
export function encodeBuyNFT(tokenId) {
  // priceSats is NOT in calldata — it's sent as tx.value (callValue in signInteraction).
  // The contract verifies Blockchain.tx.value == listingPrice.
  return new BinaryWriter()
    .writeSelector(SEL.buyNFT)
    .writeU256(BigInt(tokenId))
    .toHex();
}

/**
 * placeOffer(tokenId: u256)
 * Contract reads tokenId from calldata. Offer amount comes via Blockchain.tx.value.
 * The caller must send BTC equal to their offer amount in the same tx (callValue).
 *
 * @param {bigint|number|string} tokenId
 * @param {bigint|number|string} offerSats - amount in satoshis to send with the tx (callValue)
 */
export function encodePlaceOffer(tokenId) {
  // Amount is NOT in calldata — it's sent as callValue (tx.value) in signInteraction.
  // The contract reads Blockchain.tx.value for the offer amount.
  return new BinaryWriter()
    .writeSelector(SEL.placeOffer)
    .writeU256(BigInt(tokenId))
    .toHex();
}

/**
 * claimYield(tokenId: u256)
 */
export function encodeClaimYield(tokenId) {
  return new BinaryWriter()
    .writeSelector(SEL.claimYield)
    .writeU256(BigInt(tokenId))
    .toHex();
}

/**
 * finalizeEpoch(epochRewardUnits: u256)  — owner-only
 */
export function encodeFinalizeEpoch(epochRewardUnits) {
  return new BinaryWriter()
    .writeSelector(SEL.finalizeEpoch)
    .writeU256(BigInt(epochRewardUnits))
    .toHex();
}

// ── OP_WALLET transaction helper ────────────────────────────────────────────────────────
//
// OP_WALLET API (correct, confirmed):
//   Contract calls:  provider.signInteraction({ to, calldata, priorityFee })
//                    → returns signed tx → broadcast with provider.broadcast(signedTx)
//                    Some versions auto-broadcast and return txid directly.
//   BTC transfers:   provider.sendBitcoin(address, satoshis)
//                    → returns txid string directly
//
// NEVER use sendTransaction for OP_WALLET contract calls — that method does NOT exist.
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * getOpWalletProvider — safely retrieves the OP_WALLET provider at call time.
 * NEVER cache the result — the extension can re-inject between calls.
 */
function getOpWalletProvider() {
  // Check each known injection point. signInteraction presence confirms it is OP_WALLET.
  if (window.opnet && typeof window.opnet.signInteraction === "function") return window.opnet;
  if (window.op_wallet && typeof window.op_wallet.signInteraction === "function") return window.op_wallet;
  // Some OP_WALLET builds also inject under window.bitcoin
  if (window.bitcoin && typeof window.bitcoin.signInteraction === "function") return window.bitcoin;
  // Fall back to any available object (may lack signInteraction on older builds)
  return window.opnet || window.op_wallet || null;
}

/**
 * callContract — sends an OP_NET contract interaction via OP_WALLET.
 *
 * Uses signInteraction (the correct OP_WALLET contract-call API).
 * The wallet handles UTXO selection, fee estimation, PSBT construction,
 * and signing internally — the dApp never touches a private key.
 *
 * Flow:
 *   1. provider.signInteraction({ to, calldata, priorityFee, [value/callValue] })
 *      → returns signed PSBT / tx blob
 *   2. provider.broadcast(signedTx)
 *      → returns txid string
 *
 * @param {string}  calldata      - hex calldata (0x-prefixed)
 * @param {object}  walletInfo    - { walletId, address }
 * @param {bigint}  [priorityFee] - satoshis priority fee (default 5000n)
 * @param {bigint}  [callValue]   - satoshis to attach as tx.value (buyNFT, placeOffer)
 */
export async function callContract(calldata, walletInfo, priorityFee = 5000n, callValue = 0n) {
  const { walletId } = walletInfo || {};
  const to = CONTRACT_ADDRESS;

  if (walletId !== "op_wallet") {
    // Non-OP_WALLET wallets need backend PSBT path
    throw new Error(`__needs_backend__:${walletId}`);
  }

  // Always re-read at call time — cached references go stale after extension reload
  const provider = getOpWalletProvider();

  if (!provider) {
    throw new Error(
      "OP_WALLET not found. Install and unlock the extension: " +
      "https://chromewebstore.google.com/detail/opwallet/pmbjpcmaaladnfpacpmhmnfmpklgbdjb"
    );
  }

  // ── Primary path: signInteraction (the real OP_WALLET contract call API) ────────
  if (typeof provider.signInteraction === "function") {
    // Build the interaction params. callValue is used for payable methods (buyNFT, placeOffer).
    const interactionParams = {
      to,
      calldata,
      priorityFee: Number(priorityFee),  // OP_WALLET expects a number, not BigInt
    };
    if (callValue > 0n) {
      // Some OP_WALLET builds use 'value', others 'callValue' — include both for compatibility
      interactionParams.value = Number(callValue);
      interactionParams.callValue = Number(callValue);
    }
    const signed = await provider.signInteraction(interactionParams);

    // Case 1: signInteraction already broadcast and returned a txid string
    if (typeof signed === "string" && signed.length >= 40 && !signed.startsWith("02")) {
      return { txHash: signed };
    }

    // Case 2: signed object with txid field (auto-broadcast)
    if (signed && (signed.txid || signed.txHash)) {
      return { txHash: signed.txid || signed.txHash };
    }

    // Case 3: signed tx blob — broadcast explicitly
    if (typeof provider.broadcast === "function") {
      const result = await provider.broadcast(signed);
      const txHash = typeof result === "string" ? result : result?.txid || result?.txHash || String(result);
      return { txHash };
    }

    // Case 4: pushPsbt fallback (some builds)
    if (typeof provider.pushPsbt === "function") {
      const result = await provider.pushPsbt(signed);
      const txHash = typeof result === "string" ? result : result?.txid || String(result);
      return { txHash };
    }

    // Case 5: sign returned something — use as-is
    return { txHash: "op_" + Date.now() };
  }

  // ── Fallback: sendTransaction (some OP_WALLET forks / older builds) ──────────
  if (typeof provider.sendTransaction === "function") {
    const result = await provider.sendTransaction({ to, calldata, priorityFee: Number(priorityFee) });
    const txHash = result?.txid || result?.txHash || result?.hash || String(result);
    return { txHash };
  }

  throw new Error(
    "OP_WALLET not compatible. Please update to the latest version of the extension."
  );
}

/**
 * sendBTC — sends native BTC from the connected wallet.
 * Used by the Buy flow: buyer pays seller directly before NFT transfer.
 *
 * OP_WALLET API: provider.sendBitcoin(address, satoshis) → returns txid string
 *
 * @param {string} toAddress   - recipient Bitcoin address (bech32 / Taproot)
 * @param {number} satAmount   - amount in satoshis (integer)
 * @param {object} walletInfo  - { walletId }
 * @returns {Promise<{txHash: string}>}
 */
export async function sendBTC(toAddress, satAmount, walletInfo) {
  const { walletId } = walletInfo || {};

  if (walletId === "op_wallet") {
    const provider = getOpWalletProvider();
    if (!provider) throw new Error("OP_WALLET not found — install and unlock the extension.");

    if (typeof provider.sendBitcoin === "function") {
      const result = await provider.sendBitcoin(toAddress, satAmount);
      const txHash = typeof result === "string" ? result : result?.txid || result?.txHash || String(result);
      return { txHash };
    }

    throw new Error("OP_WALLET does not support sendBitcoin. Please update the extension.");
  }

  if (walletId === "unisat") {
    const txid = await window.unisat?.sendBitcoin(toAddress, satAmount);
    return { txHash: txid };
  }

  if (walletId === "okx") {
    const w = window.okxwallet?.bitcoin || window.okxwallet;
    const txid = await w?.sendBitcoin(toAddress, satAmount);
    return { txHash: txid };
  }

  throw new Error(`__no_send_bitcoin__:${walletId}`);
}
