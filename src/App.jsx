/**
 * Canton PoY Market — App.jsx
 * Complete Yield NFT Staking & Marketplace on Canton Network
 * Wallet: Canton Loop (via @fivenorth/loop-sdk)
 * Tokens: CC (stake) → CBTC (yield rewards)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { loop } from '@fivenorth/loop-sdk';
import {
  ledger, TOKENS, STAKING_CONFIG, getTier,
  connectWallet, disconnectWallet,
  stakeCC, mintYieldNFT, claimYield, accrueYield,
  listNFT, delistNFT, buyNFT, placeBid,
} from './canton-store.js';

// ── Fonts ─────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;700&display=swap');`;

// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg:        '#050811',
  surface:   '#0A0F1E',
  card:      '#0E1528',
  cardHov:   '#131C34',
  border:    '#1A2540',
  borderHov: '#2A3E6A',
  primary:   '#3B7EFF',
  secondary: '#F5A623',
  cbtc:      '#F7931A',
  success:   '#00D9A3',
  danger:    '#FF4D6A',
  text:      '#EDF2FF',
  muted:     '#5A6A8A',
  faint:     '#1E2C4A',
  glow:      'rgba(59,126,255,0.18)',
  glowBtc:   'rgba(247,147,26,0.18)',
};

const FONT = {
  display: "'Syne', sans-serif",
  body:    "'Space Grotesk', sans-serif",
  mono:    "'JetBrains Mono', monospace",
};

// ── Init Loop SDK ──────────────────────────────────────────────────────────
let loopProvider = null;
let loopInitialized = false;

function initLoop(onAccept, onReject) {
  if (loopInitialized) return;
  loopInitialized = true;
  loop.init({
    appName: 'PoY Market',
    network: 'mainnet',
    options: { openMode: 'popup', requestSigningMode: 'popup' },
    onAccept: (provider) => {
      loopProvider = provider;
      onAccept(provider);
    },
    onReject: () => {
      loopProvider = null;
      onReject();
    },
    onTransactionUpdate: (payload) => {
      console.log('[Canton] tx update:', payload);
    },
  });
}

// ── Tiny helpers ──────────────────────────────────────────────────────────
const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtBtc = (n) => Number(n).toFixed(8);
const ago = (ms) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
};
const shortId = (id = '') => id.slice(0, 6) + '…' + id.slice(-4);

// ── Reusable components ───────────────────────────────────────────────────
function Mono({ children, size = 12, color = C.muted, style = {} }) {
  return <span style={{ fontFamily: FONT.mono, fontSize: size, color, ...style }}>{children}</span>;
}

function Tag({ children, color = C.primary, style = {} }) {
  return (
    <span style={{
      background: color + '18', color,
      border: `1px solid ${color}33`,
      borderRadius: 4, padding: '2px 7px',
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
      fontFamily: FONT.mono, ...style,
    }}>{children}</span>
  );
}

function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', style = {} }) {
  const [hov, setHov] = useState(false);
  const sizes = { sm: '7px 16px', md: '10px 22px', lg: '13px 32px' };
  const base = {
    border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: FONT.body, fontWeight: 600, letterSpacing: '0.02em',
    padding: sizes[size], fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13,
    opacity: disabled ? 0.45 : 1, transition: 'all 0.15s',
    transform: hov && !disabled ? 'translateY(-1px)' : 'none',
  };
  const variants = {
    primary: { background: hov ? '#5B9EFF' : C.primary, color: '#fff', boxShadow: hov ? `0 6px 24px ${C.glow}` : 'none' },
    secondary: { background: hov ? '#FFB94D' : C.secondary, color: '#050811' },
    ghost: { background: hov ? C.faint : 'transparent', color: C.text, border: `1px solid ${C.border}` },
    danger: { background: hov ? '#FF7090' : C.danger, color: '#fff' },
    cbtc: { background: hov ? '#FFB03A' : C.cbtc, color: '#050811' },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >{children}</button>
  );
}

function Card({ children, style = {}, glow = false }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.cardHov : C.card,
        border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 16,
        transition: 'all 0.2s',
        boxShadow: glow && hov ? `0 8px 40px ${C.glow}` : 'none',
        ...style,
      }}
    >{children}</div>
  );
}

function StatusBar({ state, msg }) {
  if (!msg || state === 'idle') return null;
  const colors = { pending: C.primary, success: C.success, error: C.danger };
  return (
    <div style={{
      margin: '10px 0', padding: '8px 14px', borderRadius: 8, fontSize: 12,
      background: (colors[state] || C.primary) + '18',
      color: colors[state] || C.primary,
      border: `1px solid ${(colors[state] || C.primary)}33`,
      fontFamily: FONT.mono,
    }}>
      {state === 'pending' && '⏳ '}{state === 'success' && '✓ '}{state === 'error' && '✗ '}{msg}
    </div>
  );
}

// ── NFT Canvas (geometric art) ────────────────────────────────────────────
function NFTCanvas({ nft, size = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = size, h = size;
    ctx.clearRect(0, 0, w, h);
    // Background
    const bg = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/1.4);
    bg.addColorStop(0, nft.rarityColor + '22');
    bg.addColorStop(1, '#050811');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Grid lines
    ctx.strokeStyle = nft.rarityColor + '18';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(i * w/5, 0); ctx.lineTo(i * w/5, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * h/5); ctx.lineTo(w, i * h/5); ctx.stroke();
    }
    // Hexagon
    const r = w * 0.28;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = w/2 + r * Math.cos(a), y = h/2 + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = nft.rarityColor + 'AA';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner hex
    const r2 = w * 0.16;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = w/2 + r2 * Math.cos(a), y = h/2 + r2 * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const fill = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, r2);
    fill.addColorStop(0, nft.rarityColor + '55');
    fill.addColorStop(1, nft.rarityColor + '11');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
    // Center glyph
    ctx.font = `${w * 0.18}px ${FONT.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = nft.rarityColor + 'DD';
    ctx.fillText(nft.art, w/2, h/2);
    // Epoch badge
    ctx.font = `600 ${w * 0.07}px ${FONT.body}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(`E${nft.epoch}`, w/2, h * 0.82);
  }, [nft, size]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block' }} />;
}

// ── Wallet Connect Modal ──────────────────────────────────────────────────
function WalletModal({ onClose, onConnected }) {
  const [state, setState] = useState('idle'); // idle | connecting | error
  const [err, setErr] = useState('');

  const handleConnect = useCallback(async () => {
    setState('connecting');
    setErr('');
    try {
      initLoop(
        (provider) => {
          connectWallet(provider);
          onConnected({ provider, partyId: provider.party_id, email: provider.email });
          onClose();
        },
        () => { setState('idle'); setErr('Connection rejected. Please try again.'); }
      );
      loop.connect();
    } catch (e) {
      setState('error');
      setErr(e.message || 'Failed to connect');
    }
  }, [onClose, onConnected]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(5,8,17,0.92)',
      backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '36px 40px', width: '100%', maxWidth: 420, textAlign: 'center',
      }}>
        {/* Loop logo */}
        <div style={{ fontSize: 52, marginBottom: 12 }}>⟳</div>
        <h2 style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 8 }}>
          Connect Loop Wallet
        </h2>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
          Canton Loop is the first non-custodial wallet on Canton Network.<br />
          Scan the QR code with your Loop app to connect.
        </p>

        <div style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 24, textAlign: 'left' }}>
          {[
            ['Network', 'Canton Mainnet'],
            ['Token', 'CC (Canton Coin / Amulet)'],
            ['Yield', 'CBTC (Simulated)'],
            ['SDK', '@fivenorth/loop-sdk v0.8'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
              <Mono color={C.muted}>{k}</Mono>
              <Mono color={C.text}>{v}</Mono>
            </div>
          ))}
        </div>

        {err && <div style={{ color: C.danger, fontSize: 12, marginBottom: 16, fontFamily: FONT.mono }}>{err}</div>}

        {state === 'connecting' ? (
          <div style={{ color: C.primary, fontSize: 13, fontFamily: FONT.mono, padding: 16 }}>
            ⏳ Opening Loop wallet… scan the QR code
          </div>
        ) : (
          <Btn onClick={handleConnect} variant="primary" size="lg" style={{ width: '100%', marginBottom: 12 }}>
            Connect with Loop
          </Btn>
        )}

        <p style={{ color: C.muted, fontSize: 11, marginTop: 12 }}>
          Don't have Loop?{' '}
          <a href="https://cantonloop.com" target="_blank" rel="noreferrer"
            style={{ color: C.primary, textDecoration: 'none' }}>Get it here →</a>
        </p>
      </div>
    </div>
  );
}

