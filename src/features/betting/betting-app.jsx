"use client";
import { Container } from "@/components/ui/container";
/* eslint-disable @next/next/no-img-element -- Use the supplied Chog artwork. */
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default class BettingApp extends React.Component {
  state = { tab: 'arena', connected: false, showWallet: false, filter: 'All', sel: null, accepted: false, asset: 'BTC', dir: 'above', target: '100,000', deadline: 'Dec 31', stake: '25000', locked: false };
  fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  renderVals() {
    const s = this.state, set = o => this.setState(o);
    const calls = [
      { who: 'Chog #232', rec: '4W 2L', q: 'MON touches $0.05 before Oct 20', side: 'above', stake: 10000, ends: '21h', a: 'MON' },
      { who: 'Chog #88', rec: '11W 6L', q: 'ETH closes under $3,000 Friday', side: 'below', stake: 25000, ends: '3d', a: 'ETH' },
      { who: 'Chog #1710', rec: '2W 0L', q: 'SOL above $200 by end of week', side: 'above', stake: 5000, ends: '5d', a: 'SOL' },
      { who: 'Chog #401', rec: '7W 7L', q: 'BTC dips below $90,000 this month', side: 'below', stake: 50000, ends: '12d', a: 'BTC' },
      { who: 'Chog #9', rec: '19W 4L', q: 'MON flips $0.06 by month end', side: 'above', stake: 15000, ends: '12d', a: 'MON' },
      { who: 'Chog #613', rec: '3W 5L', q: 'BTC above $100,000 by Dec 31', side: 'above', stake: 25000, ends: '61d', a: 'BTC' }
    ].map((c, i) => ({ ...c, other: c.side === 'above' ? 'below' : 'above', sideBg: c.side === 'above' ? '#E3F6EC' : '#FCE8EB', sideFg: c.side === 'above' ? '#1A8A55' : '#C43A52', stakeFmt: this.fmt(c.stake), winFmt: this.fmt(c.stake * 2 * .95), burnFmt: this.fmt(c.stake * 2 * .05), open: () => set({ sel: i, accepted: false }) }));
    const shown = s.filter === 'All' ? calls : calls.filter(c => c.a === s.filter);
    const tab = (id, label) => ({ id, label, go: () => set({ tab: id }), bg: s.tab === id ? '#F1EEFB' : 'transparent', fg: s.tab === id ? '#6E56E8' : '#6B6185' });
    const stake = parseFloat(String(s.stake).replace(/,/g, '')) || 0;
    const balance = 128400;
    const sel = s.sel != null ? calls[s.sel] : {};
    const connect = () => set({ connected: true, showWallet: false });
    const st = { Open: ['#F1EEFB', '#6E56E8'], Accepted: ['#FFF3DD', '#A86A00'], Won: ['#E3F6EC', '#1A8A55'], Lost: ['#FCE8EB', '#C43A52'], Refunded: ['#F2F0F5', '#6B6185'] };
    const mine = [
      { q: 'BTC above $100,000 by Dec 31', vs: 'Waiting…', stake: '25,000', res: '—', status: 'Open' },
      { q: 'ETH above $3,400 by Nov 1', vs: 'Chog #88', stake: '10,000', res: 'Pending', status: 'Accepted' },
      { q: 'MON touches $0.04 this week', vs: 'Chog #401', stake: '50,000', res: '+95,000', status: 'Won' },
      { q: 'SOL under $150 by Oct 10', vs: 'Chog #9', stake: '20,000', res: '−20,000', status: 'Lost' },
      { q: 'BTC above $100,000 at Oct 20', vs: 'Nobody', stake: '5,000', res: '±0', status: 'Refunded' }
    ].map(m => ({ ...m, stBg: st[m.status][0], stFg: st[m.status][1], resFg: m.res.startsWith('+') ? '#1A8A55' : m.res.startsWith('−') ? '#C43A52' : '#8E85A3' }));
    return {
      tabs: [tab('arena', 'Arena'), tab('create', 'Make a call'), tab('mine', 'My duels')],
      isArena: s.tab === 'arena', isCreate: s.tab === 'create', isMine: s.tab === 'mine',
      connected: s.connected, notConnected: !s.connected, balanceFmt: this.fmt(balance), balanceShown: s.connected ? this.fmt(balance) : '—',
      openWallet: () => set({ showWallet: true }), closeWallet: () => set({ showWallet: false }), disconnect: () => set({ connected: false }), connect, showWallet: s.showWallet,
      wallets: [{ ini: 'MM', name: 'MetaMask', note: 'Detected' }, { ini: 'PH', name: 'Phantom', note: '' }, { ini: 'BP', name: 'Backpack', note: '' }, { ini: 'WC', name: 'WalletConnect', note: 'QR' }],
      filters: ['All', 'BTC', 'ETH', 'MON', 'SOL'].map(f => ({ label: f, go: () => set({ filter: f }), bg: s.filter === f ? '#1A1130' : '#fff', fg: s.filter === f ? '#fff' : '#4A4063', bd: s.filter === f ? '#1A1130' : '#DCD5EC' })),
      shown, goCreate: () => set({ tab: 'create' }),
      showSheet: s.sel != null, sel, accepted: s.accepted, closeSheet: () => set({ sel: null }),
      acceptLabel: !s.connected ? 'Connect wallet to accept' : s.accepted ? 'Done' : `Approve & take ${sel.other || ''} · ${sel.stakeFmt || ''} $CHOG`,
      acceptAction: () => !s.connected ? set({ showWallet: true }) : s.accepted ? set({ sel: null }) : set({ accepted: true }),
      deadlines: ['Tomorrow', 'Friday', 'Month end', 'Dec 31'].map(d => ({ label: d, go: () => set({ deadline: d, locked: false }), bg: s.deadline === d ? '#fff' : 'transparent', fg: s.deadline === d ? '#1A1130' : '#8E85A3' })),
      asset: s.asset, deadline: s.deadline, target: s.target, stake: s.stake,
      setAsset: e => set({ asset: e.target.value, locked: false }), setDeadline: e => set({ deadline: e.target.value, locked: false }), setTarget: e => set({ target: e.target.value, locked: false }), setStake: e => set({ stake: e.target.value, locked: false }),
      setAbove: () => set({ dir: 'above' }), setBelow: () => set({ dir: 'below' }),
      aboveBg: s.dir === 'above' ? '#fff' : 'transparent', aboveFg: s.dir === 'above' ? '#1A8A55' : '#8E85A3', belowBg: s.dir === 'below' ? '#fff' : 'transparent', belowFg: s.dir === 'below' ? '#C43A52' : '#8E85A3',
      presets: [5000, 10000, 25000, 50000].map(v => ({ label: this.fmt(v), go: () => set({ stake: String(v) }) })),
      stakeFmt: this.fmt(stake), potFmt: this.fmt(stake * 2), burnFmt: this.fmt(stake * 2 * .05), payoutFmt: this.fmt(stake * 2 * .95),
      claim: `${s.asset} will be ${s.dir} $${s.target} by ${s.deadline}.`,
      locked: s.locked, lockLabel: !s.connected ? 'Connect wallet' : s.locked ? 'Locked ✓' : `Lock ${this.fmt(stake)} $CHOG & get link`,
      lockCall: () => !s.connected ? set({ showWallet: true }) : set({ locked: true }),
      mine
    };
  }

  render() {
    const v = this.renderVals();
    return (<Tabs value={this.state.tab} onValueChange={(tab) => this.setState({ tab })} className="min-h-screen gap-0 bg-[#faf9fc] font-sans text-[#1a1130] leading-normal antialiased">

<div  className="[min-height:100vh] flex flex-col">
<header  className="[position:sticky] [top:0] [z-index:5] bg-white [border-bottom:1px_solid_#ECE8F3]">
  <Container  className="flex-wrap min-[901px]:flex-nowrap [padding-top:12px] [padding-bottom:12px] flex items-center [gap:28px]">
    <Link href="/"  className="flex items-center [gap:10px] font-semibold [font-size:16px] [color:#1A1130]"><img src="/chog-logo.png" alt="ChogXBet logo"  className="[width:64px] [height:64px] [border-radius:14px] [flex-shrink:0]" />ChogXBet</Link>
    <TabsList className="order-3 w-full gap-1 bg-transparent min-[901px]:order-none min-[901px]:w-auto">
      {v.tabs.map((t, index) => <React.Fragment key={index}><TabsTrigger value={t.id} style={{"background": `${t.bg}`, "color": `${t.fg}`}} className="[padding:8px_12px] border-0 [border-radius:8px] [font:500_14px_var(--font-geist)] cursor-pointer">{t.label}</TabsTrigger></React.Fragment>)}
    </TabsList>
    <div  className="ml-auto flex items-center [gap:10px]">
      {v.connected && <>
        <span  className="[flex:none] [white-space:nowrap] flex items-center [gap:8px] [padding:7px_12px] [border-radius:8px] [background:#F1EEFB] [font:500_13px_var(--font-geist-mono)]"><span  className="[width:8px] [height:8px] [border-radius:50%] [background:#6E56E8]"></span>{v.balanceFmt} $CHOG</span>
        <Button className="h-auto whitespace-normal [flex:none] [white-space:nowrap] flex items-center [gap:8px] [padding:5px_12px_5px_5px] [border:1px_solid_#DCD5EC] [border-radius:8px] bg-white [font:500_13px_var(--font-geist-mono)] [color:#1A1130] cursor-pointer" onClick={v.disconnect}  title="Disconnect"><img alt="Chog" src="/chog-1044.png"  className="[width:26px] [height:26px] [border-radius:6px]" />0x7a3…91c</Button>
      </>}
      {v.notConnected && <>
        <span  className="[font-size:13px] [color:#8E85A3]">Monad</span>
        <Button className="h-auto whitespace-normal [padding:9px_16px] border-0 [border-radius:8px] [background:#6E56E8] text-white [font:600_14px_var(--font-geist)] cursor-pointer" onClick={v.openWallet} >Connect wallet</Button>
      </>}
    </div>
  </Container>
</header>

<Container as="main"  className="[flex:1] [padding-top:32px] [padding-bottom:64px]">

{v.isArena && <>
  <div data-screen-label="Arena"  className="flex justify-between [align-items:flex-end] [gap:20px] [flex-wrap:wrap]">
    <div><h1  className="[margin:0] [font:600_32px/1.1_var(--font-geist)] [letter-spacing:-.03em]">Open calls</h1><p  className="[margin:6px_0_0] [font-size:15px] [color:#6B6185]">Pick a call you disagree with. Match the stake to take the other side.</p></div>
    <Button className="h-auto whitespace-normal [padding:10px_16px] border-0 [border-radius:9px] [background:#1A1130] text-white [font:600_14px_var(--font-geist)] cursor-pointer" onClick={v.goCreate} >＋ Make a call</Button>
  </div>
  <div  className="flex [gap:6px] [margin-top:24px] [flex-wrap:wrap]">
    {v.filters.map((f, index) => <React.Fragment key={index}><Button className="h-auto whitespace-normal [padding:7px_13px] [border-radius:999px] [font:500_13px_var(--font-geist)] cursor-pointer" onClick={f.go} style={{"border": `1px solid ${f.bd}`, "background": `${f.bg}`, "color": `${f.fg}`}}>{f.label}</Button></React.Fragment>)}
  </div>
  <div  className="grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr))] [gap:14px] [margin-top:20px]">
    {v.shown.map((c, index) => <React.Fragment key={index}>
      <Card className="ring-0 [border:1px_solid_#ECE8F3] [border-radius:14px] [padding:18px] bg-white flex flex-col [gap:14px]" >
        <div  className="flex items-center [gap:10px] [font-size:14px]"><img alt="Chog" src="/chog-1044.png"  className="[width:30px] [height:30px] [border-radius:8px]" /><div><div  className="font-semibold">{c.who}</div><div  className="[font-size:12px] [color:#8E85A3]">{c.rec}</div></div><span style={{"background": `${c.sideBg}`, "color": `${c.sideFg}`}} className="ml-auto [padding:4px_9px] [border-radius:999px] [font-size:12px] font-semibold">Says {c.side}</span></div>
        <div  className="[font:600_19px/1.3_var(--font-geist)] [letter-spacing:-.01em] [text-wrap:pretty]">“{c.q}”</div>
        <div  className="grid [grid-template-columns:1fr_1fr_1fr] [gap:8px] [font-size:12px] [color:#8E85A3]"><div>Stake<div  className="[margin-top:2px] [font:500_14px_var(--font-geist-mono)] [color:#1A1130]">{c.stakeFmt}</div></div><div>Win<div  className="[margin-top:2px] [font:500_14px_var(--font-geist-mono)] [color:#6E56E8]">{c.winFmt}</div></div><div>Ends<div  className="[margin-top:2px] [font:500_14px_var(--font-geist-mono)] [color:#1A1130]">{c.ends}</div></div></div>
        <Button className="h-auto whitespace-normal [padding:10px] [border:1px_solid_#DCD5EC] [border-radius:9px] bg-white [color:#1A1130] [font:600_14px_var(--font-geist)] cursor-pointer" onClick={c.open} >Take the {c.other} side</Button>
      </Card>
    </React.Fragment>)}
  </div>
</>}

{v.isCreate && <>
  <div data-screen-label="Make a call"  className="grid grid-cols-1 min-[901px]:grid-cols-[minmax(0,1fr)_440px] [gap:40px] [align-items:start]">
    <div>
      <h1  className="[margin:0] [font:600_32px/1.1_var(--font-geist)] [letter-spacing:-.03em]">Make a call</h1>
      <p  className="[margin:6px_0_0] [font-size:15px] [color:#6B6185]">Your stake is held in escrow until someone accepts or the deadline passes.</p>
      <Card className="ring-0 [margin-top:28px] bg-white [border:1px_solid_#ECE8F3] [border-radius:16px] [padding:24px] flex flex-col [gap:22px]" >
        <div  className="grid [grid-template-columns:1fr_1fr] [gap:14px]">
          <label  className="flex flex-col [gap:6px] [font-size:13px] [color:#6B6185]">Asset<select value={v.asset} onChange={v.setAsset}  className="[padding:12px] [border:1px_solid_#DCD5EC] [border-radius:10px] bg-white [font-size:15px] [color:#1A1130]"><option>BTC</option><option>ETH</option><option>MON</option><option>SOL</option></select></label>
          <div  className="flex flex-col [gap:6px] [font-size:13px] [color:#6B6185]">Deadline<div  className="grid [grid-template-columns:repeat(4,1fr)] [gap:4px] [padding:4px] [background:#F4F1FA] [border-radius:10px]">{v.deadlines.map((d, index) => <React.Fragment key={index}><Button className="h-auto whitespace-normal [padding:8px_4px] border-0 [border-radius:7px] [font:500_13px_var(--font-geist)] cursor-pointer [white-space:nowrap]" onClick={d.go} style={{"background": `${d.bg}`, "color": `${d.fg}`}}>{d.label}</Button></React.Fragment>)}</div></div>
        </div>
        <div  className="flex flex-col [gap:6px] [font-size:13px] [color:#6B6185]">I think it will be
          <div  className="grid [grid-template-columns:1fr_1fr] [gap:6px] [padding:4px] [background:#F4F1FA] [border-radius:10px]">
            <Button className="h-auto whitespace-normal [padding:10px] border-0 [border-radius:7px] [font:600_14px_var(--font-geist)] cursor-pointer" onClick={v.setAbove} style={{"background": `${v.aboveBg}`, "color": `${v.aboveFg}`}}>Above</Button>
            <Button className="h-auto whitespace-normal [padding:10px] border-0 [border-radius:7px] [font:600_14px_var(--font-geist)] cursor-pointer" onClick={v.setBelow} style={{"background": `${v.belowBg}`, "color": `${v.belowFg}`}}>Below</Button>
          </div>
        </div>
        <label  className="flex flex-col [gap:6px] [font-size:13px] [color:#6B6185]">Target price (USD)<Input className="h-auto [padding:12px] [border:1px_solid_#DCD5EC] [border-radius:10px] [font:500_17px_var(--font-geist-mono)] [color:#1A1130]" value={v.target} onChange={v.setTarget}  /></label>
        <div  className="flex flex-col [gap:6px] [font-size:13px] [color:#6B6185]">
          <div  className="flex justify-between"><span>Your stake</span><span>Balance {v.balanceShown}</span></div>
          <div  className="flex items-center [border:1px_solid_#DCD5EC] [border-radius:10px] [padding:0_12px]"><Input className="h-auto [flex:1] border-0 [outline:0] [padding:12px_0] [font:500_17px_var(--font-geist-mono)] [color:#1A1130] [background:transparent]" value={v.stake} onChange={v.setStake}  /><span  className="[font:500_13px_var(--font-geist-mono)] [color:#8E85A3]">$CHOG</span></div>
          <div  className="flex [gap:6px]">{v.presets.map((p, index) => <React.Fragment key={index}><Button className="h-auto whitespace-normal [padding:6px_10px] [border:1px_solid_#ECE8F3] [border-radius:7px] bg-white [font:500_12px_var(--font-geist-mono)] [color:#4A4063] cursor-pointer" onClick={p.go} >{p.label}</Button></React.Fragment>)}</div>
        </div>
        <div  className="flex flex-col [gap:10px] [padding:16px] [border-radius:12px] [background:#FAF9FC] [font-size:14px]">
          <div  className="flex justify-between"><span  className="[color:#6B6185]">Pot if accepted</span><span  className="[font-family:var(--font-geist-mono)]">{v.potFmt}</span></div>
          <div  className="flex justify-between"><span  className="[color:#6B6185]">Burned (5%)</span><span  className="[font-family:var(--font-geist-mono)] [color:#C43A52]">−{v.burnFmt}</span></div>
          <div  className="flex justify-between [padding-top:10px] [border-top:1px_solid_#ECE8F3] font-semibold"><span>You receive if right</span><span  className="[font-family:var(--font-geist-mono)] [color:#6E56E8]">{v.payoutFmt}</span></div>
        </div>
        <Button className="h-auto whitespace-normal [padding:15px] border-0 [border-radius:11px] [background:#6E56E8] text-white [font:600_16px_var(--font-geist)] cursor-pointer" onClick={v.lockCall} >{v.lockLabel}</Button>
      </Card>
    </div>
    <div  className="[position:sticky] [top:96px] flex flex-col [gap:12px]">
      <div  className="[font:500_12px_var(--font-geist-mono)] [color:#8E85A3]">SHARE CARD PREVIEW</div>
      <div  className="[border-radius:16px] overflow-hidden [border:1px_solid_#ECE8F3] bg-white">
        <div  className="[padding:24px] [background:#1A1130] text-white">
          <div  className="flex justify-between [font:500_12px_var(--font-geist-mono)] [color:#B9A8FF]"><span>CHOGXBET · DUEL</span><span>{v.stakeFmt} $CHOG</span></div>
          <div  className="flex items-center [gap:10px] [margin-top:18px]"><img alt="Chog" src="/chog-1044.png"  className="[width:36px] [height:36px] [border-radius:9px]" /><span  className="[font-size:14px] [color:#C9C0E6]">Chog #1044 · 9W 3L</span></div>
          <div  className="[margin-top:14px] [font:600_26px/1.15_var(--font-geist)] [letter-spacing:-.02em] [text-wrap:pretty]">{v.claim}</div>
          <div  className="flex justify-between items-center [margin-top:22px]"><span  className="[font-size:14px] [color:#C9C0E6]">Seat open for a challenger</span><span  className="[padding:7px_12px] [border-radius:999px] [background:#A391FF] [color:#140A2A] [font-size:13px] font-semibold">Take the bet →</span></div>
        </div>
        <div  className="[padding:10px_14px] [font-size:13px] [color:#8E85A3]">conviction.chog.xyz/d/new</div>
      </div>
      {v.locked && <>
        <div  className="[padding:16px] [border-radius:12px] [background:#E3F6EC] [color:#1A8A55] [font-size:14px] flex flex-col [gap:10px]">
          <span  className="font-semibold">Call locked. Share it.</span>
          <div  className="flex [gap:8px]"><a href="https://x.com/intent/tweet"  className="[flex:1] [padding:10px] [border-radius:8px] [background:#1A1130] text-white text-center font-semibold">Post on X</a><Button className="h-auto whitespace-normal [padding:10px_14px] [border:1px_solid_#B8E3CC] [border-radius:8px] bg-white [color:#1A8A55] [font:600_14px_var(--font-geist)]" >Copy link</Button></div>
        </div>
      </>}
    </div>
  </div>
</>}

{v.isMine && <>
  <div className="overflow-x-auto" data-screen-label="My duels">
    <h1  className="[margin:0] [font:600_32px/1.1_var(--font-geist)] [letter-spacing:-.03em]">My duels</h1>
    <div  className="grid [grid-template-columns:repeat(4,1fr)] [margin-top:24px] [border:1px_solid_#ECE8F3] [border-radius:14px] bg-white">
      <div  className="[padding:18px_22px]"><div  className="[font-size:13px] [color:#8E85A3]">Record</div><div  className="[margin-top:4px] [font:500_22px_var(--font-geist-mono)]">9W 3L</div></div>
      <div  className="[padding:18px_22px] [border-left:1px_solid_#ECE8F3]"><div  className="[font-size:13px] [color:#8E85A3]">Net</div><div  className="[margin-top:4px] [font:500_22px_var(--font-geist-mono)] [color:#1A8A55]">+182,500</div></div>
      <div  className="[padding:18px_22px] [border-left:1px_solid_#ECE8F3]"><div  className="[font-size:13px] [color:#8E85A3]">In escrow</div><div  className="[margin-top:4px] [font:500_22px_var(--font-geist-mono)]">35,000</div></div>
      <div  className="[padding:18px_22px] [border-left:1px_solid_#ECE8F3]"><div  className="[font-size:13px] [color:#8E85A3]">You&apos;ve burned</div><div  className="[margin-top:4px] [font:500_22px_var(--font-geist-mono)]">31,000</div></div>
    </div>
    <div  className="[margin-top:20px] [border:1px_solid_#ECE8F3] [border-radius:14px] bg-white overflow-hidden">
      <div  className="grid [grid-template-columns:1fr_160px_120px_120px_110px] [gap:16px] [padding:12px_20px] [font:500_12px_var(--font-geist-mono)] [color:#8E85A3] [border-bottom:1px_solid_#ECE8F3]"><span>CALL</span><span>OPPONENT</span><span>STAKE</span><span>RESULT</span><span>STATUS</span></div>
      {v.mine.map((m, index) => <React.Fragment key={index}>
        <div  className="grid [grid-template-columns:1fr_160px_120px_120px_110px] [gap:16px] items-center [padding:15px_20px] [border-bottom:1px_solid_#F2EFF7] [font-size:14px]"><span  className="font-medium">{m.q}</span><span  className="[color:#6B6185]">{m.vs}</span><span  className="[font-family:var(--font-geist-mono)]">{m.stake}</span><span style={{"color": `${m.resFg}`}} className="[font-family:var(--font-geist-mono)]">{m.res}</span><span><span style={{"background": `${m.stBg}`, "color": `${m.stFg}`}} className="[padding:4px_9px] [border-radius:999px] [font-size:12px] font-semibold">{m.status}</span></span></div>
      </React.Fragment>)}
    </div>
  </div>
</>}

</Container>
</div>

<Dialog open={v.showSheet} onOpenChange={(open) => { if (!open) v.closeSheet(); }}><DialogContent className="flex flex-col left-auto right-0 top-0 h-dvh w-full max-w-[460px] translate-x-0 translate-y-0 rounded-none p-0 sm:max-w-[460px]"><DialogDescription className="sr-only">Review and accept this duel.</DialogDescription>
    <div  className="flex justify-between items-center [padding:18px_24px] [border-bottom:1px_solid_#ECE8F3]"><DialogTitle>Accept duel</DialogTitle></div>
    <div  className="[flex:1] [overflow:auto] [padding:24px] flex flex-col [gap:20px]">
      <div  className="flex items-center [gap:10px] [font-size:14px]"><img alt="Chog" src="/chog-1044.png"  className="[width:36px] [height:36px] [border-radius:9px]" /><div><div  className="font-semibold">{v.sel.who}</div><div  className="[font-size:12px] [color:#8E85A3]">{v.sel.rec}</div></div><span  className="ml-auto [font:400_12px_var(--font-geist-mono)] [color:#8E85A3]">{v.sel.ends} left</span></div>
      <div  className="[font:600_28px/1.15_var(--font-geist)] [letter-spacing:-.025em] [text-wrap:pretty]">“{v.sel.q}”</div>
      <div  className="grid [grid-template-columns:1fr_40px_1fr] items-center">
        <div style={{"background": `${v.sel.sideBg}`}} className="[padding:14px] [border-radius:12px] text-center"><div  className="[font-size:12px] [color:#6B6185]">Them</div><div style={{"color": `${v.sel.sideFg}`}} className="[margin-top:2px] font-semibold">{v.sel.side}</div></div>
        <span  className="text-center [font:600_12px_var(--font-geist-mono)] [color:#8E85A3]">VS</span>
        <div  className="[padding:14px] [border-radius:12px] [border:1.5px_solid_#6E56E8] text-center"><div  className="[font-size:12px] [color:#6B6185]">You</div><div  className="[margin-top:2px] font-semibold [color:#6E56E8]">{v.sel.other}</div></div>
      </div>
      <div  className="flex flex-col [gap:10px] [padding:16px] [border-radius:12px] [background:#FAF9FC] [font-size:14px]">
        <div  className="flex justify-between"><span  className="[color:#6B6185]">You match</span><span  className="[font-family:var(--font-geist-mono)]">{v.sel.stakeFmt}</span></div>
        <div  className="flex justify-between"><span  className="[color:#6B6185]">Burned at settlement (5%)</span><span  className="[font-family:var(--font-geist-mono)] [color:#C43A52]">−{v.sel.burnFmt}</span></div>
        <div  className="flex justify-between [padding-top:10px] [border-top:1px_solid_#ECE8F3] font-semibold"><span>You receive if right</span><span  className="[font-family:var(--font-geist-mono)] [color:#6E56E8]">{v.sel.winFmt}</span></div>
      </div>
      <div  className="[font-size:13px] [line-height:1.5] [color:#8E85A3]">Settles at the deadline against the oracle price. Once accepted, neither side can cancel.</div>
      {v.accepted && <><div  className="[padding:14px] [border-radius:12px] [background:#E3F6EC] [color:#1A8A55] [font-size:14px] font-semibold">You&apos;re in. Stake locked in escrow.</div></>}
    </div>
    <div  className="[padding:20px_24px] [border-top:1px_solid_#ECE8F3]"><Button className="h-auto whitespace-normal w-full [padding:15px] border-0 [border-radius:11px] [background:#6E56E8] text-white [font:600_16px_var(--font-geist)] cursor-pointer" onClick={v.acceptAction} >{v.acceptLabel}</Button></div>
  </DialogContent></Dialog><Dialog open={v.showWallet} onOpenChange={(open) => { if (!open) v.closeWallet(); }}><DialogContent className="w-[min(400px,92vw)] gap-0 p-6 sm:max-w-[400px]"><DialogDescription className="sr-only">Choose a wallet for this demo.</DialogDescription>
    <div  className="flex justify-between items-center"><DialogTitle>Connect wallet</DialogTitle></div>
    <p  className="[margin:6px_0_0] [font-size:14px] [color:#6B6185]">You&apos;ll need a Chog and $CHOG on Monad.</p>
    <div  className="flex flex-col [gap:8px] [margin-top:20px]">
      {v.wallets.map((w, index) => <React.Fragment key={index}><Button className="h-auto whitespace-normal flex items-center [gap:12px] [padding:12px_14px] [border:1px_solid_#ECE8F3] [border-radius:12px] bg-white [font:500_15px_var(--font-geist)] [color:#1A1130] cursor-pointer [text-align:left]" onClick={v.connect} ><span  className="[width:32px] [height:32px] [border-radius:9px] [background:#F1EEFB] grid [place-items:center] [font:600_12px_var(--font-geist-mono)] [color:#6E56E8]">{w.ini}</span>{w.name}<span  className="ml-auto [font-size:12px] [color:#8E85A3]">{w.note}</span></Button></React.Fragment>)}
    </div>
  </DialogContent></Dialog>
</Tabs>);
  }
}
