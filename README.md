# PoYMarket Backend — v2

The contract address lives **only** on this server. The frontend never sees it — it calls your API, which proxies everything.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env: set PORT, OPNET_RPC, FRONTEND_ORIGIN, ADMIN_KEY, CONTRACT_ADDRESS
node server.js
```

Requires **Node.js 18+** (built-in `fetch` — no extra deps needed beyond express + cors).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `CONTRACT_ADDRESS` | v7 testnet address | PoYMarket contract — never exposed to browser |
| `OPNET_RPC` | `https://api.opnet.org` | OP_NET RPC endpoint |
| `NETWORK` | `testnet` | `testnet` or `mainnet` |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `ADMIN_KEY` | — | Secret key for `/api/encode/finalize` |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET  | `/api/stats` | Total supply, epoch, staked, fee, paused |
| GET  | `/api/nft/:tokenId` | On-chain data for one NFT |
| POST | `/api/encode/mint` | `{ stakedAmount }` |
| POST | `/api/encode/list` | `{ tokenId, priceSats }` |
| POST | `/api/encode/delist` | `{ tokenId }` |
| POST | `/api/encode/buy` | `{ tokenId, priceSats }` → also returns `value` for tx.value |
| POST | `/api/encode/offer` | `{ tokenId, offerSats }` → also returns `value` for tx.value |
| POST | `/api/encode/claim` | `{ tokenId }` |
| POST | `/api/encode/transfer` | `{ tokenId, to }` |
| POST | `/api/encode/finalize` | `{ adminKey, epochRewardUnits }` (owner only) |
| GET  | `/health` | Server health check |

## Contract ABI — Method Selectors (v2 CORRECTED)

> ⚠️ All selectors are `sha256(methodName)[0:4]` — OP_NET standard.
> NOT `keccak256(fullSignature)` (that is Ethereum's ABI encoding, not OP_NET).

| Method | Selector |
|---|---|
| `mint` | `0xdc6f17bb` |
| `mintFor` | `0xd20a45b1` |
| `nftTransfer` | `0x789e8d32` |
| `listNFT` | `0xbddede2e` |
| `delistNFT` | `0xc326f375` |
| `buyNFT` | `0x75797eb3` |
| `placeOffer` | `0xe3a30a9c` |
| `claimYield` | `0x652e4672` |
| `finalizeEpoch` | `0x6372c535` |
| `setPaused` | `0xe2f49a0c` |
| `setFee` | `0x76d218c1` |
| `ownerOfToken` | `0x986666bf` |
| `getListingPrice` | `0x0aba4213` |
| `getPendingYield` | `0xed2d8a6d` |
| `getTotalSupply` | `0x8e631e9c` |
| `getCurrentEpoch` | `0xe4b45917` |
| `getTotalStaked` | `0x8968be05` |
| `getFeeBP` | `0x9483fde8` |
| `isPaused` | `0xe3f322e1` |

## buyNFT & placeOffer — Payable Methods

These two methods send BTC as `tx.value`, not in calldata:

- `buyNFT(tokenId)` — only `tokenId` in calldata; `priceSats` sent as `tx.value`
- `placeOffer(tokenId)` — only `tokenId` in calldata; `offerSats` sent as `tx.value`

The `/encode/buy` and `/encode/offer` responses include `value` and `callValue` fields for this purpose.

## Deployment

Deploy to any Node.js host (Railway, Render, Fly.io, VPS).
Set `CONTRACT_ADDRESS` in your environment — it never leaves your server.