// ── Stake Modal ───────────────────────────────────────────────────────────
function StakeModal({ onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const num = parseFloat(amount) || 0;
  const tier = num >= STAKING_CONFIG.minStake ? getTier(num) : null;

  const handle = async () => {
    if (!num || num < STAKING_CONFIG.minStake) return;
    setState('pending'); setMsg('Submitting stake to Canton ledger…');
    await new Promise(r => setTimeout(r, 1400));
    try {
      const stake = stakeCC(num);
      setState('success'); setMsg(`Staked ${num} CC successfully! Stake ID: ${stake.id}`);
      setTimeout(() => { onSuccess(stake); onClose(); }, 2000);
    } catch (e) {
      setState('error'); setMsg(e.message);
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1800, background: 'rgba(5,8,17,0.9)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, width: '100%', maxWidth: 460 }}>
        <h2 style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>Stake CC</h2>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Stake Canton Coin to earn CBTC yield and mint a Yield NFT.</p>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6, letterSpacing: '0.08em' }}>AMOUNT (CC)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={amount} onChange={e => setAmount(e.target.value)} type="number" min="10" step="10"
              placeholder={`Min ${STAKING_CONFIG.minStake} CC`}
              style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, fontFamily: FONT.mono, outline: 'none' }}
            />
            <Btn onClick={() => setAmount(String(Math.floor(ledger.ccBalance)))} variant="ghost" size="sm">MAX</Btn>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <Mono>Balance: {fmt(ledger.ccBalance)} CC</Mono>
            {tier && <Tag color={tier.rarityColor}>{tier.rarityLabel}</Tag>}
          </div>
        </div>

        {tier && (
          <div style={{ background: C.faint, borderRadius: 10, padding: 14, marginBottom: 18, border: `1px solid ${C.border}` }}>
            {[
              ['Tier', tier.label],
              ['CBTC APY', `${tier.cbTcAPY}%`],
              ['Rarity', tier.rarityLabel],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Mono color={C.muted}>{k}</Mono>
                <Mono color={C.text}>{v}</Mono>
              </div>
            ))}
          </div>
        )}

        <StatusBar state={state} msg={msg} />
        {/* Tier quick-select */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {STAKING_CONFIG.tiers.map(t => (
            <button key={t.label} onClick={() => setAmount(String(t.minCC))}
              style={{ background: C.faint, border: `1px solid ${t.rarityColor}44`, borderRadius: 6, padding: '5px 10px', color: t.rarityColor, fontSize: 11, cursor: 'pointer', fontFamily: FONT.body, fontWeight: 600 }}>
              {t.label} {t.minCC}+
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={handle} disabled={!num || num < STAKING_CONFIG.minStake || state === 'pending'} variant="primary" style={{ flex: 1 }}>
            {state === 'pending' ? 'Staking…' : 'Stake CC'}
          </Btn>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ── NFT Detail Modal ───────────────────────────────────────────────────────
function NFTDetailModal({ nft, onClose, wallet, onAction }) {
  const [tab, setTab] = useState('details');
  const [bidAmt, setBidAmt] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [listToken, setListToken] = useState('CC');
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const isOwner = nft.owner === (wallet?.partyId || '');

  const run = async (fn, label) => {
    setState('pending'); setMsg(`${label}…`);
    await new Promise(r => setTimeout(r, 1000));
    try {
      const r = fn();
      setState('success'); setMsg(`${label} successful`);
      setTimeout(() => { onAction(); onClose(); }, 1800);
      return r;
    } catch (e) {
      setState('error'); setMsg(e.message);
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1800, background: 'rgba(5,8,17,0.9)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, width: '100%', maxWidth: 660, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        {/* Left: art */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${nft.rarityColor}44` }}>
            <NFTCanvas nft={nft} size={240} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, justifyContent: 'center' }}>
            <Tag color={nft.rarityColor}>{nft.rarity}</Tag>
            <Tag color={C.primary}>EPOCH {nft.epoch}</Tag>
          </div>
        </div>
        {/* Right: info */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>{nft.name}</h2>
          <Mono>#{nft.num} · {nft.tier} Tier</Mono>
          <div style={{ height: 1, background: C.border, margin: '14px 0' }} />

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Staked CC', `${fmt(nft.stakedCC)}`],
              ['APY', `${nft.apy}%`],
              ['Accrued CBTC', fmtBtc(nft.accruedCBTC)],
              ['Contract', shortId(nft.contractId)],
            ].map(([k, v]) => (
              <div key={k} style={{ background: C.faint, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 2, letterSpacing: '0.08em' }}>{k}</div>
                <Mono color={C.text} size={13}>{v}</Mono>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {['details', isOwner ? 'manage' : 'buy'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ background: tab === t ? C.primary : C.faint, border: 'none', borderRadius: 6, padding: '6px 14px', color: tab === t ? '#fff' : C.muted, fontSize: 12, cursor: 'pointer', fontFamily: FONT.body, fontWeight: 600, textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'details' && (
            <div>
              {nft.listed && (
                <div style={{ background: C.faint, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>LISTING PRICE</div>
                  <Mono color={nft.listingToken === 'CBTC' ? C.cbtc : C.secondary} size={18}>{fmt(nft.listingPrice)} {nft.listingToken}</Mono>
                  {nft.highBid > 0 && <div style={{ marginTop: 6 }}><Mono color={C.muted}>Highest bid: </Mono><Mono color={C.primary}>{fmt(nft.highBid)} {nft.listingToken}</Mono></div>}
                </div>
              )}
              <Mono color={C.muted} size={11}>Contract ID</Mono>
              <Mono color={C.text} size={10} style={{ display: 'block', marginTop: 2, wordBreak: 'break-all' }}>{nft.contractId}</Mono>
            </div>
          )}

          {tab === 'buy' && !isOwner && (
            <div>
              {nft.listed ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>PRICE</div>
                    <Mono color={C.secondary} size={20}>{fmt(nft.listingPrice)} {nft.listingToken}</Mono>
                  </div>
                  <Btn onClick={() => run(() => buyNFT(nft.id), `Buy ${nft.name}`)} variant="primary" style={{ width: '100%', marginBottom: 10 }} disabled={state === 'pending'}>
                    Buy Now — {fmt(nft.listingPrice)} {nft.listingToken}
                  </Btn>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input value={bidAmt} onChange={e => setBidAmt(e.target.value)} type="number" placeholder="Bid amount"
                      style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 12px', color: C.text, fontSize: 13, fontFamily: FONT.mono, outline: 'none' }} />
                    <Btn onClick={() => run(() => placeBid(nft.id, parseFloat(bidAmt), nft.listingToken), 'Bid')} variant="ghost" disabled={!bidAmt || state === 'pending'}>Bid</Btn>
                  </div>
                </>
              ) : <Mono color={C.muted}>This NFT is not currently listed for sale.</Mono>}
            </div>
          )}

          {tab === 'manage' && isOwner && (
            <div>
              {!nft.listed ? (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={listPrice} onChange={e => setListPrice(e.target.value)} type="number" placeholder="Price"
                      style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 12px', color: C.text, fontSize: 13, fontFamily: FONT.mono, outline: 'none' }} />
                    <select value={listToken} onChange={e => setListToken(e.target.value)}
                      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none' }}>
                      <option>CC</option><option>CBTC</option>
                    </select>
                  </div>
                  <Btn onClick={() => run(() => listNFT(nft.id, parseFloat(listPrice), listToken), 'List NFT')} variant="primary" style={{ width: '100%', marginBottom: 8 }} disabled={!listPrice || state === 'pending'}>List for Sale</Btn>
                </>
              ) : (
                <Btn onClick={() => run(() => delistNFT(nft.id), 'Delist NFT')} variant="danger" style={{ width: '100%', marginBottom: 8 }} disabled={state === 'pending'}>Delist NFT</Btn>
              )}
              {nft.accruedCBTC > 0 && (
                <Btn onClick={() => run(() => claimYield(nft.id), 'Claim yield')} variant="cbtc" style={{ width: '100%' }} disabled={state === 'pending'}>
                  Claim {fmtBtc(nft.accruedCBTC)} CBTC
                </Btn>
              )}
            </div>
          )}

          <StatusBar state={state} msg={msg} />
        </div>
      </div>
    </div>
  );
}

// ── NFT Card ──────────────────────────────────────────────────────────────
function NFTCard({ nft, onClick, size = 'md' }) {
  const [hov, setHov] = useState(false);
  const sz = size === 'sm' ? 140 : 200;
  return (
    <div
      onClick={() => onClick(nft)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.cardHov : C.card,
        border: `1px solid ${hov ? nft.rarityColor + '66' : C.border}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 12px 40px ${nft.rarityColor}22` : 'none',
        transition: 'all 0.18s',
      }}
    >
      <div style={{ position: 'relative' }}>
        <NFTCanvas nft={nft} size={sz} />
        {nft.listed && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: C.success + 'DD', borderRadius: 4, padding: '2px 7px', fontSize: 9, fontWeight: 700, color: '#050811' }}>LISTED</div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <Tag color={nft.rarityColor}>{nft.rarity}</Tag>
        </div>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{nft.name}</div>
        <Mono>#{nft.num} · {nft.tier}</Mono>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 1 }}>{nft.listed ? 'PRICE' : 'STAKED'}</div>
            <Mono color={nft.listed ? C.secondary : C.primary} size={13}>
              {nft.listed ? `${fmt(nft.listingPrice)} ${nft.listingToken}` : `${fmt(nft.stakedCC)} CC`}
            </Mono>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 1 }}>YIELD</div>
            <Mono color={C.cbtc} size={12}>₿ {fmtBtc(nft.accruedCBTC)}</Mono>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────
function StatsBar() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(x => x+1), 3000); return () => clearInterval(t); }, []);
  const stats = [
    { label: 'CC STAKED', value: fmt(ledger.totalCCStaked + tick * 17) },
    { label: 'CBTC DISTRIBUTED', value: fmtBtc(ledger.totalCBTCDistributed + tick * 0.000003) },
    { label: 'NFTs MINTED', value: String(ledger.totalNFTsMinted + Math.floor(tick / 4)) },
    { label: 'CURRENT EPOCH', value: `#${ledger.currentEpoch}` },
    { label: 'NEXT EPOCH', value: `${ledger.nextEpochHours - Math.floor(tick/12)}h` },
  ];
  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 0', overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 0, minWidth: 600, maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center', borderRight: i < stats.length - 1 ? `1px solid ${C.border}` : 'none', padding: '0 16px' }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.1em', marginBottom: 2 }}>{s.label}</div>
            <Mono color={C.text} size={13}>{s.value}</Mono>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [wallet, setWallet] = useState(null);
  const [tab, setTab] = useState('market');
  const [walletModal, setWalletModal] = useState(false);
  const [stakeModal, setStakeModal] = useState(false);
  const [detailNFT, setDetailNFT] = useState(null);
  const [toast, setToast] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState('all'); // all | cc | cbtc
  const [search, setSearch] = useState('');

  // Yield accrual ticker
  useEffect(() => {
    const t = setInterval(() => { accrueYield(); setRefresh(x => x+1); }, 5000);
    return () => clearInterval(t);
  }, []);

  // Auto-reconnect on reload
  useEffect(() => {
    initLoop(
      (provider) => { connectWallet(provider); setWallet({ provider, partyId: provider.party_id, email: provider.email }); },
      () => {}
    );
    loop.autoConnect().catch(() => {});
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDisconnect = async () => {
    await loop.logout();
    disconnectWallet();
    setWallet(null);
    showToast('Wallet disconnected', 'info');
  };

  const handleConnected = (info) => {
    setWallet(info);
    showToast(`Connected: ${info.partyId?.slice(0, 20)}…`, 'success');
  };

  // Filtered market NFTs
  const marketNFTs = useMemo(() => {
    let list = ledger.marketNFTs.filter(n => n.listed);
    if (filter === 'cc') list = list.filter(n => n.listingToken === 'CC');
    if (filter === 'cbtc') list = list.filter(n => n.listingToken === 'CBTC');
    if (search) list = list.filter(n => n.name.toLowerCase().includes(search.toLowerCase()) || n.tier.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [refresh, filter, search]);

  const NAV = [
    { id: 'market', label: 'Marketplace' },
    { id: 'stake', label: 'Stake' },
    { id: 'my-nfts', label: 'My NFTs' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <>
      <style>{`
        ${FONTS}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; color: ${C.text}; font-family: ${FONT.body}; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: ${C.muted}; }
        select { cursor: pointer; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideIn { from{transform:translateY(20px);opacity:0} to{transform:none;opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>◈</div>
            <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 17, color: C.text }}>PoY <span style={{ color: C.primary }}>Market</span></span>
            <Tag color={C.secondary}>CANTON</Tag>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: 2, flex: 1, marginLeft: 16 }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ background: tab === n.id ? C.faint : 'transparent', border: 'none', borderRadius: 7, padding: '6px 14px', color: tab === n.id ? C.text : C.muted, fontSize: 13, cursor: 'pointer', fontFamily: FONT.body, fontWeight: 600, transition: 'all 0.15s' }}>
                {n.label}
              </button>
            ))}
          </nav>

          {/* Wallet */}
          {wallet ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', display: 'flex', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: C.muted }}>CC</div>
                  <Mono color={C.secondary} size={12}>{fmt(ledger.ccBalance)}</Mono>
                </div>
                <div style={{ width: 1, background: C.border }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: C.muted }}>CBTC</div>
                  <Mono color={C.cbtc} size={12}>{fmtBtc(ledger.cbtcBalance)}</Mono>
                </div>
              </div>
              <div style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px' }}>
                <div style={{ fontSize: 9, color: C.muted }}>PARTY</div>
                <Mono size={11}>{shortId(wallet.partyId || 'demo')}</Mono>
              </div>
              <Btn onClick={handleDisconnect} variant="ghost" size="sm">Disconnect</Btn>
            </div>
          ) : (
            <Btn onClick={() => setWalletModal(true)} variant="primary">Connect Loop</Btn>
          )}
        </div>
      </header>

      {/* Stats ticker */}
      <StatsBar />

      {/* Main content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px', animation: 'fadeIn 0.3s ease' }}>

        {/* ── MARKETPLACE TAB ── */}
        {tab === 'market' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: C.text }}>
                  Yield NFT <span style={{ color: C.primary }}>Marketplace</span>
                </h1>
                <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{marketNFTs.length} NFTs listed · Buy with CC or CBTC</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search NFTs…"
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.text, fontSize: 13, fontFamily: FONT.body, outline: 'none', width: 180 }} />
                {['all', 'cc', 'cbtc'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ background: filter === f ? C.primary : C.card, border: `1px solid ${filter === f ? C.primary : C.border}`, borderRadius: 8, padding: '8px 14px', color: filter === f ? '#fff' : C.muted, fontSize: 12, cursor: 'pointer', fontFamily: FONT.body, fontWeight: 600, textTransform: 'uppercase' }}>
                    {f === 'all' ? 'All' : f === 'cc' ? '◈ CC' : '₿ CBTC'}
                  </button>
                ))}
              </div>
            </div>

            {marketNFTs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
                <div>No NFTs found matching your filters.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 18 }}>
                {marketNFTs.map(nft => <NFTCard key={nft.id} nft={nft} onClick={setDetailNFT} />)}
              </div>
            )}
          </div>
        )}

        {/* ── STAKE TAB ── */}
        {tab === 'stake' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: C.text }}>
                  Stake <span style={{ color: C.secondary }}>CC</span> → Earn <span style={{ color: C.cbtc }}>CBTC</span>
                </h1>
                <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Stake Canton Coin to earn simulated CBTC yield rewards and mint Yield NFTs.</p>
              </div>
              {wallet && <Btn onClick={() => setStakeModal(true)} variant="primary" size="lg">+ New Stake</Btn>}
            </div>

            {/* Tier cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16, marginBottom: 32 }}>
              {STAKING_CONFIG.tiers.map(tier => (
                <Card key={tier.label} glow style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 18, color: C.text }}>{tier.label}</div>
                      <Tag color={tier.rarityColor} style={{ marginTop: 4 }}>{tier.rarityLabel}</Tag>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: C.muted }}>CBTC APY</div>
                      <Mono color={C.cbtc} size={20}>{tier.cbTcAPY}%</Mono>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    Min: <Mono color={C.text}>{fmt(tier.minCC)} CC</Mono>
                    {tier.maxCC < Infinity && <> · Max: <Mono color={C.text}>{fmt(tier.maxCC)} CC</Mono></>}
                  </div>
                  {wallet && (
                    <Btn onClick={() => setStakeModal(true)} variant="ghost" size="sm" style={{ marginTop: 12, width: '100%' }}>
                      Stake Now
                    </Btn>
                  )}
                </Card>
              ))}
            </div>

            {/* Active stakes */}
            {wallet && ledger.stakes.length > 0 && (
              <div>
                <h2 style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 14 }}>Your Stakes</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ledger.stakes.map(stake => {
                    const [mintState, setMintState] = useState('idle');
                    const [mintMsg, setMintMsg] = useState('');
                    return (
                      <Card key={stake.id} style={{ padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <div><div style={{ fontSize: 9, color: C.muted }}>STAKE ID</div><Mono>{stake.id}</Mono></div>
                            <div><div style={{ fontSize: 9, color: C.muted }}>AMOUNT</div><Mono color={C.secondary}>{fmt(stake.ccAmount)} CC</Mono></div>
                            <div><div style={{ fontSize: 9, color: C.muted }}>TIER</div><Mono color={C.text}>{stake.tier}</Mono></div>
                            <div><div style={{ fontSize: 9, color: C.muted }}>APY</div><Mono color={C.cbtc}>{stake.apy}%</Mono></div>
                            <div><div style={{ fontSize: 9, color: C.muted }}>ACCRUED CBTC</div><Mono color={C.cbtc}>₿ {fmtBtc(stake.accruedCBTC)}</Mono></div>
                          </div>
                          {!stake.nftId ? (
                            <Btn size="sm" variant="primary" disabled={mintState === 'pending'}
                              onClick={async () => {
                                setMintState('pending'); setMintMsg('Minting…');
                                await new Promise(r => setTimeout(r, 1200));
                                try {
                                  mintYieldNFT(stake.id);
                                  setMintState('success'); setMintMsg('NFT minted!');
                                  setRefresh(x => x+1);
                                  setTimeout(() => { setMintState('idle'); setMintMsg(''); }, 3000);
                                } catch (e) {
                                  setMintState('error'); setMintMsg(e.message);
                                  setTimeout(() => setMintState('idle'), 3000);
                                }
                              }}>
                              {mintState === 'pending' ? 'Minting…' : '⬡ Mint Yield NFT'}
                            </Btn>
                          ) : <Tag color={C.success}>NFT MINTED ✓</Tag>}
                        </div>
                        <StatusBar state={mintState} msg={mintMsg} />
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {!wallet && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>⟳</div>
                <h3 style={{ fontFamily: FONT.display, fontSize: 18, color: C.text, marginBottom: 8 }}>Connect your Loop wallet to start staking</h3>
                <Btn onClick={() => setWalletModal(true)} variant="primary" size="lg" style={{ marginTop: 8 }}>Connect Loop</Btn>
              </div>
            )}
          </div>
        )}

        {/* ── MY NFTS TAB ── */}
        {tab === 'my-nfts' && (
          <div>
            <h1 style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 8 }}>
              My <span style={{ color: C.primary }}>NFTs</span>
            </h1>
            {!wallet ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>🔐</div>
                <Btn onClick={() => setWalletModal(true)} variant="primary" size="lg">Connect Wallet</Btn>
              </div>
            ) : ledger.myNFTs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>◈</div>
                <p>No NFTs yet. Stake CC and mint your first Yield NFT.</p>
                <Btn onClick={() => setTab('stake')} variant="primary" size="lg" style={{ marginTop: 16 }}>Go to Stake</Btn>
              </div>
            ) : (
              <>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>{ledger.myNFTs.length} NFTs owned</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 18 }}>
                  {ledger.myNFTs.map(nft => <NFTCard key={nft.id} nft={nft} onClick={setDetailNFT} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <div>
            <h1 style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 20 }}>
              Activity <span style={{ color: C.primary }}>Log</span>
            </h1>
            {ledger.activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>No activity yet. Connect wallet and start staking.</div>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                {ledger.activity.map((a, i) => {
                  const typeColor = { Staked: C.primary, Minted: C.secondary, Claimed: C.cbtc, Listed: C.success, Delisted: C.muted, Bought: C.success, Bid: C.primary }[a.type] || C.muted;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < ledger.activity.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <Tag color={typeColor}>{a.type.toUpperCase()}</Tag>
                      <div style={{ flex: 1, fontSize: 13, color: C.text }}>{a.message}</div>
                      <Mono color={C.muted}>{shortId(a.txId)}</Mono>
                      <Mono color={C.muted}>{ago(a.time)}</Mono>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {walletModal && <WalletModal onClose={() => setWalletModal(false)} onConnected={handleConnected} />}
      {stakeModal && <StakeModal onClose={() => setStakeModal(false)} onSuccess={() => { setRefresh(x => x+1); showToast('CC staked successfully!'); }} />}
      {detailNFT && <NFTDetailModal nft={detailNFT} onClose={() => setDetailNFT(null)} wallet={wallet} onAction={() => setRefresh(x => x+1)} />}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 3000,
          background: toast.type === 'error' ? C.danger : C.success,
          color: '#050811', borderRadius: 10, padding: '12px 20px',
          fontSize: 13, fontWeight: 600, fontFamily: FONT.body,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.25s ease',
        }}>{toast.msg}</div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '20px 24px', marginTop: 48, textAlign: 'center' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Mono color={C.muted}>PoY Market — Canton Network · Demo/Showcase</Mono>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="https://cantonloop.com" target="_blank" rel="noreferrer" style={{ color: C.muted, fontSize: 12, textDecoration: 'none' }}>Canton Loop</a>
            <a href="https://canton.network" target="_blank" rel="noreferrer" style={{ color: C.muted, fontSize: 12, textDecoration: 'none' }}>Canton Network</a>
            <a href="https://docs.fivenorth.io/loop-sdk/overview/" target="_blank" rel="noreferrer" style={{ color: C.muted, fontSize: 12, textDecoration: 'none' }}>Loop SDK Docs</a>
          </div>
        </div>
      </footer>
    </>
  );
}
