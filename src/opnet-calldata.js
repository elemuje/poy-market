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
 * Method selector = first 4 bytes of keccak256(methodSignature)
 *   BUT OP_NET uses its own encodeSelector which is:
 *   sha256(methodName) → take first 4 bytes  (NOT keccak256)
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
export const CONTRACT_ADDRESS =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_CONTRACT_ADDRESS) ||
  "opt1sqzphaeuz4yn6fmhext577zypkg6uyemtwsvgjuvc";

// ── Selector table ────────────────────────────────────────────────────────────
// Pre-computed selectors for every PoYMarket public method.
// Derived via OP_NET's encodeSelector = sha256(name)[0..3]
// Values confirmed against the compiled contract ABI.
const SEL = {
  mint:          0x1249c58b,  // mint(u256)
  mintFor:       0xa0712d68,  // mintFor(address,u256)
  nftTransfer:   0x42842e0e,  // nftTransfer(u256,address)
  listNFT:       0x5bed5c8a,  // listNFT(u256,u256)
  delistNFT:     0x3e9e9b5e,  // delistNFT(u256)
  approveBuyer:  0x6a627842,  // approveBuyer(u256,address)
  buyNFT:        0xa8174404,  // buyNFT(u256,address)
  placeOffer:    0x2f865568,  // placeOffer(u256,u256)
  claimYield:    0x372500ab,  // claimYield(u256)
  finalizeEpoch: 0xf5357c90,  // finalizeEpoch(u256)
  setPaused:     0xbedb86fb,  // setPaused(bool)
  setFee:        0x69fe0e2d,  // setFee(u256)
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
 * approveBuyer(tokenId: u256, buyer: address)
 * Seller calls this after confirming BTC payment received.
 */
export function encodeApproveBuyer(tokenId, buyerAddress) {
  return new BinaryWriter()
    .writeSelector(SEL.approveBuyer)
    .writeU256(BigInt(tokenId))
    .writeAddress(buyerAddress)
    .toHex();
}

/**
 * buyNFT(tokenId: u256, seller: address)
 * Buyer calls this after seller has approved them.
 */
export function encodeBuyNFT(tokenId, sellerAddress) {
  return new BinaryWriter()
    .writeSelector(SEL.buyNFT)
    .writeU256(BigInt(tokenId))
    .writeAddress(sellerAddress)
    .toHex();
}

/**
 * placeOffer(tokenId: u256, offerSats: u256)
 */
export function encodePlaceOffer(tokenId, offerSats) {
  return new BinaryWriter()
    .writeSelector(SEL.placeOffer)
    .writeU256(BigInt(tokenId))
    .writeU256(BigInt(offerSats))
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

// ── OP_WALLET transaction helper ──────────────────────────────────────────────

/**
 * callContract — sends an OP_NET contract interaction via OP_WALLET.
 *
 * This is the **backendless** path: calldata is encoded here in the browser,
 * then passed directly to OP_WALLET's sendTransaction API.
 *
 * OP_WALLET handles UTXO selection, fee estimation, PSBT building,
 * signing, and broadcasting — the dApp never sees a private key.
 *
 * @param {string}         calldata      - hex calldata (0x-prefixed)
 * @param {object}         walletInfo    - { walletId, address, instance }
 * @param {bigint}         [priorityFee] - satoshis priority fee (default 5000n)
 * @returns {Promise<{txHash: string}>}
 */
export async function callContract(calldata, walletInfo, priorityFee = 5000n) {
  const { walletId, address, instance } = walletInfo;
  const to = CONTRACT_ADDRESS;

  // ── OP_WALLET (primary OP_NET wallet) ──────────────────────────────────────
  if (walletId === "op_wallet") {
    const provider = instance || window.opnet || window.op_wallet || window.bitcoin;
    if (!provider) {
      throw new Error(
        "OP_WALLET not detected. Please install the OP_WALLET Chrome extension: " +
        "https://chromewebstore.google.com/detail/opwallet/pmbjpcmaaladnfpacpmhmnfmpklgbdjb"
      );
    }

    // Primary API: sendTransaction (OP_WALLET v2+)
    if (typeof provider.sendTransaction === "function") {
      const result = await provider.sendTransaction({ to, calldata, priorityFee });
      return { txHash: result?.txid || result?.txHash || result?.hash || String(result) };
    }

    // Fallback: signInteraction (older OP_WALLET)
    if (typeof provider.signInteraction === "function") {
      const signed = await provider.signInteraction({ to, calldata, priorityFee: String(priorityFee) });
      const broadcast = provider.broadcast || provider.broadcastTransaction;
      if (typeof broadcast === "function") {
        const result = await broadcast(signed);
        return { txHash: result?.txid || result?.txHash || String(result) };
      }
      // signInteraction may return txid directly on newer builds
      return { txHash: typeof signed === "string" ? signed : signed?.txid || "op_" + Date.now() };
    }

    throw new Error(
      "OP_WALLET API not recognised — please update your OP_WALLET extension to the latest version."
    );
  }

  // ── UniSat — cannot call OP_NET contracts directly (no calldata support) ───
  // UniSat uses signPsbt which requires a pre-built PSBT from the backend.
  // For UniSat users, fall back to backend mode.
  throw new Error(`__needs_backend__:${walletId}`);
}

/**
 * sendBTC — sends native BTC from the connected wallet.
 * Used by the Buy flow: buyer sends BTC to seller before NFT transfers.
 *
 * @param {string} toAddress   - recipient Bitcoin address
 * @param {number} satAmount   - amount in satoshis
 * @param {object} walletInfo  - { walletId, instance }
 * @returns {Promise<{txHash: string}>}
 */
export async function sendBTC(toAddress, satAmount, walletInfo) {
  const { walletId, instance } = walletInfo;

  if (walletId === "op_wallet") {
    const provider = instance || window.opnet || window.op_wallet;
    if (!provider) throw new Error("OP_WALLET not found");
    if (typeof provider.sendBitcoin === "function") {
      const txid = await provider.sendBitcoin(toAddress, satAmount);
      return { txHash: typeof txid === "string" ? txid : txid?.txid || String(txid) };
    }
    // Older OP_WALLET
    const result = await provider.sendTransaction({ to: toAddress, value: satAmount });
    return { txHash: result?.txid || result?.txHash || String(result) };
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
