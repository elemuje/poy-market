import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/*
 ██████╗  ██████╗ ██╗   ██╗    ███╗   ███╗ █████╗ ██████╗ ██╗  ██╗███████╗████████╗
 ██╔══██╗██╔═══██╗╚██╗ ██╔╝    ████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔════╝╚══██╔══╝
 ██████╔╝██║   ██║ ╚████╔╝     ██╔████╔██║███████║██████╔╝█████╔╝ █████╗     ██║
 ██╔═══╝ ██║   ██║  ╚██╔╝      ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██╔══╝     ██║
 ██║     ╚██████╔╝   ██║       ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗███████╗   ██║
 ╚═╝      ╚═════╝    ╚═╝       ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝
 Bitcoin-Native Yield NFT Marketplace — Professional Edition
*/

/* ── Google Fonts ────────────────────────────────────────────────────────── */
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;700&display=swap');`;

/* ── Design Tokens ───────────────────────────────────────────────────────── */
const C = {
  primary:   "#FF9F1C",
  secondary: "#7B2EDA",
  bg:        "#08080F",
  surface:   "#0F1018",
  card:      "#141520",
  cardHov:   "#191B2A",
  border:    "#FFFFFF0A",
  borderMid: "#FFFFFF16",
  text:      "#F0ECF8",
  muted:     "#5A5870",
  dim:       "#3A3858",
  success:   "#00D68F",
  danger:    "#FF3D71",
  accent:    "#FFB347",
  info:      "#4D9FFF",
  warning:   "#FFD600",
};

const RARITY = {
  Legendary: { color: "#FF9F1C", glow: "#FF9F1C44", bg: "#FF9F1C0D", rank: 1, symbol: "✦" },
  Epic:      { color: "#9B5CF6", glow: "#9B5CF644", bg: "#9B5CF60D", rank: 2, symbol: "◆" },
  Rare:      { color: "#3B82F6", glow: "#3B82F644", bg: "#3B82F60D", rank: 3, symbol: "▲" },
  Common:    { color: "#64748B", glow: "#64748B30", bg: "#FFFFFF07", rank: 4, symbol: "●" },
};

/* ── Wallet Definitions ──────────────────────────────────────────────────── */
const WALLETS = [
  {
    id:      "op_wallet",
    name:    "OP_WALLET",
    label:   "OP_WALLET",
    tagline: "Native · MLDSA · Quantum-safe",
    icon:    "⚡",
    color:   "#FF9F1C",
    badge:   "RECOMMENDED",
    detect:  () => typeof window !== "undefined" && !!(window.opnet || window.op_wallet),
    connect: async () => {
      const w = window.opnet || window.op_wallet;
      if (!w) throw new Error("OP_WALLET not installed");
      const accounts = await w.requestAccounts();
      const pubkey   = await w.getPublicKey();
      const chain    = await w.getChain?.() || { network: "mainnet" };
      return { address: accounts[0], publicKey: pubkey, network: chain.network || "mainnet" };
    },
  },
  {
    id:      "unisat",
    name:    "UniSat",
    label:   "UniSat",
    tagline: "Popular · Wide support",
    icon:    "🟠",
    color:   "#F7931A",
    badge:   null,
    detect:  () => typeof window !== "undefined" && !!window.unisat,
    connect: async () => {
      if (!window.unisat) throw new Error("UniSat not installed");
      const accounts = await window.unisat.requestAccounts();
      const pubkey   = await window.unisat.getPublicKey();
      const network  = await window.unisat.getNetwork();
      return { address: accounts[0], publicKey: pubkey, network };
    },
  },
  {
    id:      "okx",
    name:    "OKX Wallet",
    label:   "OKX",
    tagline: "Multi-chain · OKX ecosystem",
    icon:    "⬤",
    color:   "#FFFFFF",
    badge:   null,
    detect:  () => typeof window !== "undefined" && !!(window.okxwallet?.bitcoin || window.okxwallet),
    connect: async () => {
      const w = window.okxwallet?.bitcoin || window.okxwallet;
      if (!w) throw new Error("OKX Wallet not installed");
      const res      = await w.connect();
      const address  = res.address || (Array.isArray(res) ? res[0] : "");
      const pubkey   = res.publicKey || "";
      return { address, publicKey: pubkey, network: "mainnet" };
    },
  },
  {
    id:      "leather",
    name:    "Leather",
    label:   "Leather",
    tagline: "Stacks · Bitcoin",
    icon:    "🟫",
    color:   "#C4A96B",
    badge:   null,
    detect:  () => typeof window !== "undefined" && !!(window.LeatherProvider || window.HiroWalletProvider),
    connect: async () => {
      const w = window.LeatherProvider || window.HiroWalletProvider;
      if (!w) throw new Error("Leather not installed");
      const res = await w.request("getAddresses");
      const btc = res?.result?.addresses?.find(a => a.type === "p2wpkh" || a.type === "p2tr");
      return { address: btc?.address || "", publicKey: btc?.publicKey || "", network: "mainnet" };
    },
  },
];

/* ── NFT Dataset ─────────────────────────────────────────────────────────── */
const NFTS = [
  { id:1,  name:"Epoch Genesis",   num:"001", rarity:"Legendary", price:0.142, lastSale:0.130, epoch:900,  staked:50000, yield:0.211, owner:"bc1q...f8a2", creator:"SatoshiVault",  listed:true,  auction:true,  auctionEnd:Date.now()+7200000,   highBid:0.138, bids:14, likes:312, views:4821, img:"⚡", traits:[{k:"Power",v:"MAX"},{k:"Era",v:"Genesis"},{k:"Score",v:"99.2"}] },
  { id:2,  name:"Void Miner",      num:"044", rarity:"Epic",      price:0.058, lastSale:0.051, epoch:912,  staked:22000, yield:0.087, owner:"bc1q...x9f2", creator:"NullSatoshi",   listed:true,  auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:189, views:2103, img:"🌑", traits:[{k:"Element",v:"Dark"},{k:"Depth",v:"Void"},{k:"Score",v:"87.1"}] },
  { id:3,  name:"Citrus Yield",    num:"177", rarity:"Rare",      price:0.021, lastSale:0.018, epoch:918,  staked:9000,  yield:0.034, owner:"bc1q...x9f2", creator:"OrangePill",    listed:true,  auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:94,  views:1240, img:"🍊", traits:[{k:"Element",v:"Solar"},{k:"Flavor",v:"Citrus"},{k:"Score",v:"71.4"}] },
  { id:4,  name:"Block Sovereign", num:"002", rarity:"Legendary", price:0.198, lastSale:0.174, epoch:895,  staked:78000, yield:0.312, owner:"bc1q...p3k1", creator:"SatoshiVault",  listed:true,  auction:true,  auctionEnd:Date.now()+3600000,   highBid:0.191, bids:22, likes:441, views:6200, img:"👑", traits:[{k:"Power",v:"APEX"},{k:"Era",v:"Genesis"},{k:"Score",v:"98.7"}] },
  { id:5,  name:"Epoch Specter",   num:"309", rarity:"Epic",      price:0.044, lastSale:0.040, epoch:921,  staked:18000, yield:0.069, owner:"bc1q...x9f2", creator:"CryptoShade",   listed:false, auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:67,  views:890,  img:"👁",  traits:[{k:"Vision",v:"Omniscient"},{k:"Tier",v:"Specter"},{k:"Score",v:"82.3"}] },
  { id:6,  name:"Hash Pilgrim",    num:"088", rarity:"Rare",      price:0.016, lastSale:0.014, epoch:924,  staked:7200,  yield:0.028, owner:"bc1q...mn2z", creator:"OrangePill",    listed:true,  auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:52,  views:710,  img:"🌊", traits:[{k:"Element",v:"Water"},{k:"Path",v:"Pilgrim"},{k:"Score",v:"68.9"}] },
  { id:7,  name:"Neon Stake",      num:"521", rarity:"Common",    price:0.006, lastSale:0.005, epoch:926,  staked:1800,  yield:0.007, owner:"bc1q...x9f2", creator:"PlebMiner",     listed:false, auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:14,  views:201,  img:"💎", traits:[{k:"Shine",v:"Neon"},{k:"Class",v:"Stake"},{k:"Score",v:"34.1"}] },
  { id:8,  name:"Satoshi Proof",   num:"003", rarity:"Legendary", price:0.254, lastSale:0.221, epoch:888,  staked:95000, yield:0.431, owner:"bc1q...qr9x", creator:"SatoshiVault",  listed:true,  auction:true,  auctionEnd:Date.now()+86400000,  highBid:0.248, bids:31, likes:599, views:8910, img:"₿",  traits:[{k:"Power",v:"DIVINE"},{k:"Era",v:"Pre-Genesis"},{k:"Score",v:"99.9"}] },
  { id:9,  name:"Ultra Epoch",     num:"614", rarity:"Epic",      price:0.039, lastSale:0.035, epoch:922,  staked:15000, yield:0.058, owner:"bc1q...ab4f", creator:"NullSatoshi",   listed:true,  auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:78,  views:1044, img:"⬡",  traits:[{k:"Geometry",v:"Hex"},{k:"Tier",v:"Ultra"},{k:"Score",v:"80.5"}] },
  { id:10, name:"Dust Pilgrim",    num:"802", rarity:"Common",    price:0.004, lastSale:0.004, epoch:927,  staked:800,   yield:0.003, owner:"bc1q...x9f2", creator:"PlebMiner",     listed:false, auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:8,   views:98,   img:"✦",  traits:[{k:"Dust",v:"True"},{k:"Class",v:"Pilgrim"},{k:"Score",v:"12.8"}] },
  { id:11, name:"Proof Phantom",   num:"191", rarity:"Rare",      price:0.019, lastSale:0.016, epoch:920,  staked:8400,  yield:0.031, owner:"bc1q...zz0p", creator:"CryptoShade",   listed:true,  auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:103, views:1389, img:"🔮", traits:[{k:"Aura",v:"Phantom"},{k:"Proof",v:"Verified"},{k:"Score",v:"73.2"}] },
  { id:12, name:"Epoch Flame",     num:"057", rarity:"Epic",      price:0.062, lastSale:0.057, epoch:910,  staked:24000, yield:0.096, owner:"bc1q...x9f2", creator:"OrangePill",    listed:false, auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:215, views:2804, img:"🔥", traits:[{k:"Element",v:"Fire"},{k:"Epoch",v:"Prime"},{k:"Score",v:"85.6"}] },
  { id:13, name:"Crystal Epoch",   num:"033", rarity:"Rare",      price:0.024, lastSale:0.021, epoch:916,  staked:10500, yield:0.041, owner:"bc1q...kk7m", creator:"CryptoShade",   listed:true,  auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:61,  views:820,  img:"🔷", traits:[{k:"Material",v:"Crystal"},{k:"Clarity",v:"Perfect"},{k:"Score",v:"74.9"}] },
  { id:14, name:"Solar Miner",     num:"129", rarity:"Epic",      price:0.047, lastSale:0.043, epoch:919,  staked:19500, yield:0.076, owner:"bc1q...lv9n", creator:"SatoshiVault",  listed:true,  auction:true,  auctionEnd:Date.now()+14400000,  highBid:0.044, bids:7,  likes:143, views:1932, img:"☀",  traits:[{k:"Energy",v:"Solar"},{k:"Output",v:"High"},{k:"Score",v:"83.7"}] },
  { id:15, name:"Storm Protocol",  num:"008", rarity:"Legendary", price:0.174, lastSale:0.160, epoch:891,  staked:65000, yield:0.271, owner:"bc1q...mm3p", creator:"NullSatoshi",   listed:true,  auction:false, auctionEnd:null,                  highBid:null,  bids:0,  likes:387, views:5600, img:"⚡", traits:[{k:"Power",v:"STORM"},{k:"Protocol",v:"Genesis"},{k:"Score",v:"97.4"}] },
];

