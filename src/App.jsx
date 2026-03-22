/**
 * Canton PoY Market — App.jsx v2 (Time-Lock Staking)
 * Longer lock + more CC = higher CBTC yield
 * NFT floor price rises as position approaches maturity
 * Stake positions are fully tradeable — buyer inherits lock
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { loop } from '@fivenorth/loop-sdk';
import {
  ledger, STAKING_CONFIG, LOCK_OPTIONS,
  getTier, getLockOption, getEffectiveAPY, getMaturity, getFloorPrice, timeRemaining,
  connectWallet, disconnectWallet,
  stakeCC, mintYieldNFT, claimYield, accrueYield,
  earlyUnlock, matureUnlock,
  listNFT, delistNFT, buyNFT, placeBid,
} from './canton-store.js';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;700&display=swap');`;
const C = {
  bg:'#050811',surface:'#0A0F1E',card:'#0E1528',cardHov:'#131C34',
  border:'#1A2540',borderHov:'#2A3E6A',
  primary:'#3B7EFF',secondary:'#F5A623',cbtc:'#F7931A',
  success:'#00D9A3',danger:'#FF4D6A',
  text:'#EDF2FF',muted:'#5A6A8A',faint:'#1E2C4A',
  glow:'rgba(59,126,255,0.18)',
};
const FONT={display:"'Syne',sans-serif",body:"'Space Grotesk',sans-serif",mono:"'JetBrains Mono',monospace"};

// Loop SDK
let loopProvider=null,loopInitialized=false;
function initLoop(onAccept,onReject){
  if(loopInitialized)return;loopInitialized=true;
  loop.init({appName:'PoY Market',network:'mainnet',options:{openMode:'popup',requestSigningMode:'popup'},
    onAccept:(p)=>{loopProvider=p;onAccept(p);},
    onReject:()=>{loopProvider=null;loopInitialized=false;onReject();},
    onTransactionUpdate:(p)=>console.log('[Canton]',p),
  });
}

// Helpers
const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtBtc=(n)=>Number(n).toFixed(8);
const pct=(n)=>(Math.min(1,n)*100).toFixed(1)+'%';
const ago=(ms)=>{const s=Math.floor((Date.now()-ms)/1000);if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;return`${Math.floor(s/3600)}h ago`;};
const shortId=(id='')=>id.slice(0,6)+'…'+id.slice(-4);

// Primitives
function Mono({children,size=12,color=C.muted,style={}}){return<span style={{fontFamily:FONT.mono,fontSize:size,color,...style}}>{children}</span>;}
function Tag({children,color=C.primary,style={}}){return<span style={{background:color+'18',color,border:`1px solid ${color}33`,borderRadius:4,padding:'2px 7px',fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:FONT.mono,...style}}>{children}</span>;}

function Btn({children,onClick,disabled,variant='primary',size='md',style={}}){
  const[hov,setHov]=useState(false);
  const pad={sm:'7px 16px',md:'10px 22px',lg:'13px 32px'}[size];
  const fs=size==='sm'?12:size==='lg'?15:13;
  const base={border:'none',borderRadius:8,cursor:disabled?'not-allowed':'pointer',fontFamily:FONT.body,fontWeight:600,padding:pad,fontSize:fs,opacity:disabled?0.45:1,transition:'all 0.15s',transform:hov&&!disabled?'translateY(-1px)':'none'};
  const vs={primary:{background:hov?'#5B9EFF':C.primary,color:'#fff',boxShadow:hov?`0 6px 24px ${C.glow}`:'none'},ghost:{background:hov?C.faint:'transparent',color:C.text,border:`1px solid ${C.border}`},danger:{background:hov?'#FF7090':C.danger,color:'#fff'},cbtc:{background:hov?'#FFB03A':C.cbtc,color:'#050811'},success:{background:hov?'#33E8BB':C.success,color:'#050811'}};
  return<button onClick={disabled?undefined:onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{...base,...vs[variant],...style}}>{children}</button>;
}

function Card({children,style={},glow=false}){
  const[hov,setHov]=useState(false);
  return<div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{background:hov?C.cardHov:C.card,border:`1px solid ${hov?C.borderHov:C.border}`,borderRadius:16,transition:'all 0.2s',boxShadow:glow&&hov?`0 8px 40px ${C.glow}`:'none',...style}}>{children}</div>;
}

function StatusBar({state,msg}){
  if(!msg||state==='idle')return null;
  const col={pending:C.primary,success:C.success,error:C.danger}[state]||C.primary;
  return<div style={{margin:'10px 0',padding:'8px 14px',borderRadius:8,fontSize:12,background:col+'18',color:col,border:`1px solid ${col}33`,fontFamily:FONT.mono}}>{state==='pending'&&'⏳ '}{state==='success'&&'✓ '}{state==='error'&&'✗ '}{msg}</div>;
}

// Maturity Progress Bar
function MaturityBar({nft,showLabel=true}){
  const mat=getMaturity(nft.startTime,nft.lockMs);
  const matured=Date.now()>=nft.lockExpiry;
  const barCol=matured?C.success:(nft.lockColor||C.primary);
  return(
    <div>
      {showLabel&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><Mono size={10} color={C.muted}>MATURITY</Mono><Mono size={10} color={matured?C.success:C.text}>{matured?'✓ MATURED':timeRemaining(nft.lockExpiry)}</Mono></div>}
      <div style={{height:4,background:C.faint,borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:pct(mat),background:barCol,borderRadius:4,transition:'width 0.5s ease'}}/></div>
      {showLabel&&<div style={{display:'flex',justifyContent:'space-between',marginTop:4}}><Mono size={9} color={C.muted}>{pct(mat)} complete</Mono><Mono size={9} color={barCol}>Floor ◈{fmt(nft.floorPrice)}</Mono></div>}
    </div>
  );
}

// NFT Canvas — maturity fills the inner hex
function NFTCanvas({nft,size=200}){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext('2d'),w=size,h=size;
    ctx.clearRect(0,0,w,h);
    const mat=getMaturity(nft.startTime,nft.lockMs);
    const bg=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/1.4);
    bg.addColorStop(0,nft.rarityColor+(Math.round(0x22+mat*0x44).toString(16).padStart(2,'0')));
    bg.addColorStop(1,'#050811');
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=nft.rarityColor+'18';ctx.lineWidth=0.5;
    for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(i*w/5,0);ctx.lineTo(i*w/5,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*h/5);ctx.lineTo(w,i*h/5);ctx.stroke();}
    const hex=(r)=>{ctx.beginPath();for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6,x=w/2+r*Math.cos(a),y=h/2+r*Math.sin(a);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.closePath();};
    hex(w*0.28);ctx.strokeStyle=nft.rarityColor+'AA';ctx.lineWidth=1.5;ctx.stroke();
    hex(w*0.16);
    const fill=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w*0.16);
    const alpha=Math.round(0x22+mat*0xBB).toString(16).padStart(2,'0');
    fill.addColorStop(0,nft.rarityColor+alpha);fill.addColorStop(1,nft.rarityColor+'11');
    ctx.fillStyle=fill;ctx.fill();ctx.stroke();
    // Maturity arc
    ctx.beginPath();ctx.arc(w/2,h/2,w*0.38,-Math.PI/2,-Math.PI/2+mat*2*Math.PI);
    ctx.strokeStyle=Date.now()>=nft.lockExpiry?C.success:(nft.lockColor||C.primary);ctx.lineWidth=2;ctx.stroke();
    ctx.font=`${w*0.18}px ${FONT.mono}`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=nft.rarityColor+'DD';ctx.fillText(nft.art,w/2,h/2);
    ctx.font=`600 ${w*0.07}px ${FONT.body}`;ctx.fillStyle=nft.lockColor||C.muted;
    ctx.fillText(nft.lockBadge||nft.lockLabel,w/2,h*0.82);
  },[nft,size]);
  return<canvas ref={ref} width={size} height={size} style={{display:'block'}}/>;
}

// Wallet Modal
function WalletModal({onClose,onConnected}){
  const[state,setState]=useState('idle');const[err,setErr]=useState('');
  const handleConnect=useCallback(async()=>{
    setState('connecting');setErr('');
    try{
      initLoop((p)=>{connectWallet(p);onConnected({provider:p,partyId:p.party_id,email:p.email});onClose();}
        ,()=>{setState('idle');setErr('Connection rejected. Please try again.');});
      loop.connect();
    }catch(e){setState('error');setErr(e.message||'Failed to connect');}
  },[onClose,onConnected]);
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(5,8,17,0.92)',backdropFilter:'blur(20px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:'36px 40px',width:'100%',maxWidth:420,textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>⟳</div>
        <h2 style={{fontFamily:FONT.display,fontSize:24,fontWeight:800,color:C.text,marginBottom:8}}>Connect Loop Wallet</h2>
        <p style={{color:C.muted,fontSize:13,marginBottom:24,lineHeight:1.6}}>Canton Loop — non-custodial wallet on Canton Network.<br/>Scan the QR code with your Loop app.</p>
        <div style={{background:C.faint,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 16px',marginBottom:24,textAlign:'left'}}>
          {[['Network','Canton Mainnet'],['Token','CC (Canton Coin)'],['Yield','CBTC (Simulated)'],['SDK','@fivenorth/loop-sdk v0.8']].map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}><Mono color={C.muted}>{k}</Mono><Mono color={C.text}>{v}</Mono></div>
          ))}
        </div>
        {err&&<div style={{color:C.danger,fontSize:12,marginBottom:16,fontFamily:FONT.mono}}>{err}</div>}
        {state==='connecting'
          ?<div style={{color:C.primary,fontSize:13,fontFamily:FONT.mono,padding:16}}>⏳ Opening Loop wallet… scan the QR code</div>
          :<Btn onClick={handleConnect} variant="primary" size="lg" style={{width:'100%',marginBottom:12}}>Connect with Loop</Btn>}
        <p style={{color:C.muted,fontSize:11,marginTop:12}}>Don't have Loop? <a href="https://cantonloop.com" target="_blank" rel="noreferrer" style={{color:C.primary,textDecoration:'none'}}>Get it here →</a></p>
      </div>
    </div>
  );
}

// Stake Modal — with lock duration picker
function StakeModal({onClose,onSuccess}){
  const[amount,setAmount]=useState('');
  const[lockDays,setLockDays]=useState(30);
  const[state,setState]=useState('idle');
  const[msg,setMsg]=useState('');
  const num=parseFloat(amount)||0;
  const tier=num>=STAKING_CONFIG.minStake?getTier(num):null;
  const lock=getLockOption(lockDays);
  const effectiveAPY=tier&&lock?getEffectiveAPY(num,lockDays):null;
  const previewFloor=tier?getFloorPrice(num,0):null;
  const previewMature=tier?getFloorPrice(num,1):null;

  const handle=async()=>{
    if(!num||num<STAKING_CONFIG.minStake)return;
    setState('pending');setMsg('Submitting time-lock stake to Canton ledger…');
    await new Promise(r=>setTimeout(r,1400));
    try{const stake=stakeCC(num,lockDays);setState('success');setMsg(`Locked ${num} CC for ${lock.label} @ ${effectiveAPY}% APY`);setTimeout(()=>{onSuccess(stake);onClose();},2000);}
    catch(e){setState('error');setMsg(e.message);setTimeout(()=>setState('idle'),3000);}
  };

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:1800,background:'rgba(5,8,17,0.9)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:32,width:'100%',maxWidth:520}}>
        <h2 style={{fontFamily:FONT.display,fontSize:22,fontWeight:800,color:C.text,marginBottom:4}}>Time-Lock Stake</h2>
        <p style={{color:C.muted,fontSize:13,marginBottom:24}}>Longer lock + more CC = higher CBTC yield. Your NFT floor price rises as it matures.</p>

        {/* Amount */}
        <div style={{marginBottom:18}}>
          <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:6,letterSpacing:'0.08em'}}>AMOUNT (CC)</label>
          <div style={{display:'flex',gap:8}}>
            <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="10" step="10" placeholder={`Min ${STAKING_CONFIG.minStake} CC`}
              style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',color:C.text,fontSize:14,fontFamily:FONT.mono,outline:'none'}}/>
            <Btn onClick={()=>setAmount(String(Math.floor(ledger.ccBalance)))} variant="ghost" size="sm">MAX</Btn>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
            <Mono>Balance: {fmt(ledger.ccBalance)} CC</Mono>
            {tier&&<Tag color={tier.rarityColor}>{tier.rarityLabel} · Base {tier.baseAPY}% APY</Tag>}
          </div>
        </div>

        {/* Lock duration */}
        <div style={{marginBottom:18}}>
          <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:8,letterSpacing:'0.08em'}}>LOCK DURATION</label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
            {LOCK_OPTIONS.map(opt=>{
              const sel=lockDays===opt.days;
              return(
                <button key={opt.days} onClick={()=>setLockDays(opt.days)} style={{background:sel?opt.color+'22':C.faint,border:`1px solid ${sel?opt.color:C.border}`,borderRadius:8,padding:'8px 4px',cursor:'pointer',textAlign:'center',transition:'all 0.15s'}}>
                  <div style={{fontFamily:FONT.mono,fontSize:12,fontWeight:700,color:sel?opt.color:C.text}}>{opt.shortLabel}</div>
                  <div style={{fontSize:9,color:sel?opt.color:C.muted,marginTop:2}}>{opt.multiplier}×</div>
                  <div style={{fontSize:8,color:sel?opt.color:C.muted,marginTop:1}}>{opt.badge}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {tier&&effectiveAPY&&(
          <div style={{background:C.faint,borderRadius:12,padding:16,marginBottom:18,border:`1px solid ${lock.color}33`}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
              {[['Effective APY',`${effectiveAPY}%`,C.cbtc],['Lock Bonus',`${lock.multiplier}×`,lock.color],['Duration',lock.label,C.text]].map(([k,v,col])=>(
                <div key={k}><div style={{fontSize:9,color:C.muted,marginBottom:3,letterSpacing:'0.07em'}}>{k}</div><Mono color={col} size={14}>{v}</Mono></div>
              ))}
            </div>
            {previewFloor&&(
              <div style={{paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.muted,marginBottom:4}}>NFT FLOOR PRICE JOURNEY</div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <Mono size={12}>At mint: ◈{fmt(previewFloor)} CC</Mono>
                  <span style={{color:C.muted}}>→</span>
                  <Mono size={12} color={C.success}>At maturity: ◈{fmt(previewMature)} CC</Mono>
                  <Tag color={C.success}>+{(((previewMature/previewFloor)-1)*100).toFixed(0)}%</Tag>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tier quick-select */}
        <div style={{display:'flex',gap:6,marginBottom:18,flexWrap:'wrap'}}>
          {STAKING_CONFIG.tiers.map(t=>(
            <button key={t.label} onClick={()=>setAmount(String(t.minCC))} style={{background:C.faint,border:`1px solid ${t.rarityColor}44`,borderRadius:6,padding:'5px 10px',color:t.rarityColor,fontSize:11,cursor:'pointer',fontFamily:FONT.body,fontWeight:600}}>
              {t.label} {t.minCC}+
            </button>
          ))}
        </div>

        <StatusBar state={state} msg={msg}/>
        <div style={{display:'flex',gap:10}}>
          <Btn onClick={handle} disabled={!num||num<STAKING_CONFIG.minStake||state==='pending'} variant="primary" style={{flex:1}}>
            {state==='pending'?'Locking…':`Lock ${lock.shortLabel} @ ${effectiveAPY||'—'}% APY`}
          </Btn>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// NFT Detail Modal
function NFTDetailModal({nft:initNft,onClose,wallet,onAction}){
  const[nft,setNft]=useState(initNft);
  const[tab,setTab]=useState('details');
  const[bidAmt,setBidAmt]=useState('');
  const[listPrice,setListPrice]=useState('');
  const[listToken,setListToken]=useState('CC');
  const[state,setState]=useState('idle');
  const[msg,setMsg]=useState('');
  const isOwner=nft.owner===(wallet?.partyId||'');
  const isMatured=Date.now()>=nft.lockExpiry;

  useEffect(()=>{
    const t=setInterval(()=>setNft(prev=>({...prev,floorPrice:getFloorPrice(prev.stakedCC,getMaturity(prev.startTime,prev.lockMs))})),3000);
    return()=>clearInterval(t);
  },[]);

  const run=async(fn,label)=>{
    setState('pending');setMsg(`${label}…`);
    await new Promise(r=>setTimeout(r,1000));
    try{fn();setState('success');setMsg(`${label} successful`);setTimeout(()=>{onAction();onClose();},1800);}
    catch(e){setState('error');setMsg(e.message);setTimeout(()=>setState('idle'),3000);}
  };

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:1800,background:'rgba(5,8,17,0.9)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:32,width:'100%',maxWidth:700,display:'flex',gap:28,flexWrap:'wrap'}}>
        <div style={{flexShrink:0}}>
          <div style={{borderRadius:14,overflow:'hidden',border:`1px solid ${nft.rarityColor}44`}}><NFTCanvas nft={nft} size={240}/></div>
          <div style={{marginTop:10,display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap'}}>
            <Tag color={nft.rarityColor}>{nft.rarity}</Tag>
            <Tag color={nft.lockColor||C.primary}>{nft.lockBadge}</Tag>
            {isMatured&&<Tag color={C.success}>MATURED</Tag>}
          </div>
          <div style={{marginTop:12}}><MaturityBar nft={nft}/></div>
        </div>

        <div style={{flex:1,minWidth:220}}>
          <h2 style={{fontFamily:FONT.display,fontSize:22,fontWeight:800,color:C.text,marginBottom:4}}>{nft.name}</h2>
          <Mono>#{nft.num} · {nft.tier}</Mono>
          <div style={{height:1,background:C.border,margin:'14px 0'}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
            {[['Staked CC',`◈${fmt(nft.stakedCC)}`,C.secondary],['Effective APY',`${nft.effectiveAPY}% CBTC`,C.cbtc],['Lock',nft.lockLabel,nft.lockColor],['Multiplier',`${nft.lockMultiplier}×`,nft.lockColor],['Accrued',`₿${fmtBtc(nft.accruedCBTC)}`,C.cbtc],['Floor Price',`◈${fmt(nft.floorPrice)}`,C.success]].map(([k,v,col])=>(
              <div key={k} style={{background:C.faint,borderRadius:8,padding:'8px 12px'}}>
                <div style={{fontSize:9,color:C.muted,marginBottom:2,letterSpacing:'0.08em'}}>{k}</div>
                <Mono color={col} size={12}>{v}</Mono>
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:4,marginBottom:14,flexWrap:'wrap'}}>
            {['details',isOwner?'manage':'buy'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.primary:C.faint,border:'none',borderRadius:6,padding:'6px 14px',color:tab===t?'#fff':C.muted,fontSize:12,cursor:'pointer',fontFamily:FONT.body,fontWeight:600,textTransform:'capitalize'}}>{t}</button>
            ))}
          </div>

          {tab==='details'&&(
            <div>
              {nft.listed&&<div style={{background:C.faint,borderRadius:10,padding:12,marginBottom:10}}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>LISTING PRICE</div><Mono color={nft.listingToken==='CBTC'?C.cbtc:C.secondary} size={18}>{fmt(nft.listingPrice)} {nft.listingToken}</Mono></div>}
              <div style={{background:C.faint,borderRadius:8,padding:'10px 12px',marginBottom:8}}>
                <div style={{fontSize:9,color:C.muted,marginBottom:4}}>STAKE POSITION NOTE</div>
                <div style={{fontSize:11,color:C.text,lineHeight:1.5}}>Buying this NFT transfers the full stake position — remaining {timeRemaining(nft.lockExpiry)} lock, {fmtBtc(nft.accruedCBTC)} CBTC accrued, and all future yield at {nft.effectiveAPY}% APY.</div>
              </div>
              <Mono color={C.muted} size={10}>Contract ID</Mono>
              <Mono color={C.text} size={10} style={{display:'block',marginTop:2,wordBreak:'break-all'}}>{nft.contractId}</Mono>
            </div>
          )}

          {tab==='buy'&&!isOwner&&(
            <div>
              {nft.listed?(
                <>
                  <div style={{marginBottom:12}}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>PRICE</div><Mono color={C.secondary} size={20}>{fmt(nft.listingPrice)} {nft.listingToken}</Mono></div>
                  <Btn onClick={()=>run(()=>buyNFT(nft.id),`Buy ${nft.name}`)} variant="primary" style={{width:'100%',marginBottom:10}} disabled={state==='pending'}>Buy Stake Position — {fmt(nft.listingPrice)} {nft.listingToken}</Btn>
                  <div style={{display:'flex',gap:8}}>
                    <input value={bidAmt} onChange={e=>setBidAmt(e.target.value)} type="number" placeholder="Bid amount"
                      style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:'8px 12px',color:C.text,fontSize:13,fontFamily:FONT.mono,outline:'none'}}/>
                    <Btn onClick={()=>run(()=>placeBid(nft.id,parseFloat(bidAmt),nft.listingToken),'Bid')} variant="ghost" disabled={!bidAmt||state==='pending'}>Bid</Btn>
                  </div>
                </>
              ):<Mono color={C.muted}>Not listed for sale.</Mono>}
            </div>
          )}

          {tab==='manage'&&isOwner&&(
            <div>
              {nft.accruedCBTC>0&&<Btn onClick={()=>run(()=>claimYield(nft.id),'Claim yield')} variant="cbtc" style={{width:'100%',marginBottom:8}} disabled={state==='pending'}>Claim {fmtBtc(nft.accruedCBTC)} CBTC</Btn>}
              {!nft.listed?(
                <div style={{marginBottom:8}}>
                  <div style={{display:'flex',gap:8,marginBottom:6}}>
                    <input value={listPrice} onChange={e=>setListPrice(e.target.value)} type="number" placeholder={`Floor: ${fmt(nft.floorPrice)}`}
                      style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:'8px 12px',color:C.text,fontSize:13,fontFamily:FONT.mono,outline:'none'}}/>
                    <select value={listToken} onChange={e=>setListToken(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:'8px 12px',color:C.text,fontSize:13,outline:'none'}}><option>CC</option><option>CBTC</option></select>
                  </div>
                  <Btn onClick={()=>run(()=>listNFT(nft.id,parseFloat(listPrice)||nft.floorPrice,listToken),'List NFT')} variant="primary" style={{width:'100%'}} disabled={state==='pending'}>List Position for Sale</Btn>
                </div>
              ):<Btn onClick={()=>run(()=>delistNFT(nft.id),'Delist')} variant="ghost" style={{width:'100%',marginBottom:8}} disabled={state==='pending'}>Delist</Btn>}
              {isMatured?(
                <Btn onClick={()=>run(()=>matureUnlock(nft.id),'Mature unlock')} variant="success" style={{width:'100%'}} disabled={state==='pending'}>✓ Unlock — {fmt(nft.stakedCC)} CC + {fmtBtc(nft.accruedCBTC)} CBTC</Btn>
              ):(
                <div>
                  <div style={{background:`${C.danger}11`,border:`1px solid ${C.danger}22`,borderRadius:8,padding:'8px 12px',marginBottom:6}}>
                    <div style={{fontSize:10,color:C.danger,marginBottom:2}}>EARLY UNLOCK — 20% YIELD PENALTY</div>
                    <div style={{fontSize:11,color:C.muted}}>Penalty: {fmtBtc(nft.accruedCBTC*0.2)} CBTC · Receive: {fmtBtc(nft.accruedCBTC*0.8)} CBTC + {fmt(nft.stakedCC)} CC</div>
                  </div>
                  <Btn onClick={()=>run(()=>earlyUnlock(nft.id),'Early unlock')} variant="danger" style={{width:'100%'}} disabled={state==='pending'}>Early Unlock (20% penalty)</Btn>
                </div>
              )}
            </div>
          )}
          <StatusBar state={state} msg={msg}/>
        </div>
      </div>
    </div>
  );
}

// Stake Row
function StakeRow({stake,onRefresh}){
  const[mintState,setMintState]=useState('idle');
  const[mintMsg,setMintMsg]=useState('');
  const mat=getMaturity(stake.startTime,stake.lockMs);
  const matured=Date.now()>=stake.lockExpiry;
  const handleMint=async()=>{
    setMintState('pending');setMintMsg('Minting…');
    await new Promise(r=>setTimeout(r,1200));
    try{mintYieldNFT(stake.id);setMintState('success');setMintMsg('NFT minted!');onRefresh();setTimeout(()=>{setMintState('idle');setMintMsg('');},3000);}
    catch(e){setMintState('error');setMintMsg(e.message);setTimeout(()=>setMintState('idle'),3000);}
  };
  return(
    <Card style={{padding:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:12}}>
        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          <div><div style={{fontSize:9,color:C.muted}}>ID</div><Mono size={11}>{stake.id}</Mono></div>
          <div><div style={{fontSize:9,color:C.muted}}>AMOUNT</div><Mono color={C.secondary}>◈{fmt(stake.ccAmount)}</Mono></div>
          <div><div style={{fontSize:9,color:C.muted}}>LOCK</div><Mono color={stake.lockColor}>{stake.lockLabel} · {stake.lockMultiplier}×</Mono></div>
          <div><div style={{fontSize:9,color:C.muted}}>APY</div><Mono color={C.cbtc}>{stake.effectiveAPY}%</Mono></div>
          <div><div style={{fontSize:9,color:C.muted}}>ACCRUED</div><Mono color={C.cbtc}>₿{fmtBtc(stake.accruedCBTC)}</Mono></div>
        </div>
        {!stake.nftId?<Btn size="sm" variant="primary" disabled={mintState==='pending'} onClick={handleMint}>{mintState==='pending'?'Minting…':'⬡ Mint NFT'}</Btn>:<Tag color={C.success}>NFT MINTED ✓</Tag>}
      </div>
      <div style={{marginTop:4}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><Mono size={10} color={C.muted}>MATURITY PROGRESS</Mono><Mono size={10} color={matured?C.success:C.text}>{matured?'✓ MATURED':timeRemaining(stake.lockExpiry)}</Mono></div>
        <div style={{height:4,background:C.faint,borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:pct(mat),background:matured?C.success:(stake.lockColor||C.primary),borderRadius:4,transition:'width 0.5s ease'}}/></div>
        <Mono size={9} color={C.muted} style={{display:'block',marginTop:4}}>{pct(mat)} complete</Mono>
      </div>
      <StatusBar state={mintState} msg={mintMsg}/>
    </Card>
  );
}

// NFT Card
function NFTCard({nft,onClick}){
  const[hov,setHov]=useState(false);
  const mat=getMaturity(nft.startTime,nft.lockMs);
  const matured=Date.now()>=nft.lockExpiry;
  return(
    <div onClick={()=>onClick(nft)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?C.cardHov:C.card,border:`1px solid ${hov?nft.rarityColor+'66':C.border}`,borderRadius:16,overflow:'hidden',cursor:'pointer',transform:hov?'translateY(-3px)':'none',boxShadow:hov?`0 12px 40px ${nft.rarityColor}22`:'none',transition:'all 0.18s'}}>
      <div style={{position:'relative'}}>
        <NFTCanvas nft={nft} size={200}/>
        {nft.listed&&<div style={{position:'absolute',top:8,left:8,background:C.success+'DD',borderRadius:4,padding:'2px 7px',fontSize:9,fontWeight:700,color:'#050811'}}>LISTED</div>}
        {matured&&<div style={{position:'absolute',top:8,left:nft.listed?54:8,background:C.primary+'DD',borderRadius:4,padding:'2px 7px',fontSize:9,fontWeight:700,color:'#fff'}}>MATURED</div>}
        <div style={{position:'absolute',top:8,right:8}}><Tag color={nft.rarityColor}>{nft.rarity}</Tag></div>
      </div>
      <div style={{padding:'12px 14px 14px'}}>
        <div style={{fontFamily:FONT.display,fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{nft.name}</div>
        <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
          <Tag color={nft.lockColor||C.primary} style={{fontSize:8}}>{nft.lockBadge} {nft.lockMultiplier}×</Tag>
          <Tag color={C.cbtc} style={{fontSize:8}}>{nft.effectiveAPY}% APY</Tag>
        </div>
        <div style={{height:3,background:C.faint,borderRadius:3,overflow:'hidden',marginBottom:8}}>
          <div style={{height:'100%',width:pct(mat),background:matured?C.success:(nft.lockColor||C.primary),borderRadius:3}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:9,color:C.muted,marginBottom:1}}>{nft.listed?'PRICE':'FLOOR'}</div>
            <Mono color={nft.listed?C.secondary:C.success} size={13}>◈{fmt(nft.listed?nft.listingPrice:nft.floorPrice)}{nft.listed?` ${nft.listingToken}`:''}</Mono>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:C.muted,marginBottom:1}}>YIELD</div>
            <Mono color={C.cbtc} size={12}>₿{fmtBtc(nft.accruedCBTC)}</Mono>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stats Bar
function StatsBar(){
  const[tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),3000);return()=>clearInterval(t);},[]);
  const stats=[{label:'CC STAKED',value:fmt(ledger.totalCCStaked+tick*17)},{label:'CBTC DISTRIBUTED',value:fmtBtc(ledger.totalCBTCDistributed+tick*0.000003)},{label:'NFTs MINTED',value:String(ledger.totalNFTsMinted+Math.floor(tick/4))},{label:'CURRENT EPOCH',value:`#${ledger.currentEpoch}`},{label:'NEXT EPOCH',value:`${Math.max(0,ledger.nextEpochHours-Math.floor(tick/12))}h`}];
  return(
    <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'10px 0',overflowX:'auto'}}>
      <div style={{display:'flex',minWidth:600,maxWidth:1200,margin:'0 auto',padding:'0 24px'}}>
        {stats.map((s,i)=>(
          <div key={s.label} style={{flex:1,textAlign:'center',borderRight:i<stats.length-1?`1px solid ${C.border}`:'none',padding:'0 16px'}}>
            <div style={{fontSize:9,color:C.muted,letterSpacing:'0.1em',marginBottom:2}}>{s.label}</div>
            <Mono color={C.text} size={13}>{s.value}</Mono>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main App
export default function App(){
  const[wallet,setWallet]=useState(null);
  const[tab,setTab]=useState('market');
  const[walletModal,setWalletModal]=useState(false);
  const[stakeModal,setStakeModal]=useState(false);
  const[detailNFT,setDetailNFT]=useState(null);
  const[toast,setToast]=useState(null);
  const[refresh,setRefresh]=useState(0);
  const[filter,setFilter]=useState('all');
  const[sortBy,setSortBy]=useState('maturity');
  const[search,setSearch]=useState('');

  useEffect(()=>{const t=setInterval(()=>{accrueYield();setRefresh(x=>x+1);},5000);return()=>clearInterval(t);},[]);
  useEffect(()=>{initLoop((p)=>{connectWallet(p);setWallet({provider:p,partyId:p.party_id,email:p.email});},()=>{});loop.autoConnect().catch(()=>{});},[]);

  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};
  const handleDisconnect=async()=>{await loop.logout();disconnectWallet();setWallet(null);showToast('Disconnected','info');};
  const handleConnected=(info)=>{setWallet(info);showToast(`Connected: ${info.partyId?.slice(0,20)}…`);};

  const marketNFTs=useMemo(()=>{
    let list=ledger.marketNFTs.filter(n=>n.listed);
    if(filter==='cc')   list=list.filter(n=>n.listingToken==='CC');
    if(filter==='cbtc') list=list.filter(n=>n.listingToken==='CBTC');
    if(search) list=list.filter(n=>n.name.toLowerCase().includes(search.toLowerCase())||n.tier.toLowerCase().includes(search.toLowerCase())||n.lockBadge?.toLowerCase().includes(search.toLowerCase()));
    if(sortBy==='maturity') list=[...list].sort((a,b)=>getMaturity(b.startTime,b.lockMs)-getMaturity(a.startTime,a.lockMs));
    if(sortBy==='price')    list=[...list].sort((a,b)=>b.listingPrice-a.listingPrice);
    if(sortBy==='apy')      list=[...list].sort((a,b)=>b.effectiveAPY-a.effectiveAPY);
    if(sortBy==='newest')   list=[...list].sort((a,b)=>b.createdAt-a.createdAt);
    return list;
  },[refresh,filter,sortBy,search]);

  const NAV=[{id:'market',label:'Marketplace'},{id:'stake',label:'Stake'},{id:'my-nfts',label:'My NFTs'},{id:'activity',label:'Activity'}];

  return(
    <>
      <style>{`${FONTS}*{box-sizing:border-box;margin:0;padding:0;}body{background:${C.bg};color:${C.text};font-family:${FONT.body};-webkit-font-smoothing:antialiased;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px;}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}input::placeholder{color:${C.muted};}select{cursor:pointer;}@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 24px',height:60,display:'flex',alignItems:'center',gap:24}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <div style={{width:32,height:32,background:`linear-gradient(135deg,${C.primary},${C.secondary})`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>◈</div>
            <span style={{fontFamily:FONT.display,fontWeight:800,fontSize:17,color:C.text}}>PoY <span style={{color:C.primary}}>Market</span></span>
            <Tag color={C.secondary}>CANTON</Tag>
          </div>
          <nav style={{display:'flex',gap:2,flex:1,marginLeft:16}}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)} style={{background:tab===n.id?C.faint:'transparent',border:'none',borderRadius:7,padding:'6px 14px',color:tab===n.id?C.text:C.muted,fontSize:13,cursor:'pointer',fontFamily:FONT.body,fontWeight:600,transition:'all 0.15s'}}>{n.label}</button>
            ))}
          </nav>
          {wallet?(
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <div style={{background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 12px',display:'flex',gap:14}}>
                <div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.muted}}>CC</div><Mono color={C.secondary} size={12}>{fmt(ledger.ccBalance)}</Mono></div>
                <div style={{width:1,background:C.border}}/>
                <div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.muted}}>CBTC</div><Mono color={C.cbtc} size={12}>{fmtBtc(ledger.cbtcBalance)}</Mono></div>
              </div>
              <div style={{background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 12px'}}><div style={{fontSize:9,color:C.muted}}>PARTY</div><Mono size={11}>{shortId(wallet.partyId||'demo')}</Mono></div>
              <Btn onClick={handleDisconnect} variant="ghost" size="sm">Disconnect</Btn>
            </div>
          ):<Btn onClick={()=>setWalletModal(true)} variant="primary">Connect Loop</Btn>}
        </div>
      </header>

      <StatsBar/>

      <main style={{maxWidth:1200,margin:'0 auto',padding:'28px 24px',animation:'fadeIn 0.3s ease'}}>

        {tab==='market'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div>
                <h1 style={{fontFamily:FONT.display,fontSize:28,fontWeight:800,color:C.text}}>Yield NFT <span style={{color:C.primary}}>Marketplace</span></h1>
                <p style={{color:C.muted,fontSize:13,marginTop:4}}>{marketNFTs.length} stake positions · Floor price rises with maturity</p>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',color:C.text,fontSize:13,fontFamily:FONT.body,outline:'none',width:150}}/>
                <select value={filter} onChange={e=>setFilter(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:12,outline:'none'}}>
                  <option value="all">All tokens</option><option value="cc">CC only</option><option value="cbtc">CBTC only</option>
                </select>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:12,outline:'none'}}>
                  <option value="maturity">Near maturity first</option><option value="price">Highest price</option><option value="apy">Highest APY</option><option value="newest">Newest first</option>
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
              {LOCK_OPTIONS.map(opt=>(
                <button key={opt.days} onClick={()=>setSearch(opt.badge)} style={{background:C.faint,border:`1px solid ${opt.color}44`,borderRadius:20,padding:'4px 12px',color:opt.color,fontSize:11,cursor:'pointer',fontFamily:FONT.body,fontWeight:600}}>{opt.badge} · {opt.multiplier}×</button>
              ))}
              {search&&<button onClick={()=>setSearch('')} style={{background:C.danger+'18',border:`1px solid ${C.danger}33`,borderRadius:20,padding:'4px 12px',color:C.danger,fontSize:11,cursor:'pointer',fontFamily:FONT.body}}>Clear ×</button>}
            </div>
            {marketNFTs.length===0?(
              <div style={{textAlign:'center',padding:'80px 0',color:C.muted}}><div style={{fontSize:48,marginBottom:16}}>◈</div><div>No NFTs found.</div></div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:18}}>
                {marketNFTs.map(nft=><NFTCard key={nft.id} nft={nft} onClick={setDetailNFT}/>)}
              </div>
            )}
          </div>
        )}

        {tab==='stake'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
              <div>
                <h1 style={{fontFamily:FONT.display,fontSize:28,fontWeight:800,color:C.text}}>Time-Lock <span style={{color:C.secondary}}>Staking</span></h1>
                <p style={{color:C.muted,fontSize:13,marginTop:4}}>Lock CC longer to earn more CBTC. Your NFT floor price grows as it matures.</p>
              </div>
              {wallet&&<Btn onClick={()=>setStakeModal(true)} variant="primary" size="lg">+ New Stake</Btn>}
            </div>
            {/* APY Matrix */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:20,marginBottom:28,overflowX:'auto'}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:14,letterSpacing:'0.08em'}}>EFFECTIVE CBTC APY — Lock Duration × Tier</div>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}>
                <thead>
                  <tr>
                    <th style={{padding:'8px 12px',textAlign:'left',fontSize:11,color:C.muted,fontWeight:600,borderBottom:`1px solid ${C.border}`}}>Tier</th>
                    {LOCK_OPTIONS.map(l=><th key={l.days} style={{padding:'8px 12px',textAlign:'center',fontSize:11,color:l.color,fontWeight:700,borderBottom:`1px solid ${C.border}`}}>{l.shortLabel}<br/><span style={{color:C.muted,fontWeight:400}}>{l.multiplier}×</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {STAKING_CONFIG.tiers.map((tier,ti)=>(
                    <tr key={tier.label} style={{borderBottom:ti<STAKING_CONFIG.tiers.length-1?`1px solid ${C.border}`:'none'}}>
                      <td style={{padding:'10px 12px'}}><div style={{display:'flex',alignItems:'center',gap:8}}><Tag color={tier.rarityColor}>{tier.rarityLabel}</Tag><Mono size={11} color={C.muted}>{fmt(tier.minCC)}+ CC</Mono></div></td>
                      {LOCK_OPTIONS.map(lock=>{const apy=(tier.baseAPY*lock.multiplier).toFixed(1);const isMax=lock.days===365&&tier.label==='Sovereign';return<td key={lock.days} style={{padding:'10px 12px',textAlign:'center',background:isMax?`${C.cbtc}08`:'transparent'}}><Mono color={isMax?C.cbtc:tier.rarityColor} size={isMax?15:12}>{apy}%</Mono></td>;})}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{marginTop:12,fontSize:11,color:C.muted}}>Peak: Sovereign + 1yr = <span style={{color:C.cbtc,fontWeight:700}}>38.5% CBTC APY</span></div>
            </div>
            {wallet&&ledger.stakes.length>0&&(
              <div>
                <h2 style={{fontFamily:FONT.display,fontSize:18,fontWeight:700,color:C.text,marginBottom:14}}>Your Stakes</h2>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>{ledger.stakes.map(s=><StakeRow key={s.id} stake={s} onRefresh={()=>setRefresh(x=>x+1)}/>)}</div>
              </div>
            )}
            {!wallet&&<div style={{textAlign:'center',padding:'60px 0',color:C.muted}}><div style={{fontSize:48,marginBottom:14}}>⟳</div><h3 style={{fontFamily:FONT.display,fontSize:18,color:C.text,marginBottom:8}}>Connect Loop wallet to start staking</h3><Btn onClick={()=>setWalletModal(true)} variant="primary" size="lg" style={{marginTop:8}}>Connect Loop</Btn></div>}
          </div>
        )}

        {tab==='my-nfts'&&(
          <div>
            <h1 style={{fontFamily:FONT.display,fontSize:28,fontWeight:800,color:C.text,marginBottom:8}}>My <span style={{color:C.primary}}>Positions</span></h1>
            {!wallet?(
              <div style={{textAlign:'center',padding:'80px 0',color:C.muted}}><div style={{fontSize:48,marginBottom:14}}>🔐</div><Btn onClick={()=>setWalletModal(true)} variant="primary" size="lg">Connect Wallet</Btn></div>
            ):ledger.myNFTs.length===0?(
              <div style={{textAlign:'center',padding:'80px 0',color:C.muted}}><div style={{fontSize:48,marginBottom:14}}>◈</div><p>No NFTs yet. Stake CC to mint your first Yield NFT.</p><Btn onClick={()=>setTab('stake')} variant="primary" size="lg" style={{marginTop:16}}>Stake CC</Btn></div>
            ):(
              <><p style={{color:C.muted,fontSize:13,marginBottom:20}}>{ledger.myNFTs.length} positions owned</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:18}}>{ledger.myNFTs.map(nft=><NFTCard key={nft.id} nft={nft} onClick={setDetailNFT}/>)}</div></>
            )}
          </div>
        )}

        {tab==='activity'&&(
          <div>
            <h1 style={{fontFamily:FONT.display,fontSize:28,fontWeight:800,color:C.text,marginBottom:20}}>Activity <span style={{color:C.primary}}>Log</span></h1>
            {ledger.activity.length===0?(
              <div style={{textAlign:'center',padding:'80px 0',color:C.muted}}>No activity yet.</div>
            ):(
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden'}}>
                {ledger.activity.map((a,i)=>{
                  const col={Staked:C.primary,Minted:C.secondary,Claimed:C.cbtc,Listed:C.success,Delisted:C.muted,Bought:C.success,Bid:C.primary,Unlocked:C.danger,Matured:C.success}[a.type]||C.muted;
                  return<div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderBottom:i<ledger.activity.length-1?`1px solid ${C.border}`:'none'}}><Tag color={col}>{a.type.toUpperCase()}</Tag><div style={{flex:1,fontSize:13,color:C.text}}>{a.message}</div><Mono color={C.muted}>{shortId(a.txId)}</Mono><Mono color={C.muted}>{ago(a.time)}</Mono></div>;
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {walletModal&&<WalletModal onClose={()=>setWalletModal(false)} onConnected={handleConnected}/>}
      {stakeModal&&<StakeModal onClose={()=>setStakeModal(false)} onSuccess={()=>{setRefresh(x=>x+1);showToast('CC locked successfully!');}}/>}
      {detailNFT&&<NFTDetailModal nft={detailNFT} onClose={()=>setDetailNFT(null)} wallet={wallet} onAction={()=>setRefresh(x=>x+1)}/>}

      {toast&&<div style={{position:'fixed',bottom:28,right:28,zIndex:3000,background:toast.type==='error'?C.danger:C.success,color:'#050811',borderRadius:10,padding:'12px 20px',fontSize:13,fontWeight:600,fontFamily:FONT.body,boxShadow:'0 8px 32px rgba(0,0,0,0.4)',animation:'slideIn 0.25s ease'}}>{toast.msg}</div>}

      <footer style={{borderTop:`1px solid ${C.border}`,padding:'20px 24px',marginTop:48}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
          <Mono color={C.muted}>PoY Market — Canton Network · Time-Lock Staking · Demo</Mono>
          <div style={{display:'flex',gap:16}}>{[['Canton Loop','https://cantonloop.com'],['Canton Network','https://canton.network'],['Loop SDK Docs','https://docs.fivenorth.io/loop-sdk/overview/']].map(([l,h])=><a key={l} href={h} target="_blank" rel="noreferrer" style={{color:C.muted,fontSize:12,textDecoration:'none'}}>{l}</a>)}</div>
        </div>
      </footer>
    </>
  );
}
