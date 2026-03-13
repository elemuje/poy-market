# PoY Market

**Bitcoin-Native Yield NFT Marketplace on OP_NET**

Trade yield-bearing NFTs backed by real Bitcoin stakes. The first on-chain NFT marketplace built for the OP_NET protocol.

---

## Stack

- **Frontend**: React 18 + Vite 5
- **Styling**: Inline CSS-in-JS (zero dependencies)
- **Fonts**: Outfit + JetBrains Mono (Google Fonts)
- **Wallets**: OP_WALLET, UniSat, OKX Wallet, Leather
- **Protocol**: OP_NET (Bitcoin L2)
- **Contract**: PoYMarket v7 (AssemblyScript / WASM)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```
poy-market/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          # Full marketplace UI
│   └── main.jsx         # React entry point
├── index.html           # HTML shell
├── vite.config.js       # Vite configuration
├── vercel.json          # Vercel SPA routing
├── .gitignore
└── package.json
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Vite — click **Deploy**

Build settings (auto-detected):
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Manual

```bash
npm run build
# Upload dist/ to any static host (Netlify, Cloudflare Pages, S3, etc.)
```

---

## Environment Variables

No environment variables required for the frontend — contract calls route through the backend API server.

To connect the backend, add to `.env.local`:

```env
VITE_API_BASE=https://your-backend.vercel.app
```

Then in `src/App.jsx`, replace mock data fetches with:

```js
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001'
```

---

## Contract

- **Protocol**: OP_NET (Bitcoin)
- **Contract**: `PoYMarket.ts` (AssemblyScript)
- **Source**: [poy-market-contract/](../poy-market-contract/)
- **Address**: Set in backend `server.js` (never exposed to frontend)

---

## Community

- Twitter/X: [@PoYMarket](https://x.com/PoYMarket)
- Discord: [discord.gg/poymarket](https://discord.gg/poymarket)
- Telegram: [t.me/poymarket](https://t.me/poymarket)
- GitHub: [github.com/poy-protocol](https://github.com/poy-protocol)

---

## License

MIT

---

## Contract Calldata Encoder

`src/opnet-calldata.js` — pure-JS OP_NET calldata encoder. No backend needed for OP_WALLET users.

- Selectors: `sha256(methodName)[0:4]` (OP_NET standard)
- Encodes all 8 write methods + `callValue` for payable methods
- `buyNFT` and `placeOffer` send BTC as `tx.value` via `callValue` in `signInteraction`

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_CONTRACT_ADDRESS` | PoYMarket contract address (falls back to v7 testnet) |
| `VITE_API_BASE` | Backend URL for UniSat/OKX/Leather PSBT path (optional for OP_WALLET) |

Set these in `.env.local` or Vercel dashboard.