const CREATORS = {
  "SatoshiVault": { name:"SatoshiVault",  verified:true,  avatar:"₿",  volume:"4.2 BTC", sales:28, color:C.primary   },
  "NullSatoshi":  { name:"NullSatoshi",   verified:true,  avatar:"🌑", volume:"1.8 BTC", sales:14, color:"#9B5CF6"   },
  "OrangePill":   { name:"OrangePill",    verified:true,  avatar:"🍊", volume:"0.9 BTC", sales:19, color:C.accent    },
  "CryptoShade":  { name:"CryptoShade",   verified:false, avatar:"👁", volume:"0.6 BTC", sales:11, color:"#9B5CF6"   },
  "PlebMiner":    { name:"PlebMiner",     verified:false, avatar:"⛏", volume:"0.1 BTC", sales:7,  color:C.muted     },
};

const TICKER_ITEMS = [
  { type:"SALE",  nft:"Epoch Genesis #001",   price:"0.1300", color:C.success  },
  { type:"BID",   nft:"Satoshi Proof #003",   price:"0.2480", color:C.primary  },
  { type:"MINT",  nft:"Dust Pilgrim #802",    price:"—",      color:C.info     },
  { type:"LIST",  nft:"Crystal Epoch #033",   price:"0.0240", color:C.accent   },
  { type:"SALE",  nft:"Hash Pilgrim #088",    price:"0.0140", color:C.success  },
  { type:"OFFER", nft:"Void Miner #044",      price:"0.0520", color:"#9B5CF6"  },
  { type:"BID",   nft:"Solar Miner #129",     price:"0.0440", color:C.primary  },
  { type:"SALE",  nft:"Block Sovereign #002", price:"0.1740", color:C.success  },
];

/* ── Hooks ───────────────────────────────────────────────────────────────── */
function useCountdown(endMs) {
  const calc = useCallback(() => {
    const left = Math.max(0, (endMs || 0) - Date.now());
    return {
      h: Math.floor(left / 3600000),
      m: Math.floor((left % 3600000) / 60000),
      s: Math.floor((left % 60000) / 1000),
      expired: left === 0,
    };
  }, [endMs]);

  const [state, setState] = useState(calc);
  useEffect(() => {
    if (!endMs) return;
    setState(calc());
    const t = setInterval(() => setState(calc()), 1000);
    return () => clearInterval(t);
  }, [endMs, calc]);
  return state;
}

function useTilt(ref) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width  - 0.5) * 16;
      const ny = ((e.clientY - r.top)  / r.height - 0.5) * -16;
      const gx = ((e.clientX - r.left) / r.width)  * 100;
      const gy = ((e.clientY - r.top)  / r.height) * 100;
      setTilt({ rx: nx, ry: ny, gx, gy });
    };
    const onLeave = () => setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  return tilt;
}

function usePriceHistory(seed) {
  return useMemo(() => {
    const pts = [seed * 0.72];
    for (let i = 1; i < 10; i++) {
      pts.push(Math.max(0.001, pts[i - 1] * (0.88 + Math.random() * 0.26)));
    }
    return pts;
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ── Micro Components ────────────────────────────────────────────────────── */
function RarityBadge({ rarity, tiny = false }) {
  const r = RARITY[rarity] || RARITY.Common;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: r.bg, color: r.color,
      border: `1px solid ${r.color}44`,
      borderRadius: 20, padding: tiny ? "2px 7px" : "4px 11px",
      fontSize: tiny ? 9 : 10, fontWeight: 700,
      letterSpacing: "0.09em", textTransform: "uppercase",
      fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: tiny ? 7 : 9 }}>{r.symbol}</span>
      {rarity}
    </span>
  );
}

function Mono({ children, size = 13, color = C.text, weight = 400, style: extraStyle }) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size, color, fontWeight: weight, ...extraStyle }}>
      {children}
    </span>
  );
}

function BtcPrice({ value, size = 14, dimColor }) {
  if (value == null) return <Mono size={size} color={C.muted}>—</Mono>;
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size, color: dimColor || C.text }}>
      <span style={{ color: C.primary, marginRight: 2, fontSize: size * 0.78 }}>₿</span>
      {Number(value).toFixed(4)}
    </span>
  );
}

function Sparkline({ data, w = 72, h = 28, color = C.primary }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 0.001;
  const px = data.map((v, i) => (i / (data.length - 1)) * w);
  const py = data.map((v) => h - ((v - min) / rng) * (h - 4) + 2);
  const linePts = data.map((_, i) => `${px[i]},${py[i]}`).join(" ");
  const areaPts = `0,${h} ${linePts} ${w},${h}`;
  const uid = `sp-${color.replace(/[^a-z0-9]/gi, "")}-${w}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible", display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${uid})`} points={areaPts} />
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={linePts} />
      <circle cx={px[px.length - 1]} cy={py[py.length - 1]} r="2.5" fill={color} />
    </svg>
  );
}

function CountdownInline({ endMs }) {
  const { h, m, s, expired } = useCountdown(endMs);
  if (expired) return <Mono size={11} color={C.danger}>ENDED</Mono>;
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[["h", h], ["m", m], ["s", s]].map(([l, v]) => (
        <span key={l} style={{ background: C.surface, borderRadius: 4, padding: "2px 5px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.accent }}>
          {String(v).padStart(2, "0")}<span style={{ color: C.muted, fontSize: 8 }}>{l}</span>
        </span>
      ))}
    </span>
  );
}

