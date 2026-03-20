# Canton PoY Market

**Stake CC · Earn CBTC · Trade Yield NFTs on Canton Network**

A demo/showcase platform for yield-based NFT staking on Canton Mainnet.
Built with React + Vite + Canton Loop SDK (`@fivenorth/loop-sdk`).

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5 |
| Wallet | Canton Loop (`@fivenorth/loop-sdk`) |
| Network | Canton Mainnet |
| Stake token | CC (Canton Coin / Amulet) |
| Yield token | CBTC (simulated for demo) |
| Contracts | Simulated (Daml model — real node needed for production) |

---

## Quick Start

```bash
npm install        # or: bun install
cp .env.example .env.local
npm run dev        # http://localhost:5173
```

---

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Import at [vercel.com/new](https://vercel.com/new)
3. Framework: **Vite** (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy** ✅

No environment variables required for demo mode.

---

## Project Structure

```
src/
├── App.jsx           — Full UI (marketplace, stake, my NFTs, activity)
├── canton-store.js   — Simulated Canton ledger state + operations
└── main.jsx          — React entry point
```

---

## Canton Loop Wallet Integration

The real Loop SDK is integrated:

```js
import { loop } from '@fivenorth/loop-sdk';

loop.init({
  appName: 'PoY Market',
  network: 'mainnet',
  onAccept: (provider) => { /* use provider */ },
  onReject: () => { /* handle rejection */ },
});

loop.connect(); // Opens QR code modal
```

On connect, the SDK returns a `provider` with:
- `provider.party_id` — Canton Party ID
- `provider.email` — user email
- `provider.getHolding()` — real CC/token holdings

---

## Moving to Production (Checklist)

When you have a Canton Validator Node:

- [ ] Replace `ledger.ccBalance` with `provider.getHolding()` results
- [ ] Replace `stakeCC()` with `provider.submitTransaction()` to real Daml staking contract
- [ ] Replace `mintYieldNFT()` with real DAR contract exercise
- [ ] Replace `claimYield()` with real Daml yield claim
- [ ] Replace `marketNFTs` with `provider.getActiveContracts()` results
- [ ] Get BitSafe CBTC credential for real CBTC integration

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_CANTON_NETWORK` | `mainnet` | Canton network to connect |
| `VITE_APP_NAME` | `PoY Market` | App name shown in Loop wallet |
| `VITE_LOOP_WALLET_URL` | _(SDK default)_ | Override Loop wallet URL |
| `VITE_LOOP_API_URL` | _(SDK default)_ | Override Loop API URL |

---

## Dependencies Needed From You (Production)

| What | Where to get |
|---|---|
| Canton Validator Node URL | Blockdaemon, Digital Asset, or self-hosted |
| Daml staking contract (`.dar`) | Write in Daml SDK or commission |
| CBTC integration | BitSafe institutional partnership |
| CC instrument ID | From your validator node's Splice configuration |

---

## License

MIT — Demo/Showcase only. Not financial advice.