/* ── NFT Canvas Art ──────────────────────────────────────────────────────── */
function NFTCanvas({ nft, size = 220 }) {
  const canvasRef = useRef(null);
  const r = RARITY[nft.rarity] || RARITY.Common;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const W = size * 2;
    const H = size * 2;
    cvs.width = W;
    cvs.height = H;
    ctx.scale(2, 2);
    const w = size;
    const h = size;

    // Background
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#09090F");
    bg.addColorStop(1, "#0D0D1C");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Dot grid
    ctx.fillStyle = r.color + "16";
    for (let x = 8; x < w; x += 14) {
      for (let y = 8; y < h; y += 14) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Outer glow
    const glow = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.52);
    glow.addColorStop(0, r.color + "28");
    glow.addColorStop(0.6, r.color + "10");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Hexagon
    const hexR = w * 0.38;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x2 = Math.cos(a) * hexR;
      const y2 = Math.sin(a) * hexR;
      i === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    const hexGrad = ctx.createLinearGradient(-hexR, -hexR, hexR, hexR);
    hexGrad.addColorStop(0, r.color + "BB");
    hexGrad.addColorStop(1, r.color + "44");
    ctx.strokeStyle = hexGrad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner hex
    const hexR2 = hexR * 0.72;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? ctx.moveTo(Math.cos(a) * hexR2, Math.sin(a) * hexR2) : ctx.lineTo(Math.cos(a) * hexR2, Math.sin(a) * hexR2);
    }
    ctx.closePath();
    ctx.strokeStyle = r.color + "30";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Corner dots
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * hexR, Math.sin(a) * hexR, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = r.color + "CC";
      ctx.fill();
    }
    ctx.restore();

    // Emoji
    ctx.font = `${w * 0.26}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 20;
    ctx.fillText(nft.img, w / 2, h / 2 + 2);
    ctx.shadowBlur = 0;

    // Token number watermark
    ctx.fillStyle = r.color + "66";
    ctx.font = `500 ${w * 0.048}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(`#${nft.num}`, w - 9, h - 9);

    // Creator badge
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(8, h - 26, Math.min(nft.creator.length * 7 + 14, 100), 18, 4);
    ctx.fill();
    ctx.fillStyle = r.color + "CC";
    ctx.font = `600 ${w * 0.042}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(nft.creator, 13, h - 17);
  }, [nft, size, r]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: size, height: size, borderRadius: 12, imageRendering: "crisp-edges" }}
    />
  );
}

/* ── NFT Card with 3D Tilt ───────────────────────────────────────────────── */
function NFTCard({ nft, onOpen, compact = false }) {
  const ref = useRef(null);
  const tilt = useTilt(ref);
  const priceHist = usePriceHistory(nft.lastSale);
  const [liked, setLiked] = useState(false);
  const [hov, setHov] = useState(false);
  const r = RARITY[nft.rarity] || RARITY.Common;
  const sz = compact ? 180 : 220;

  const handleLike = useCallback((e) => {
    e.stopPropagation();
    setLiked((prev) => !prev);
  }, []);

  const handleOpen = useCallback((e) => {
    e.stopPropagation();
    onOpen(nft);
  }, [nft, onOpen]);

  return (
    <div
      ref={ref}
      onClick={() => onOpen(nft)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        cursor: "pointer",
        borderRadius: 20,
        background: hov ? C.cardHov : C.card,
        border: `1px solid ${hov ? r.color + "55" : C.border}`,
        overflow: "hidden",
        transform: `perspective(900px) rotateY(${tilt.rx}deg) rotateX(${tilt.ry}deg) scale(${hov ? 1.016 : 1})`,
        transition: "transform 0.12s ease, box-shadow 0.25s, border-color 0.25s, background 0.2s",
        boxShadow: hov ? `0 18px 50px ${r.glow}, 0 4px 16px #00000066` : "0 2px 14px #00000055",
        willChange: "transform",
        position: "relative",
      }}
    >
      {/* Tilt shine */}
      <div
        style={{
          position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none", borderRadius: 20,
          background: hov
            ? `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, #ffffff08 0%, transparent 60%)`
            : "none",
          transition: "background 0.1s",
        }}
      />

      {/* Art section */}
      <div style={{ position: "relative", background: "#09090F", lineHeight: 0 }}>
        <NFTCanvas nft={nft} size={sz} />

        {/* Auction badge */}
        {nft.auction && (
          <div style={{
            position: "absolute", top: 10, left: 10, zIndex: 5,
            background: `linear-gradient(90deg, ${C.primary}EE, ${C.secondary}EE)`,
            borderRadius: 20, padding: "3px 10px",
            fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.1em",
            fontFamily: "'JetBrains Mono', monospace",
          }}>⏱ AUCTION</div>
        )}

        {/* Rarity badge */}
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 5 }}>
          <RarityBadge rarity={nft.rarity} tiny />
        </div>

        {/* Hover overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 6,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          background: `linear-gradient(to top, ${C.bg}EE 0%, ${C.bg}44 40%, transparent 70%)`,
          paddingBottom: 14, opacity: hov ? 1 : 0, transition: "opacity 0.2s",
          pointerEvents: hov ? "auto" : "none",
        }}>
          <button onClick={handleOpen} style={{
            background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
            border: "none", borderRadius: 30, padding: "9px 24px",
            color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
            fontFamily: "inherit", letterSpacing: "0.04em",
            boxShadow: `0 4px 18px ${C.primary}55`,
          }}>
            {nft.auction ? "Place Bid" : nft.listed ? "Buy Now" : "View"}
          </button>
        </div>

        {/* Like button */}
        <button
          onClick={handleLike}
          style={{
            position: "absolute", bottom: 10, right: 10, zIndex: 7,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
            border: `1px solid ${liked ? C.danger + "66" : "#ffffff12"}`,
            borderRadius: 20, padding: "4px 9px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
            color: liked ? C.danger : C.muted, fontSize: 11, fontFamily: "inherit",
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: 10 }}>{liked ? "♥" : "♡"}</span>
          <Mono size={10} color={liked ? C.danger : C.muted}>{nft.likes + (liked ? 1 : 0)}</Mono>
        </button>
      </div>

      {/* Info */}
      <div style={{ padding: compact ? "10px 12px 13px" : "13px 15px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
          <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
            <div style={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: C.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nft.name}
            </div>
            <Mono size={10} color={C.muted}>#{nft.num} · E{nft.epoch}</Mono>
          </div>
          <Sparkline data={priceHist} w={56} h={22} color={r.color} />
        </div>

        {nft.auction && nft.auctionEnd && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7, background: `${C.primary}0A`, borderRadius: 8, padding: "5px 9px" }}>
            <span style={{ fontSize: 9, color: C.muted, letterSpacing: "0.07em" }}>ENDS IN</span>
            <CountdownInline endMs={nft.auctionEnd} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, letterSpacing: "0.06em" }}>
              {nft.auction ? "TOP BID" : nft.listed ? "LIST PRICE" : "LAST SALE"}
            </div>
            <BtcPrice value={nft.auction ? nft.highBid : nft.listed ? nft.price : nft.lastSale} size={compact ? 13 : 15} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>YIELD</div>
            <Mono size={11} color={C.success}>+{nft.yield.toFixed(3)}</Mono>
          </div>
        </div>

        {(nft.listed || nft.auction) && (
          <button
            onClick={handleOpen}
            style={{
              width: "100%", marginTop: 10,
              background: "transparent",
              border: `1px solid ${r.color}55`,
              borderRadius: 30, padding: "8px 0",
              color: r.color, fontWeight: 700, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.18s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(90deg,${C.primary},${C.secondary})`;
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.border = "1px solid transparent";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = r.color;
              e.currentTarget.style.border = `1px solid ${r.color}55`;
            }}
          >
            {nft.auction ? `Bid · ₿${nft.price.toFixed(4)}` : `Buy · ₿${nft.price.toFixed(4)}`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Wallet Connect Modal ────────────────────────────────────────────────── */
function WalletModal({ onClose, onConnected }) {
  const [connecting, setConnecting] = useState(null);
  const [error, setError] = useState("");
  const [walletStates, setWalletStates] = useState({});

  useEffect(() => {
    // Detect installed wallets
    const states = {};
    WALLETS.forEach((w) => {
      states[w.id] = w.detect();
    });
    setWalletStates(states);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleConnect = useCallback(async (wallet) => {
    setError("");
    setConnecting(wallet.id);
    try {
      const result = await wallet.connect();
      onConnected({
        address:   result.address   || "bc1q...demo",
        publicKey: result.publicKey || "",
        network:   result.network   || "mainnet",
        walletId:  wallet.id,
        walletName: wallet.label,
        walletIcon: wallet.icon,
        walletColor: wallet.color,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not installed")) {
        setError(`${wallet.label} extension not found. Please install it first.`);
      } else if (msg.includes("User rejected") || msg.includes("cancelled")) {
        setError("Connection rejected by user.");
      } else {
        // Demo mode fallback
        onConnected({
          address:    `bc1q...${wallet.id.slice(0, 4)}`,
          publicKey:  "demo",
          network:    "mainnet",
          walletId:   wallet.id,
          walletName: wallet.label,
          walletIcon: wallet.icon,
          walletColor: wallet.color,
        });
        onClose();
      }
    } finally {
      setConnecting(null);
    }
  }, [onClose, onConnected]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(8,8,15,0.88)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, border: `1px solid ${C.borderMid}`,
          borderRadius: 24, width: "100%", maxWidth: 440,
          boxShadow: `0 32px 80px #00000099`,
          animation: "mIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>Connect Wallet</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Choose your Bitcoin wallet to continue</p>
          </div>
          <button onClick={onClose} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: C.muted, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Wallet list */}
        <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
          {WALLETS.map((w) => {
            const installed = walletStates[w.id];
            const isConnecting = connecting === w.id;
            return (
              <button
                key={w.id}
                onClick={() => handleConnect(w)}
                disabled={isConnecting}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: isConnecting ? `${w.color}11` : C.card,
                  border: `1px solid ${isConnecting ? w.color + "66" : C.border}`,
                  borderRadius: 14, padding: "14px 18px",
                  cursor: isConnecting ? "wait" : "pointer",
                  transition: "all 0.2s", textAlign: "left", width: "100%",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting) {
                    e.currentTarget.style.borderColor = w.color + "66";
                    e.currentTarget.style.background = w.color + "0D";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isConnecting) {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.background = C.card;
                  }
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `${w.color}18`, border: `1px solid ${w.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>
                  {isConnecting ? (
                    <span style={{ fontSize: 16, animation: "spin 0.8s linear infinite", display: "inline-block" }}>⟳</span>
                  ) : w.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{w.label}</span>
                    {w.badge && (
                      <span style={{ background: `${C.primary}22`, color: C.primary, border: `1px solid ${C.primary}44`, borderRadius: 20, padding: "1px 8px", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>
                        {w.badge}
                      </span>
                    )}
                    {!installed && (
                      <span style={{ background: `${C.muted}15`, color: C.muted, borderRadius: 20, padding: "1px 7px", fontSize: 9, letterSpacing: "0.06em", fontFamily: "'JetBrains Mono', monospace" }}>
                        NOT INSTALLED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{w.tagline}</div>
                </div>

                {/* Installed indicator */}
                {installed && (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.success, boxShadow: `0 0 6px ${C.success}`, flexShrink: 0 }} />
                )}

                {isConnecting && (
                  <span style={{ fontSize: 11, color: w.color, fontFamily: "'JetBrains Mono', monospace" }}>Connecting…</span>
                )}
              </button>
            );
          })}

          {error && (
            <div style={{ background: `${C.danger}11`, border: `1px solid ${C.danger}44`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: C.danger }}>
              ⚠ {error}
            </div>
          )}

          <p style={{ fontSize: 11, color: C.muted, textAlign: "center", margin: "8px 0 0", lineHeight: 1.6 }}>
            By connecting, you agree to our{" "}
            <span style={{ color: C.primary, cursor: "pointer" }}>Terms of Service</span> and{" "}
            <span style={{ color: C.primary, cursor: "pointer" }}>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── NFT Detail Modal ────────────────────────────────────────────────────── */
function NFTModal({ nft, onClose, wallet }) {
  const [mTab, setMTab] = useState("details");
  const [bidAmt, setBidAmt] = useState("");
  const [bidPlaced, setBidPlaced] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const priceHist = usePriceHistory(nft.lastSale);
  const r = RARITY[nft.rarity] || RARITY.Common;
  const creator = CREATORS[nft.creator];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const minBid = ((nft.highBid || nft.price || 0) * 1.02);

  const handleBid = useCallback(() => {
    const v = parseFloat(bidAmt);
    if (!bidAmt || isNaN(v) || v < minBid) return;
    setBidPlaced(true);
    setTimeout(() => setBidPlaced(false), 2500);
    setBidAmt("");
  }, [bidAmt, minBid]);

  const fakeBids = useMemo(() => [
    { addr: "bc1q...aa1c", amount: nft.highBid || (nft.price * 0.95), time: "2m ago" },
    { addr: "bc1q...bb2d", amount: ((nft.highBid || nft.price * 0.95) * 0.97), time: "18m ago" },
    { addr: "bc1q...cc3e", amount: ((nft.highBid || nft.price * 0.95) * 0.93), time: "1h ago" },
  ], [nft]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(8,8,15,0.9)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, border: `1px solid ${r.color}33`,
          borderRadius: 28, maxWidth: 960, width: "100%", maxHeight: "90vh",
          display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden",
          animation: "mIn 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: `0 40px 100px #00000099, 0 0 0 1px ${r.color}18`,
        }}
      >
        {/* Left panel */}
        <div style={{ background: "#09090F", padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, overflow: "auto" }}>
          <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: `0 0 60px ${r.glow}` }}>
            <NFTCanvas nft={nft} size={280} />
          </div>

          <div style={{ width: "100%", background: C.card, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: "0.07em" }}>PRICE HISTORY</div>
            <Sparkline data={priceHist} w={240} h={44} color={r.color} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <Mono size={10} color={C.muted}>10 epochs</Mono>
              <BtcPrice value={nft.lastSale} size={12} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            {[["♥", nft.likes, C.danger], ["👁", nft.views.toLocaleString(), C.muted]].map(([icon, val, col]) => (
              <div key={String(icon)} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18 }}>{icon}</div>
                <Mono size={12} color={col}>{val}</Mono>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ padding: "28px 32px", overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={onClose}
            style={{ alignSelf: "flex-end", background: C.card, border: `1px solid ${C.border}`, borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: C.muted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
          >✕</button>

          {/* Creator row */}
          {creator && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, borderRadius: 12, padding: "8px 14px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${creator.color}20`, border: `1.5px solid ${creator.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{creator.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.muted }}>CREATOR</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{creator.name}</span>
                  {creator.verified && <span style={{ color: C.primary, fontSize: 11 }}>✓</span>}
                </div>
              </div>
              <RarityBadge rarity={nft.rarity} tiny />
            </div>
          )}

          <div>
            <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 4px", color: C.text }}>
              {nft.name} <span style={{ color: r.color }}>#{nft.num}</span>
            </h2>
            <Mono size={11} color={C.muted}>Token #{nft.id} · Epoch #{nft.epoch} · {nft.staked.toLocaleString()} PoY staked</Mono>
          </div>

          {/* Price block */}
          <div style={{ background: `${r.color}0C`, border: `1px solid ${r.color}33`, borderRadius: 14, padding: "14px 18px" }}>
            {nft.auction ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>CURRENT BID</div>
                  <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: r.color }}>₿ {(nft.highBid || 0).toFixed(4)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>ENDS IN</div>
                  <CountdownInline endMs={nft.auctionEnd} />
                  <div style={{ marginTop: 4 }}><Mono size={10} color={C.muted}>{nft.bids} bids</Mono></div>
                </div>
              </div>
            ) : nft.listed ? (
              <>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>LIST PRICE</div>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: r.color }}>₿ {nft.price.toFixed(4)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Last sale: ₿{nft.lastSale.toFixed(4)}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.muted }}>Not currently listed — make an offer to the owner</div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
            {["details", "traits", "bids", "history"].map((t) => (
              <button key={t} onClick={() => setMTab(t)} style={{
                background: mTab === t ? `${r.color}18` : "none",
                border: mTab === t ? `1px solid ${r.color}44` : "1px solid transparent",
                borderRadius: 20, padding: "5px 13px",
                color: mTab === t ? r.color : C.muted,
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                textTransform: "capitalize",
              }}>{t}</button>
            ))}
          </div>

          <div style={{ flex: 1 }}>
            {mTab === "details" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["Staked", `${nft.staked.toLocaleString()} PoY`], ["Yield Earned", `₿ ${nft.yield}`], ["Owner", nft.owner], ["Epoch", `#${nft.epoch}`], ["Rarity", nft.rarity], ["Creator", nft.creator]].map(([k, v]) => (
                  <div key={k} style={{ background: C.card, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, letterSpacing: "0.07em" }}>{k}</div>
                    <Mono size={12} color={C.text}>{v}</Mono>
                  </div>
                ))}
              </div>
            )}

            {mTab === "traits" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nft.traits.map((tr) => {
                  const pct = tr.k === "Score" ? parseFloat(tr.v) : 65;
                  return (
                    <div key={tr.k} style={{ background: C.card, borderRadius: 12, padding: "11px 13px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: tr.k === "Score" ? 8 : 0 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>{tr.k}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{tr.v}</span>
                      </div>
                      {tr.k === "Score" && (
                        <div style={{ height: 4, background: C.surface, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.primary}, ${r.color})`, borderRadius: 2 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {mTab === "bids" && (
              <div>
                {nft.auction && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                      PLACE BID (min ₿{minBid.toFixed(4)})
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="number" min={minBid} step="0.0001"
                        value={bidAmt} onChange={(e) => setBidAmt(e.target.value)}
                        placeholder={`≥ ${minBid.toFixed(4)}`}
                        style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", color: C.text, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                      />
                      <button
                        onClick={handleBid}
                        disabled={bidPlaced}
                        style={{
                          background: bidPlaced ? C.success : `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
                          border: "none", borderRadius: 10, padding: "10px 18px",
                          color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                          transition: "background 0.3s",
                        }}
                      >{bidPlaced ? "✓ Bid!" : wallet ? "Bid" : "Connect Wallet"}</button>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {fakeBids.map((b, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, borderRadius: 10, padding: "10px 13px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {i === 0 && <Mono size={9} color={C.success} weight={700}>TOP</Mono>}
                        <Mono size={11} color={C.muted}>{b.addr}</Mono>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <BtcPrice value={b.amount} size={13} />
                        <div style={{ fontSize: 9, color: C.muted }}>{b.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mTab === "history" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { type: "Sale",     from: "bc1q...f8a2", price: nft.lastSale,   time: "2d ago"  },
                  { type: "List",     from: "bc1q...qr9x", price: nft.price,      time: "3d ago"  },
                  { type: "Transfer", from: "bc1q...ab1c", price: null,           time: "5d ago"  },
                  { type: "Mint",     from: "Protocol",    price: null,           time: "7d ago"  },
                ].map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, borderRadius: 10, padding: "10px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        background: a.type === "Sale" ? `${C.success}18` : `${C.muted}18`,
                        color: a.type === "Sale" ? C.success : C.muted,
                        border: `1px solid ${a.type === "Sale" ? C.success : C.muted}33`,
                        borderRadius: 5, padding: "2px 7px", fontSize: 9, fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{a.type.toUpperCase()}</span>
                      <Mono size={11} color={C.muted}>{a.from}</Mono>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {a.price != null && <BtcPrice value={a.price} size={12} />}
                      <div style={{ fontSize: 9, color: C.muted }}>{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            {nft.listed && (
              <button style={{
                flex: 1,
                background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
                border: "none", borderRadius: 30, padding: "13px 0",
                color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
                boxShadow: `0 6px 24px ${C.primary}44`,
              }}>
                {nft.auction ? "Place Bid" : `Buy · ₿${nft.price.toFixed(4)}`}
              </button>
            )}
            <button
              onClick={() => setWishlisted((w) => !w)}
              style={{
                flex: nft.listed ? 0 : 1,
                background: wishlisted ? `${C.danger}18` : "transparent",
                border: `1px solid ${wishlisted ? C.danger + "66" : C.borderMid}`,
                borderRadius: 30, padding: "13px 18px",
                color: wishlisted ? C.danger : C.text, fontWeight: 600, fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {wishlisted ? "♥ Wishlisted" : "♡ Wishlist"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Live Ticker ─────────────────────────────────────────────────────────── */
function LiveTicker() {
  const ITEMS = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];
  const [offset, setOffset] = useState(0);
  const ITEM_W = 220;
  const totalW = TICKER_ITEMS.length * ITEM_W;

  useEffect(() => {
    let raf;
    const step = () => {
      setOffset((prev) => (prev + 0.45) % totalW);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [totalW]);

  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, height: 34, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", display: "flex", alignItems: "center", gap: 0, transform: `translateX(-${offset}px)`, whiteSpace: "nowrap" }}>
        {ITEMS.map((item, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, width: ITEM_W, flexShrink: 0 }}>
            <span style={{
              background: item.color + "22", color: item.color,
              border: `1px solid ${item.color}33`, borderRadius: 4,
              padding: "1px 6px", fontSize: 9, fontWeight: 800,
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em",
            }}>{item.type}</span>
            <span style={{ fontSize: 11, color: C.text }}>{item.nft}</span>
            {item.price !== "—" && (
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: item.type === "SALE" ? C.success : C.primary }}>₿{item.price}</span>
            )}
            <span style={{ color: C.dim, marginLeft: 8 }}>·</span>
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: 80, height: "100%", background: `linear-gradient(to right, ${C.surface}, transparent)`, pointerEvents: "none", zIndex: 2 }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: 80, height: "100%", background: `linear-gradient(to left, ${C.surface}, transparent)`, pointerEvents: "none", zIndex: 2 }} />
    </div>
  );
}

/* ── Notification Bell ───────────────────────────────────────────────────── */
function NotifBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const ref = useRef(null);

  const notifs = [
    { icon: "💰", text: "Your offer on Block Sovereign was accepted",  time: "2m ago",  new: true  },
    { icon: "⬆",  text: "Void Miner floor price up 14%",              time: "18m ago", new: true  },
    { icon: "⏱",  text: "Satoshi Proof auction ends in 24h",          time: "1h ago",  new: true  },
    { icon: "🎉",  text: "Citrus Yield received a new offer",          time: "3h ago",  new: true  },
    { icon: "✓",   text: "Hash Pilgrim purchase confirmed on-chain",   time: "6h ago",  new: false },
  ];

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen((o) => !o); setRead(true); }}
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "50%", width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, position: "relative", transition: "border-color 0.2s" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.primary + "55"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
      >
        🔔
        {!read && <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: C.danger, border: `2px solid ${C.bg}`, fontSize: 9, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>4</div>}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 46, right: 0, background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: 18, width: 320, boxShadow: "0 24px 56px #00000099", zIndex: 600, overflow: "hidden", animation: "mIn 0.2s ease" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Notifications</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>
          {notifs.map((n, i) => (
            <div key={i} style={{ padding: "12px 18px", display: "flex", gap: 12, alignItems: "flex-start", background: n.new && !read ? `${C.primary}06` : "transparent", borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFFFF05"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = n.new && !read ? `${C.primary}06` : "transparent"; }}
            >
              <span style={{ fontSize: 17, flexShrink: 0 }}>{n.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{n.text}</div>
                <Mono size={10} color={C.muted}>{n.time}</Mono>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Top Nav ─────────────────────────────────────────────────────────────── */
function Nav({ tab, setTab, wallet, onOpenWallet, onDisconnect }) {
  const [searchFocused, setSearchFocused] = useState(false);
  const TABS = [["marketplace", "Marketplace"], ["my-nfts", "My NFTs"], ["activity", "Activity"], ["analytics", "Analytics"]];

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 300, background: "rgba(8,8,15,0.94)", backdropFilter: "blur(28px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 28px", height: 66, gap: 0 }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginRight: 28, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: `0 4px 18px ${C.primary}44` }}>⚡</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, lineHeight: 1 }}>PoY<span style={{ color: C.primary }}>Market</span></div>
          <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.2em", textTransform: "uppercase" }}>Bitcoin NFTs</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", width: 280, marginRight: 16 }}>
        <input
          placeholder="Search NFTs, creators…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{ width: "100%", boxSizing: "border-box", background: searchFocused ? C.card : C.surface, border: `1px solid ${searchFocused ? C.primary + "66" : C.border}`, borderRadius: 30, padding: "8px 16px 8px 34px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", transition: "all 0.2s" }}
        />
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 14, pointerEvents: "none" }}>⌕</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", flex: 1 }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab === id ? `2px solid ${C.primary}` : "2px solid transparent", padding: "0 16px", height: 66, color: tab === id ? C.primary : C.muted, fontWeight: tab === id ? 700 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "color 0.18s", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <NotifBell />
        {wallet ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.primary}44`, borderRadius: 30, padding: "6px 14px", cursor: "pointer" }}
            onClick={onDisconnect}
            title="Click to disconnect"
          >
            <span style={{ fontSize: 14 }}>{wallet.walletIcon}</span>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.success, boxShadow: `0 0 7px ${C.success}` }} />
            <Mono size={12} color={C.text}>{wallet.address.slice(0, 8)}…{wallet.address.slice(-4)}</Mono>
            <Mono size={10} color={C.muted}>{wallet.walletName}</Mono>
          </div>
        ) : (
          <button onClick={onOpenWallet} style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`, border: "none", borderRadius: 30, padding: "9px 20px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 18px ${C.primary}44` }}>
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}

/* ── Hero Banner ─────────────────────────────────────────────────────────── */
function Hero({ onExplore }) {
  const [tick, setTick] = useState(0);
  const [fi, setFi] = useState(0);
  const featured = [NFTS[7], NFTS[3], NFTS[0]];

  useEffect(() => {
    const t1 = setInterval(() => setTick((x) => x + 1), 50);
    const t2 = setInterval(() => setFi((i) => (i + 1) % 3), 3500);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", border: `1px solid ${C.border}`, minHeight: 360, display: "flex", marginBottom: 24 }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }} preserveAspectRatio="none">
        <defs>
          <radialGradient id="hg1" cx="25%" cy="50%"><stop offset="0%" stopColor={C.primary} /><stop offset="100%" stopColor="transparent" /></radialGradient>
          <radialGradient id="hg2" cx="80%" cy="30%"><stop offset="0%" stopColor={C.secondary} /><stop offset="100%" stopColor="transparent" /></radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#080810" />
        <rect width="100%" height="100%" fill="url(#hg1)" />
        <rect width="100%" height="100%" fill="url(#hg2)" />
      </svg>

      {/* Floating particles */}
      {Array.from({ length: 6 }, (_, i) => {
        const ox = 55 + 32 * Math.cos(tick * 0.007 + i * 1.1);
        const oy = 30 + 25 * Math.sin(tick * 0.005 + i * 0.5);
        return (
          <div key={i} style={{ position: "absolute", left: `${ox}%`, top: `${oy}%`, width: i % 2 === 0 ? 5 : 3, height: i % 2 === 0 ? 5 : 3, borderRadius: "50%", background: i % 3 === 0 ? C.primary : i % 3 === 1 ? C.secondary : C.accent, opacity: 0.55, pointerEvents: "none" }} />
        );
      })}

      <div style={{ flex: 1, padding: "48px 52px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 16, background: `${C.primary}15`, border: `1px solid ${C.primary}30`, borderRadius: 30, padding: "5px 14px", alignSelf: "flex-start" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.success, boxShadow: `0 0 8px ${C.success}` }} />
          <Mono size={10} color={C.primary} weight={700}>927 LIVE LISTINGS</Mono>
        </div>
        <h1 style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.04em", margin: "0 0 16px", color: C.text }}>
          The Only<br />
          <span style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.accent} 40%, ${C.secondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Bitcoin-Yield</span><br />
          NFT Market
        </h1>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.75, maxWidth: 400, margin: "0 0 28px" }}>
          Trade Proof-of-Yield receipts backed by OP_NET mining rewards. Every NFT earns real Bitcoin.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onExplore} style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`, border: "none", borderRadius: 30, padding: "13px 28px", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 8px 28px ${C.primary}44` }}>Explore Market</button>
          <button style={{ background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: 30, padding: "13px 24px", color: C.text, fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Mint Yield NFT</button>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 34 }}>
          {[["142.8 BTC", "Total Volume"], ["4,291", "NFTs Minted"], ["1,843", "Owners"]].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{v}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 14, position: "relative", zIndex: 1 }}>
        <Mono size={10} color={C.muted} weight={700} style={{ letterSpacing: "0.14em" }}>FEATURED</Mono>
        <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: `0 0 48px ${RARITY[featured[fi].rarity].glow}` }}>
          <NFTCanvas nft={featured[fi]} size={190} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{featured[fi].name} #{featured[fi].num}</div>
          <BtcPrice value={featured[fi].price} size={13} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <button key={i} onClick={() => setFi(i)} style={{ width: i === fi ? 18 : 6, height: 6, borderRadius: 3, background: i === fi ? C.primary : C.dim, border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── About / Platform Description ───────────────────────────────────────── */
function AboutSection() {
  const PILLARS = [
    {
      icon: "₿",
      color: C.primary,
      title: "Real Bitcoin Yield",
      body:
        "Every PoY NFT is a Proof-of-Yield receipt minted on OP_NET. It represents a verified Bitcoin stake position that earns rewards from each mining epoch — automatically accrued on-chain, claimable at any time.",
    },
    {
      icon: "⛓",
      color: C.secondary,
      title: "Bitcoin-Native Protocol",
      body:
        "PoY Market is built entirely on OP_NET — a Bitcoin Layer 2 that executes smart contracts while settling on the Bitcoin base layer. No wrapped BTC, no bridging, no EVM. Pure Bitcoin security from block one.",
    },
    {
      icon: "🔒",
      color: C.success,
      title: "Verify-Don't-Custody",
      body:
        "The PoYMarket contract never holds or moves BTC. Every trade settles via real Bitcoin UTXOs — seller receives BTC on-chain before ownership transfers on OP_NET. The contract is a record-keeper, not a custodian.",
    },
    {
      icon: "⚡",
      color: C.accent,
      title: "Quantum-Safe Wallets",
      body:
        "OP_WALLET uses MLDSA (Module Lattice Digital Signature Algorithm) — a NIST-standardised post-quantum signature scheme. Your assets are protected against both classical and quantum adversaries.",
    },
  ];

  const HOW = [
    { n: "01", label: "Stake BTC",     detail: "Deposit Bitcoin into the PoY Protocol and receive a Proof-of-Yield NFT representing your staked position." },
    { n: "02", label: "Earn Yield",    detail: "Your NFT accrues BTC rewards each epoch from OP_NET mining revenue, proportional to your stake weight." },
    { n: "03", label: "Trade or Hold", detail: "List your yield-bearing NFT on PoY Market. New owners inherit the staking position and continue earning." },
    { n: "04", label: "Claim Anytime", detail: "Unclaimed yield accumulates on-chain. Call claimYield() at any time — no lock-up, no expiry, no friction." },
  ];

  return (
    <div style={{ marginBottom: 56 }}>
      {/* ── Section header ── */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center", background: `${C.secondary}14`, border: `1px solid ${C.secondary}30`, borderRadius: 30, padding: "5px 16px", marginBottom: 16 }}>
          <span style={{ fontSize: 10, color: C.secondary, fontWeight: 700, letterSpacing: "0.14em", fontFamily: "'JetBrains Mono', monospace" }}>WHAT IS POY MARKET</span>
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, margin: "0 0 14px", lineHeight: 1.1 }}>
          Bitcoin Yield,{" "}
          <span style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.accent} 50%, ${C.secondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Tokenised.
          </span>
        </h2>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, maxWidth: 600, margin: "0 auto" }}>
          PoY Market is the first marketplace for yield-bearing NFTs backed by real Bitcoin stakes on OP_NET.
          Buy, sell, and hold positions that keep earning — long after the trade settles.
        </p>
      </div>

      {/* ── 4-pillar grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 40 }}>
        {PILLARS.map((p) => (
          <div
            key={p.title}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: "26px 24px",
              transition: "border-color 0.25s, transform 0.25s",
              cursor: "default",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = p.color + "44";
              e.currentTarget.style.transform = "translateY(-4px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              background: p.color + "18",
              border: `1px solid ${p.color}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, marginBottom: 16,
            }}>
              {p.icon}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>{p.title}</div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, margin: 0 }}>{p.body}</p>
          </div>
        ))}
      </div>

      {/* ── How it works ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary}08, ${C.secondary}08)`,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: "36px 36px 32px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: "0.12em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          HOW IT WORKS
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: "0 0 28px", letterSpacing: "-0.02em" }}>
          Four steps. Real Bitcoin.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
          {HOW.map((step, i) => (
            <div key={step.n} style={{ position: "relative" }}>
              {/* Connector line between steps (desktop) */}
              {i < HOW.length - 1 && (
                <div style={{
                  display: "none", // shown via inline for desktop widths; kept simple here
                }} />
              )}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.primary}22, ${C.secondary}22)`,
                border: `1px solid ${C.primary}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12, fontWeight: 700, color: C.primary,
                marginBottom: 12,
              }}>
                {step.n}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 7 }}>{step.label}</div>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0 }}>{step.detail}</p>
            </div>
          ))}
        </div>

        {/* Bottom trust strip */}
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 28, paddingTop: 20, display: "flex", gap: 28, flexWrap: "wrap" }}>
          {[
            ["🛡", "Non-custodial", "Your BTC never leaves your control"],
            ["📜", "Audited Contract", "PoYMarket v7 — full security audit completed"],
            ["⛓", "Bitcoin L2", "Settled on Bitcoin via OP_NET"],
            ["🔑", "MLDSA Keys", "Post-quantum wallet signatures"],
          ].map(([icon, label, sub]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{label}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function DropBanner() {
  const { h, m, s } = useCountdown(Date.now() + 10 * 3600000 + 24 * 60000);
  return (
    <div style={{ background: `linear-gradient(100deg, ${C.primary}18, ${C.secondary}18)`, border: `1px solid ${C.primary}33`, borderRadius: 18, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 32 }}>🔥</span>
        <div>
          <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 3 }}>UPCOMING DROP</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>PoY Genesis Season II</div>
          <div style={{ fontSize: 11, color: C.muted }}>100 exclusive Legendary yield NFTs — whitelisted wallets only</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["HRS", h], ["MIN", m], ["SEC", s]].map(([l, v]) => (
            <div key={l} style={{ background: C.card, borderRadius: 10, padding: "8px 12px", textAlign: "center", minWidth: 52 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: C.primary, lineHeight: 1 }}>{String(v).padStart(2, "0")}</div>
              <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        <button style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`, border: "none", borderRadius: 30, padding: "11px 22px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Whitelist Me</button>
      </div>
    </div>
  );
}

/* ── Creators Row ────────────────────────────────────────────────────────── */
function CreatorsRow() {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>Top Creators</h3>
        <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 13px", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>View All</button>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        {Object.values(CREATORS).map((cr) => (
          <div key={cr.name} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 11, flexShrink: 0, cursor: "pointer", transition: "border-color 0.2s", minWidth: 190 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = cr.color + "55"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${cr.color}22`, border: `2px solid ${cr.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{cr.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{cr.name}</span>
                {cr.verified && <span style={{ color: C.primary, fontSize: 10 }}>✓</span>}
              </div>
              <Mono size={10} color={C.muted}>{cr.volume}</Mono>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Recently Viewed ─────────────────────────────────────────────────────── */
function RecentRail({ items, onOpen }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 13 }}>Recently Viewed</div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        {items.map((nft) => {
          const r = RARITY[nft.rarity] || RARITY.Common;
          return (
            <div key={nft.id} onClick={() => onOpen(nft)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, overflow: "hidden", cursor: "pointer", flexShrink: 0, width: 135, transition: "border-color 0.2s, transform 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = r.color + "55"; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <NFTCanvas nft={nft} size={135} />
              <div style={{ padding: "7px 9px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nft.name}</div>
                <BtcPrice value={nft.listed ? nft.price : nft.lastSale} size={11} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Marketplace Tab ─────────────────────────────────────────────────────── */
const CATS = ["All", "Legendary", "Epic", "Rare", "Common", "Auction", "Listed"];

function MarketTab({ onOpen, recentlyViewed }) {
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("Trending");
  const [view, setView] = useState("grid");
  const exploreRef = useRef(null);

  const filtered = useMemo(() => {
    return NFTS.filter((n) => {
      if (cat === "All") return true;
      if (cat === "Listed") return n.listed;
      if (cat === "Auction") return n.auction;
      return n.rarity === cat;
    }).sort((a, b) => {
      switch (sort) {
        case "Trending":    return b.views - a.views;
        case "Price ↑":    return (a.price || 0) - (b.price || 0);
        case "Price ↓":    return (b.price || 0) - (a.price || 0);
        case "Yield ↓":    return b.yield - a.yield;
        case "Newest":     return b.epoch - a.epoch;
        case "Most Liked": return b.likes - a.likes;
        default:           return 0;
      }
    });
  }, [cat, sort]);

  return (
    <div>
      <Hero onExplore={() => exploreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 1, background: C.border, borderRadius: 18, overflow: "hidden", marginBottom: 28 }}>
        {[["Total Volume","142.8 BTC","+8.2%",true],["Floor","₿0.004","+2.1%",true],["24h Sales","34","+12",true],["Listed","28.4%","-1.2%",false],["Owners","1,843","+34",true],["Avg APY","17.3%","+0.9%",true]].map(([l,v,d,pos]) => (
          <div key={l} style={{ background: C.surface, padding: "15px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.07em", marginBottom: 4 }}>{l}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 3 }}>{v}</div>
            <div style={{ fontSize: 10, color: pos ? C.success : C.danger, fontFamily: "'JetBrains Mono', monospace" }}>{d}</div>
          </div>
        ))}
      </div>

      <AboutSection />
      <DropBanner />
      <CreatorsRow />
      <RecentRail items={recentlyViewed} onOpen={onOpen} />

      {/* Filter bar */}
      <div ref={exploreRef} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} style={{ background: cat === c ? `linear-gradient(90deg,${C.primary}2A,${C.secondary}2A)` : C.card, border: `1px solid ${cat === c ? C.primary + "55" : C.border}`, borderRadius: 30, padding: "6px 15px", color: cat === c ? C.primary : C.muted, fontSize: 12, fontWeight: cat === c ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s" }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
            {["Trending","Price ↑","Price ↓","Yield ↓","Newest","Most Liked"].map((o) => <option key={o}>{o}</option>)}
          </select>
          <div style={{ display: "flex", gap: 3 }}>
            {[["grid","⊞"],["list","☰"]].map(([v, ico]) => (
              <button key={v} onClick={() => setView(v)} style={{ background: view === v ? `${C.primary}22` : C.card, border: `1px solid ${view === v ? C.primary + "55" : C.border}`, borderRadius: 8, width: 34, height: 34, color: view === v ? C.primary : C.muted, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{ico}</button>
            ))}
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
          {filtered.map((nft) => <NFTCard key={nft.id} nft={nft} onOpen={onOpen} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((nft) => {
            const r2 = RARITY[nft.rarity] || RARITY.Common;
            return (
              <div key={nft.id} onClick={() => onOpen(nft)} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", alignItems: "center", gap: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: "12px 16px", cursor: "pointer", transition: "border-color 0.18s, background 0.18s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = r2.color + "44"; e.currentTarget.style.background = C.cardHov; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 10, background: "#09090F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{nft.img}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{nft.name} <Mono size={11} color={C.muted}>#{nft.num}</Mono></div>
                  <Mono size={10} color={C.muted}>Epoch #{nft.epoch}</Mono>
                </div>
                <RarityBadge rarity={nft.rarity} tiny />
                <div style={{ textAlign: "right" }}>
                  <BtcPrice value={nft.listed ? nft.price : nft.lastSale} size={14} />
                  <div style={{ fontSize: 9, color: C.muted }}>{nft.listed ? "listed" : "last sale"}</div>
                </div>
                <Mono size={11} color={C.success}>+{nft.yield.toFixed(3)} BTC</Mono>
                {nft.auction && nft.auctionEnd && <CountdownInline endMs={nft.auctionEnd} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── My NFTs Tab ─────────────────────────────────────────────────────────── */
function MyNFTsTab({ wallet, onOpenWallet, onOpen }) {
  const mine = NFTS.filter((n) => n.owner === "bc1q...x9f2");
  const totalYield = mine.reduce((s, n) => s + n.yield, 0);

  if (!wallet) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <div style={{ fontSize: 56, marginBottom: 18 }}>🔐</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 10 }}>Connect Your Wallet</h2>
        <p style={{ color: C.muted, marginBottom: 26, fontSize: 14 }}>View your Proof-of-Yield NFTs, portfolio stats, and earnings</p>
        <button onClick={onOpenWallet} style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`, border: "none", borderRadius: 30, padding: "13px 32px", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Connect Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: `linear-gradient(120deg,${C.primary}0E,${C.secondary}0E)`, border: `1px solid ${C.primary}22`, borderRadius: 22, padding: "26px 30px", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{wallet.walletIcon}</span>
          <Mono size={12} color={C.text}>{wallet.address}</Mono>
          <span style={{ background: `${C.success}18`, color: C.success, border: `1px solid ${C.success}33`, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>CONNECTED</span>
          <Mono size={11} color={C.muted}>via {wallet.walletName}</Mono>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>PORTFOLIO VALUE</div>
        <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: C.text, marginBottom: 18 }}>₿ <span style={{ color: C.primary }}>0.1210</span></div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[[`${mine.length}`, "NFTs Owned"], [`₿ ${totalYield.toFixed(4)}`, "Total Yield"], ["16.8%", "Avg APY"], ["3 Active", "Staked"]].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: C.text }}>{v}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
        {mine.map((nft) => <NFTCard key={nft.id} nft={nft} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

/* ── Activity Tab ────────────────────────────────────────────────────────── */
function ActivityTab() {
  const [filter, setFilter] = useState("All");
  const TYPE_STYLES = {
    Sale:     { bg: `${C.success}18`, color: C.success },
    Bid:      { bg: `${C.primary}18`, color: C.primary },
    List:     { bg: `${C.accent}18`,  color: C.accent  },
    Mint:     { bg: `${C.info}18`,    color: C.info    },
    Transfer: { bg: `${C.muted}18`,   color: C.muted   },
    Offer:    { bg: "#9B5CF618",       color: "#9B5CF6" },
  };
  const ACTIVITY_DATA = [
    { type:"Sale",     nft:NFTS[3],  from:"bc1q...p3k1", to:"bc1q...f8a2",  price:0.174, time:"14s ago"  },
    { type:"Bid",      nft:NFTS[7],  from:"bc1q...aa1c", to:"—",            price:0.248, time:"42s ago"  },
    { type:"List",     nft:NFTS[13], from:"bc1q...lv9n", to:"—",            price:0.047, time:"2m ago"   },
    { type:"Sale",     nft:NFTS[0],  from:"bc1q...f8a2", to:"bc1q...x9f2",  price:0.130, time:"8m ago"   },
    { type:"Offer",    nft:NFTS[1],  from:"bc1q...r2k9", to:"bc1q...x9f2",  price:0.052, time:"12m ago"  },
    { type:"Mint",     nft:NFTS[9],  from:"Protocol",    to:"bc1q...x9f2",  price:null,  time:"18m ago"  },
    { type:"Transfer", nft:NFTS[6],  from:"bc1q...x9f2", to:"bc1q...bb3d",  price:null,  time:"1h ago"   },
    { type:"Sale",     nft:NFTS[5],  from:"bc1q...mn2z", to:"bc1q...aa1c",  price:0.014, time:"2h ago"   },
    { type:"Bid",      nft:NFTS[0],  from:"bc1q...cc5e", to:"—",            price:0.138, time:"2h ago"   },
    { type:"List",     nft:NFTS[14], from:"bc1q...mm3p", to:"—",            price:0.174, time:"3h ago"   },
  ];

  const visible = ACTIVITY_DATA.filter((a) => filter === "All" || a.type === filter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Live <span style={{ color: C.primary }}>Activity</span></h2>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["All","Sale","Bid","Offer","List","Mint","Transfer"].map((t) => (
            <button key={t} onClick={() => setFilter(t)} style={{ background: filter === t ? `${C.primary}22` : "none", border: `1px solid ${filter === t ? C.primary+"55" : C.border}`, borderRadius: 20, padding: "5px 12px", color: filter === t ? C.primary : C.muted, fontSize: 11, fontWeight: filter === t ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Event","NFT","From","To","Price","Yield","Time"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.09em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((a, i) => {
              const ts = TYPE_STYLES[a.type] || TYPE_STYLES.Transfer;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}50`, cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#FFFFFF04"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.color}33`, borderRadius: 5, padding: "2px 8px", fontSize: 9, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{a.type.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{a.nft.img}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.nft.name}</div>
                        <RarityBadge rarity={a.nft.rarity} tiny />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}><Mono size={11} color={C.muted}>{a.from}</Mono></td>
                  <td style={{ padding: "12px 16px" }}><Mono size={11} color={C.muted}>{a.to}</Mono></td>
                  <td style={{ padding: "12px 16px" }}><BtcPrice value={a.price} size={13} /></td>
                  <td style={{ padding: "12px 16px" }}><Mono size={11} color={C.success}>+{a.nft.yield.toFixed(3)}</Mono></td>
                  <td style={{ padding: "12px 16px" }}><Mono size={11} color={C.muted}>{a.time}</Mono></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Analytics Tab ───────────────────────────────────────────────────────── */
function AnalyticsTab() {
  const volData = [12, 18, 14, 22, 19, 28, 24, 31, 26, 38, 34, 42, 39, 48];
  const maxVol = Math.max(...volData);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 26 }}>Protocol <span style={{ color: C.primary }}>Analytics</span></h2>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 22, padding: "26px 30px", marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>14-DAY VOLUME</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 800, color: C.text }}>142.8 <span style={{ fontSize: 15, color: C.primary }}>BTC</span></div>
          </div>
          <Mono size={13} color={C.success}>▲ +8.2% vs prev period</Mono>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 120 }}>
          {volData.map((v, i) => (
            <div key={i} title={`${v} BTC`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ height: `${(v / maxVol) * 110}px`, background: i === volData.length - 1 ? `linear-gradient(180deg,${C.primary},${C.secondary})` : `linear-gradient(180deg,${C.primary}88,${C.primary}22)`, borderRadius: "5px 5px 0 0", transition: "opacity 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <Mono size={10} color={C.muted}>14 days ago</Mono>
          <Mono size={10} color={C.primary}>Today</Mono>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Rarity Distribution</div>
          {[["Legendary",3,25],["Epic",5,42],["Rare",3,25],["Common",2,17]].map(([r2,cnt,pct]) => {
            const rm = RARITY[r2];
            return (
              <div key={r2} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: rm.color, fontWeight: 600 }}>{rm.symbol} {r2}</span>
                  <Mono size={10} color={C.muted}>{cnt} · {pct}%</Mono>
                </div>
                <div style={{ height: 5, background: C.card, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: rm.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Top Sales</div>
          {NFTS.filter((n) => n.listed).sort((a, b) => b.price - a.price).slice(0, 5).map((n, i) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Mono size={11} color={C.dim}>#{i + 1}</Mono>
              <span style={{ fontSize: 18 }}>{n.img}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis" }}>{n.name}</div>
              </div>
              <BtcPrice value={n.price} size={12} />
            </div>
          ))}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Epoch #927</div>
          {[["Blocks","4635 → 4639"],["Confirmed","3/5"],["Difficulty","562.9T"],["Est. Reward","0.0144 BTC"],["APY","17.3%"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
              <Mono size={11} color={C.text}>{v}</Mono>
            </div>
          ))}
          <div style={{ height: 5, background: C.card, borderRadius: 3, overflow: "hidden", marginTop: 12 }}>
            <div style={{ width: "60%", height: "100%", background: `linear-gradient(90deg,${C.primary},${C.secondary})`, borderRadius: 3 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
function Footer() {
  const SOCIAL = [
    { name: "Twitter / X", icon: "𝕏", handle: "@PoYMarket", url: "https://x.com/PoYMarket",       color: "#1DA1F2" },
    { name: "Discord",     icon: "◈",  handle: "PoY Market", url: "https://discord.gg/poymarket",  color: "#5865F2" },
    { name: "Telegram",    icon: "✈",  handle: "t.me/poymarket", url: "https://t.me/poymarket",   color: "#26A5E4" },
    { name: "GitHub",      icon: "⌥",  handle: "poy-protocol",  url: "https://github.com/poy-protocol", color: C.muted },
  ];

  const LINKS = {
    Marketplace: ["Explore NFTs", "Top Creators", "Upcoming Drops", "Auctions"],
    Protocol:    ["Stake OP_20",  "Yield Mechanics", "OP_NET Epochs", "Mining Rewards"],
    Resources:   ["Documentation", "API Reference", "SDK", "Bug Bounty"],
    Company:     ["About", "Blog", "Careers", "Press Kit"],
  };

  return (
    <footer style={{ background: C.surface, borderTop: `1px solid ${C.border}`, marginTop: 80 }}>
      {/* Main footer grid */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "60px 32px 40px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 40 }}>
        {/* Brand */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 4px 18px ${C.primary}44` }}>⚡</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.03em", color: C.text }}>PoY<span style={{ color: C.primary }}>Market</span></div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.2em", textTransform: "uppercase" }}>Bitcoin NFTs</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, maxWidth: 270, marginBottom: 8 }}>
            The first Bitcoin-native NFT marketplace built on OP_NET. Every NFT is a Proof-of-Yield receipt — backed by real BTC stakes, earning mining rewards every epoch.
          </p>
          <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.7, maxWidth: 270, marginBottom: 24 }}>
            Non-custodial · Quantum-safe · Bitcoin L2
          </p>

          {/* Social links */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {SOCIAL.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.name}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 30, padding: "7px 14px",
                  color: C.muted, fontSize: 12, fontWeight: 600,
                  textDecoration: "none", transition: "all 0.2s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = s.color + "66";
                  e.currentTarget.style.color = s.color;
                  e.currentTarget.style.background = s.color + "0F";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.color = C.muted;
                  e.currentTarget.style.background = C.card;
                }}
              >
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{s.handle}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(LINKS).map(([heading, links]) => (
          <div key={heading}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>{heading}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {links.map((link) => (
                <li key={link}>
                  <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, color: C.muted, textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}
                  >{link}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "18px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Mono size={12} color={C.muted}>© 2026 PoYMarket. Built on OP_NET · Bitcoin Layer 2. All rights reserved.</Mono>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
              <a key={l} href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}
              >{l}</a>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.success, boxShadow: `0 0 6px ${C.success}` }} />
            <Mono size={11} color={C.success}>All systems operational</Mono>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Custom Cursor ───────────────────────────────────────────────────────── */
function Cursor() {
  const [dot,  setDot]  = useState({ x: -100, y: -100 });
  const [ring, setRing] = useState({ x: -100, y: -100 });
  const [down, setDown] = useState(false);
  const dotRef  = useRef({ x: -100, y: -100 });
  const ringRef = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const onMove = (e) => { dotRef.current = { x: e.clientX, y: e.clientY }; };
    const onDown = () => setDown(true);
    const onUp   = () => setDown(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup",   onUp);
    let raf;
    const loop = () => {
      setDot({ ...dotRef.current });
      ringRef.current = {
        x: ringRef.current.x + (dotRef.current.x - ringRef.current.x) * 0.13,
        y: ringRef.current.y + (dotRef.current.y - ringRef.current.y) * 0.13,
      };
      setRing({ ...ringRef.current });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup",   onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div style={{ position: "fixed", left: dot.x - 5, top: dot.y - 5, width: 10, height: 10, borderRadius: "50%", background: C.primary, pointerEvents: "none", zIndex: 9999, transform: `scale(${down ? 0.5 : 1})`, transition: "transform 0.1s", mixBlendMode: "screen" }} />
      <div style={{ position: "fixed", left: ring.x - 18, top: ring.y - 18, width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${C.primary}77`, pointerEvents: "none", zIndex: 9998 }} />
    </>
  );
}

/* ── Noise Overlay ───────────────────────────────────────────────────────── */
function NoiseOverlay() {
  return (
    <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9990, opacity: 0.025 }}>
      <filter id="fn"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter="url(#fn)" />
    </svg>
  );
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: C.card, border: `1px solid ${t.type === "error" ? C.danger : C.primary}55`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 12px 40px #00000077", animation: "mIn 0.3s ease" }}>
          <span style={{ fontSize: 17 }}>{t.type === "error" ? "❌" : t.type === "warning" ? "⚠️" : "✅"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Root App ────────────────────────────────────────────────────────────── */
export default function App() {
  const [tab,            setTab]           = useState("marketplace");
  const [modal,          setModal]         = useState(null);
  const [walletModal,    setWalletModal]   = useState(false);
  const [wallet,         setWallet]        = useState(null);
  const [toasts,         setToasts]        = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const toastId = useRef(0);

  const addToast = useCallback((msg, type = "success") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const handleConnected = useCallback((info) => {
    setWallet(info);
    addToast(`${info.walletName} connected ✓`, "success");
  }, [addToast]);

  const handleDisconnect = useCallback(() => {
    setWallet(null);
    addToast("Wallet disconnected", "warning");
  }, [addToast]);

  const handleOpenNFT = useCallback((nft) => {
    setModal(nft);
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((n) => n.id !== nft.id);
      return [nft, ...filtered].slice(0, 8);
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        ${FONTS}
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }
        input, select, button, textarea { font-family: inherit; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        ::placeholder { color: ${C.dim}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: #2A2A3E; border-radius: 3px; }
        a { color: inherit; }
        * { cursor: none !important; }
        @keyframes mIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <NoiseOverlay />
      <Cursor />

      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: `radial-gradient(ellipse 60% 40% at 12% 15%, ${C.primary}06, transparent 55%), radial-gradient(ellipse 50% 50% at 88% 85%, ${C.secondary}06, transparent 55%)` }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <LiveTicker />
        <Nav
          tab={tab}
          setTab={setTab}
          wallet={wallet}
          onOpenWallet={() => setWalletModal(true)}
          onDisconnect={handleDisconnect}
        />

        <main style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 32px 60px" }}>
          {tab === "marketplace" && <MarketTab onOpen={handleOpenNFT} recentlyViewed={recentlyViewed} />}
          {tab === "my-nfts"    && <MyNFTsTab wallet={wallet} onOpenWallet={() => setWalletModal(true)} onOpen={handleOpenNFT} />}
          {tab === "activity"   && <ActivityTab />}
          {tab === "analytics"  && <AnalyticsTab />}
        </main>

        <Footer />
      </div>

      {/* Modals */}
      {walletModal && (
        <WalletModal
          onClose={() => setWalletModal(false)}
          onConnected={handleConnected}
        />
      )}
      {modal && (
        <NFTModal
          nft={modal}
          onClose={() => setModal(null)}
          wallet={wallet}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}
