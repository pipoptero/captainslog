import { useState, useEffect } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// DATOS
// ══════════════════════════════════════════════════════════════════════════════

const NATIONS = ["Holanda", "España", "Inglaterra", "Francia"];
const FLAGS   = { Holanda:"🇳🇱", España:"🇪🇸", Inglaterra:"🇬🇧", Francia:"🇫🇷" };
const GOODS   = { Holanda:"Té", España:"Plata", Inglaterra:"Algodón", Francia:"Azúcar" };

// Capacidad máxima por tramo (T1→T4)
// Legal:      T1=1, T2=2, T3=3, T4=2  (máx 8)
// Contrabando T1=2, T2=2, T3=3, T4=1  (máx 8)
const LEGAL_CAPS  = [1, 2, 3, 2];
const CONTRA_CAPS = [2, 2, 3, 1];

const PRICES = {
  A: {
    legal:      { sell:[500,1000,1000,500],  buy:[1000,1000,500,500] },
    contraband: { sell:[500,1000,1000,500],  buy:[1000,1000,500,500] },
  },
  B: {
    legal:      { sell:[1500,1000,1000,500], buy:[1000,1000,500,500] },
    contraband: { sell:[2000,1500,1000,500], buy:[1500,1000,500,500] },
  },
};

const NATION_BG = {
  Holanda:    ["#cf7a14","#9a5a0a"],
  España:     ["#8b1010","#600a0a"],
  Inglaterra: ["#0d1f6e","#081247"],
  Francia:    ["#1a2a9a","#0f1a6e"],
};

// ══════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════════════════════════

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Dado de 8 caras
const d8 = () => Math.floor(Math.random() * 8) + 1;

// La nación "siguiente" en el círculo = la que provee el contrabando
const nextIdx = (i) => (i + 1) % 4;
// La nación "anterior" = a quien repones al vender legal
const prevIdx = (i) => (i - 1 + 4) % 4;

const roundUp500 = (v) => v % 500 === 0 ? v : v + 500 - (v % 500);

// Rellena una fila de izquierda a derecha según el dado respetando capacidad por tramo
const rollFill = (caps, dieRoll) => {
  let rem = dieRoll;
  return caps.map(cap => { const f = Math.min(cap, rem); rem -= f; return f; });
};

// COMPRA: derecha → izquierda
const doBuy = (cols, buyPrices, qty) => {
  const nc = [...cols];
  let rem = qty, cost = 0, bought = 0;
  for (let c = 3; c >= 0 && rem > 0; c--)
    while (nc[c] > 0 && rem > 0) { cost += buyPrices[c]; nc[c]--; rem--; bought++; }
  return { cost: roundUp500(cost), bought, newCols: nc };
};

// VENTA: precio = primer hueco libre desde la izquierda (si todos llenos → T4)
const getSellInfo = (cols, sellPrices, qty) => {
  const ei  = cols.findIndex(v => v === 0);
  const col = ei === -1 ? 3 : ei;
  return { col, unitPrice: sellPrices[col], income: roundUp500(sellPrices[col] * qty) };
};

// REPOSICIÓN: rellena de izquierda a derecha (primer hueco libre desde la izquierda)
// Si no hay huecos disponibles en un tramo, no se repone (se salta).
const replenish = (cols, caps, qty) => {
  const nc = [...cols];
  let rem = qty;
  for (let c = 0; c < 4 && rem > 0; c++) {
    const space = caps[c] - nc[c];
    if (space > 0) { const add = Math.min(space, rem); nc[c] += add; rem -= add; }
  }
  return nc;
};

const deepCopy = (markets) =>
  markets.map(m => ({ ...m, legal:[...m.legal], contraband:[...m.contraband] }));

const addLog = (state, msg) => {
  const t = new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return { ...state, history: [{ t, msg }, ...state.history].slice(0, 80) };
};

// ══════════════════════════════════════════════════════════════════════════════
// MOTOR DE MERCADO
// ══════════════════════════════════════════════════════════════════════════════
//
// Contrabando en market[i] = mercancía de market[nextIdx(i)]
//   → compra/venta opera sobre markets[nextIdx(i)].contraband
//
// Reposición al vender legal en market[i] → markets[nextIdx(i)].legal (nación inferior)
// Reposición al vender contrabando en market[i] → markets[nextIdx(i)].contraband

function buyLegal(state, mi, qty) {
  const nation  = state.markets[mi].nation;
  const prices  = PRICES[state.side].legal;
  const { cost, bought, newCols } = doBuy(state.markets[mi].legal, prices.buy, qty);
  if (!bought) return addLog(state, `⚠️ Sin stock legal en ${nation}`);
  const markets = deepCopy(state.markets);
  markets[mi].legal = newCols;
  return addLog(
    { ...state, doubloons: state.doubloons - cost, markets },
    `💰 Comprado ${bought} ${GOODS[nation]} legal (${nation}) — −${cost.toLocaleString()} doblones`
  );
}

function buyContraband(state, mi, qty) {
  const port   = state.markets[mi].nation;
  const pi     = prevIdx(mi);                    // nación superior = la anterior
  const prev   = state.markets[pi].nation;
  const prices = PRICES[state.side].contraband;
  const { cost, bought, newCols } = doBuy(state.markets[pi].contraband, prices.buy, qty);
  if (!bought) return addLog(state, `⚠️ Sin contrabando de ${prev} en ${port}`);
  const markets = deepCopy(state.markets);
  markets[pi].contraband = newCols;
  return addLog(
    { ...state, doubloons: state.doubloons - cost, markets },
    `🏴‍☠️ Comprado ${bought} ${GOODS[prev]} (contra. ${prev}) en ${port} — −${cost.toLocaleString()} doblones`
  );
}

function sellLegal(state, mi, qty) {
  const nation  = state.markets[mi].nation;
  const ni      = nextIdx(mi);
  const lower   = state.markets[ni].nation;
  const prices  = PRICES[state.side].legal;
  const { income, unitPrice } = getSellInfo(state.markets[mi].legal, prices.sell, qty);
  const repAmt  = Math.floor(qty / 2);
  const markets = deepCopy(state.markets);
  if (repAmt > 0) markets[ni].legal = replenish(markets[ni].legal, LEGAL_CAPS, repAmt);
  return addLog(
    { ...state, doubloons: state.doubloons + income, markets },
    `⚓ Vendido ${qty} ${GOODS[nation]} legal (${unitPrice.toLocaleString()}/u) en ${nation} — +${income.toLocaleString()} doblones${repAmt ? ` | repuesto ${repAmt} → ${lower}` : ""}`
  );
}

function sellContraband(state, mi, qty) {
  const port   = state.markets[mi].nation;
  const pi     = prevIdx(mi);                    // nación superior = la anterior
  const prev   = state.markets[pi].nation;
  const prices = PRICES[state.side].contraband;
  const { income, unitPrice } = getSellInfo(state.markets[pi].contraband, prices.sell, qty);
  // Reposición: nación inferior de prevIdx(mi) = nextIdx(prevIdx(mi)) = mi
  const repAmt = Math.floor(qty / 2);
  const markets = deepCopy(state.markets);
  if (repAmt > 0) markets[mi].contraband = replenish(markets[mi].contraband, CONTRA_CAPS, repAmt);
  return addLog(
    { ...state, doubloons: state.doubloons + income, markets },
    `🏴‍☠️ Vendido ${qty} ${GOODS[prev]} contra. (${unitPrice.toLocaleString()}/u) en ${port} — +${income.toLocaleString()} doblones${repAmt ? ` | repuesto ${repAmt} → ${port}` : ""}`
  );
}

const ACTIONS = { buyLegal, buyContraband, sellLegal, sellContraband };

// ══════════════════════════════════════════════════════════════════════════════
// ESTADO INICIAL
// ══════════════════════════════════════════════════════════════════════════════

const mkRolls = () => NATIONS.map(() => ({ legal: d8(), contraband: d8() }));

const buildState = (order, rolls) => ({
  side: "A",
  doubloons: 10000,
  markets: order.map((nation, i) => ({
    nation,
    legal:      rollFill(LEGAL_CAPS,  rolls[i].legal),
    contraband: rollFill(CONTRA_CAPS, rolls[i].contraband),
  })),
  history: [],
});

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS
// ══════════════════════════════════════════════════════════════════════════════

const css = `
@import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --gold:#f0c030; --gold2:#a07820; --text:#e0c888; --dark:#0b0706;
  --panel:rgba(18,12,5,0.94); --bdr:rgba(190,140,40,.22);
  --lcol:#d4a820; --ccol:#e04040;
}
body { background:var(--dark); font-family:'Crimson Text',Georgia,serif; color:var(--text); min-height:100vh; }
.app {
  min-height:100vh; padding:18px 12px 40px;
  background:
    radial-gradient(ellipse at 15% 15%,rgba(100,60,10,.16) 0%,transparent 45%),
    radial-gradient(ellipse at 85% 85%,rgba(60,20,5,.2) 0%,transparent 45%);
}
.hdr { text-align:center; margin-bottom:20px; }
.hdr h1 { font-family:'Pirata One',serif; font-size:clamp(24px,5.5vw,50px); color:var(--gold); text-shadow:0 0 22px rgba(240,192,48,.4),2px 2px 0 #200e00; letter-spacing:2px; }
.hdr-sub { font-family:'Cinzel',serif; font-size:10px; color:var(--gold2); letter-spacing:5px; text-transform:uppercase; margin-top:4px; }
.topbar { display:flex; justify-content:center; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
.coins { display:flex; align-items:center; gap:9px; background:linear-gradient(135deg,#1c1206,#120c04); border:1.5px solid var(--gold2); border-radius:10px; padding:9px 18px; box-shadow:0 0 16px rgba(180,130,30,.16); }
.coins-icon { font-size:24px; }
.coins-lbl { font-family:'Cinzel',serif; font-size:9px; color:var(--gold2); letter-spacing:2px; text-transform:uppercase; }
.coins-val { font-family:'Cinzel',serif; font-size:20px; font-weight:700; color:var(--gold); }
.tbtn { font-family:'Cinzel',serif; font-size:11px; letter-spacing:1px; cursor:pointer; border-radius:7px; padding:8px 16px; transition:all .18s; }
.tbtn-side  { background:linear-gradient(135deg,#28180a,#160e04); border:1.5px solid #8a6020; color:var(--gold); }
.tbtn-side:hover  { background:linear-gradient(135deg,#44280e,#281606); box-shadow:0 0 12px rgba(190,130,30,.35); }
.tbtn-reset { background:linear-gradient(135deg,#180808,#0c0404); border:1.5px solid #502020; color:#b07070; }
.tbtn-reset:hover { border-color:#903030; color:#d09090; }
.sbadge { background:var(--gold); color:#180800; border-radius:3px; padding:2px 9px; font-weight:700; font-size:12px; letter-spacing:1px; }
.legend { text-align:center; font-size:10px; font-style:italic; color:#5a3a16; margin:0 0 16px; letter-spacing:.5px; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(264px,1fr)); gap:14px; max-width:1160px; margin:0 auto 22px; }
.card { border-radius:12px; overflow:hidden; box-shadow:0 6px 26px rgba(0,0,0,.6); }
.card-head { padding:11px 13px 9px; }
.card-nation { font-family:'Cinzel',serif; font-size:16px; font-weight:700; display:flex; align-items:center; gap:7px; color:#fff; }
.pos-badge { display:inline-block; font-family:'Cinzel',serif; font-size:9px; background:rgba(0,0,0,.4); border:1px solid rgba(255,255,255,.15); border-radius:3px; padding:1px 6px; letter-spacing:1px; margin-left:4px; color:rgba(255,255,255,.55); }
.card-sub { font-size:11px; font-style:italic; color:rgba(255,255,255,.65); margin-top:2px; }
.card-body { background:var(--panel); padding:11px 13px; }
.mrow { margin-bottom:10px; }
.mrow-title { font-family:'Cinzel',serif; font-size:8.5px; letter-spacing:3px; text-transform:uppercase; margin-bottom:5px; display:flex; align-items:center; gap:6px; }
.mrow-title.l { color:var(--lcol); }
.mrow-title.c { color:var(--ccol); }
.mrow-good { font-style:italic; font-family:'Crimson Text',serif; font-size:10px; opacity:.68; letter-spacing:0; }
.sell-strip   { font-size:9.5px; font-style:italic; margin-bottom:3px; color:#80a060; }
.sell-strip.c { color:#c06060; }
.cols { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; margin-top:5px; }
.col { border-radius:5px; padding:5px 2px 4px; text-align:center; }
.col.l { background:rgba(180,140,30,.1); border:1px solid rgba(180,140,30,.2); }
.col.c { background:rgba(180,30,30,.1);  border:1px solid rgba(180,30,30,.2); }
.col.empty { opacity:.3; }
.col.sell-target   { box-shadow:0 0 0 1.5px #80c060; }
.col.sell-target.c { box-shadow:0 0 0 1.5px #c06060; }
.cap-bar { display:flex; justify-content:center; gap:2px; margin-bottom:3px; }
.cap-pip { width:7px; height:7px; border-radius:2px; }
.cap-pip.fl { background:var(--lcol); }
.cap-pip.fc { background:var(--ccol); }
.cap-pip.emp { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.15); }
.col-prices { display:flex; justify-content:center; gap:2px; margin-bottom:2px; }
.p-sell { font-family:'Cinzel',serif; font-size:7px; color:#68b848; }
.p-buy  { font-family:'Cinzel',serif; font-size:7px; color:#b87830; }
.p-sep  { font-size:6.5px; opacity:.25; }
.col-qty { font-family:'Cinzel',serif; font-size:20px; font-weight:700; line-height:1; }
.col.l .col-qty { color:var(--lcol); }
.col.c .col-qty { color:var(--ccol); }
.col-t { font-size:7.5px; opacity:.4; margin-top:1px; }
.actions { background:rgba(0,0,0,.28); border-top:1px solid var(--bdr); padding:9px 11px; }
.qty-row { display:flex; align-items:center; gap:7px; margin-bottom:7px; }
.qty-lbl { font-family:'Cinzel',serif; font-size:8.5px; letter-spacing:2px; color:var(--gold2); text-transform:uppercase; flex:1; }
.qty-ctrl { display:flex; align-items:center; gap:4px; }
.qb { width:23px; height:23px; border-radius:4px; border:1px solid #5a3e0e; background:#140e02; color:var(--gold); font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .14s; padding:0; }
.qb:hover { background:#221a06; border-color:#8a6020; }
.qv { font-family:'Cinzel',serif; font-size:16px; color:var(--gold); font-weight:700; min-width:22px; text-align:center; }
.abtns { display:grid; grid-template-columns:1fr 1fr; gap:4px; }
.ab { border-radius:5px; padding:7px 4px; font-family:'Cinzel',serif; font-size:9px; letter-spacing:.7px; cursor:pointer; text-transform:uppercase; font-weight:600; border:none; transition:all .14s; line-height:1.35; }
.ab:hover  { transform:translateY(-1px); filter:brightness(1.12); }
.ab:active { transform:translateY(0); }
.ab-bl { background:linear-gradient(135deg,#342800,#201800); color:#f0c820; border:1px solid #604a0e; }
.ab-sl { background:linear-gradient(135deg,#182c00,#101c00); color:#78cc48; border:1px solid #346010; }
.ab-bc { background:linear-gradient(135deg,#360808,#200404); color:#f06868; border:1px solid #621818; }
.ab-sc { background:linear-gradient(135deg,#1e0c36,#120820); color:#b870e0; border:1px solid #462670; }
.contra-note { font-size:8.5px; font-style:italic; color:#72381a; text-align:center; margin-top:4px; }
.hist { max-width:1160px; margin:0 auto; border:1px solid var(--bdr); border-radius:10px; overflow:hidden; }
.hist-h { padding:9px 15px; background:rgba(18,12,4,.9); border-bottom:1px solid var(--bdr); font-family:'Cinzel',serif; font-size:9.5px; letter-spacing:3px; color:var(--gold2); text-transform:uppercase; }
.hist-list { max-height:200px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#362006 transparent; }
.hi { display:flex; gap:10px; padding:5px 15px; border-bottom:1px solid rgba(255,255,255,.025); font-size:13px; }
.hi:hover { background:rgba(255,255,255,.02); }
.hi-t { font-family:'Cinzel',serif; font-size:8.5px; color:#4e3010; white-space:nowrap; flex-shrink:0; padding-top:2px; }
.hi-m { color:#bfa060; line-height:1.45; }
.hist-empty { padding:16px 15px; font-style:italic; color:#432e0e; font-size:13px; }

/* ── Modal ── */
.overlay { position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; }
.modal {
  background:linear-gradient(160deg,#1c1208,#100c04);
  border:2px solid #7a5a18; border-radius:14px;
  padding:24px 28px; width:100%; max-width:520px;
  box-shadow:0 0 50px rgba(200,150,40,.25), 0 20px 60px rgba(0,0,0,.7);
  max-height:90vh; overflow-y:auto;
  scrollbar-width:thin; scrollbar-color:#3a2008 transparent;
}
.modal-title { font-family:'Pirata One',serif; font-size:26px; color:var(--gold); text-align:center; text-shadow:0 0 20px rgba(240,192,48,.4); }
.modal-subtitle { font-family:'Cinzel',serif; font-size:9px; letter-spacing:4px; color:var(--gold2); text-align:center; text-transform:uppercase; margin:4px 0 20px; }

.modal-order { margin-bottom:20px; }
.modal-order-title { font-family:'Cinzel',serif; font-size:9px; letter-spacing:3px; color:var(--gold2); text-transform:uppercase; margin-bottom:8px; }
.order-chain { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.order-nation { display:flex; align-items:center; gap:5px; font-family:'Cinzel',serif; font-size:12px; color:var(--text); }
.order-arrow { color:var(--gold2); font-size:14px; opacity:.6; }

.dice-section { margin-bottom:6px; }
.dice-section-title { font-family:'Cinzel',serif; font-size:9px; letter-spacing:3px; color:var(--gold2); text-transform:uppercase; margin-bottom:10px; }

.dice-nation { display:flex; align-items:stretch; gap:10px; margin-bottom:8px; padding:10px; background:rgba(0,0,0,.25); border-radius:8px; border:1px solid rgba(255,255,255,.06); }
.dice-nation-label { font-family:'Cinzel',serif; font-size:12px; color:var(--text); display:flex; align-items:center; gap:6px; min-width:120px; }
.dice-results { flex:1; display:flex; flex-direction:column; gap:5px; }
.dice-row { display:flex; align-items:center; gap:8px; }
.dice-type { font-family:'Cinzel',serif; font-size:8px; letter-spacing:1.5px; text-transform:uppercase; width:82px; flex-shrink:0; }
.dice-type.l { color:var(--lcol); }
.dice-type.c { color:var(--ccol); }
.dice-val {
  width:36px; height:36px; border-radius:8px;
  font-family:'Cinzel',serif; font-size:20px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
.dice-val.l { background:rgba(180,140,30,.2); border:1.5px solid rgba(180,140,30,.4); color:var(--lcol); }
.dice-val.c { background:rgba(180,30,30,.2);  border:1.5px solid rgba(180,30,30,.4);  color:var(--ccol); }
.dice-preview { font-size:11px; font-style:italic; color:#6a4a20; flex:1; line-height:1.3; }
.dice-preview.c { color:#6a2020; }

.dice-pips { display:flex; gap:3px; align-items:center; flex-wrap:wrap; }
.dp { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
.dp.on.l { background:var(--lcol); }
.dp.on.c { background:var(--ccol); }
.dp.off   { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.15); }

.modal-btns { display:flex; gap:10px; margin-top:20px; }
.mbtn { flex:1; border-radius:8px; padding:11px; font-family:'Cinzel',serif; font-size:11px; letter-spacing:1px; cursor:pointer; text-transform:uppercase; font-weight:700; transition:all .18s; border:none; }
.mbtn:hover { transform:translateY(-1px); filter:brightness(1.12); }
.mbtn-reroll { background:linear-gradient(135deg,#28180a,#160e04); border:1.5px solid #8a6020; color:var(--gold); }
.mbtn-ok     { background:linear-gradient(135deg,#182c00,#101c00); border:1.5px solid #4a8020; color:#90d050; }
`;

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES
// ══════════════════════════════════════════════════════════════════════════════

function CapBar({ count, cap, type }) {
  return (
    <div className="cap-bar">
      {Array.from({ length: cap }).map((_, i) => (
        <div key={i} className={`dp ${i < count ? `on ${type}` : "off"}`} />
      ))}
    </div>
  );
}

function MarketRow({ type, goodName, cols, caps, sellPrices, buyPrices, qty }) {
  const t = type === "legal" ? "l" : "c";
  const { col: sellCol } = getSellInfo(cols, sellPrices, qty);
  const { cost, bought }   = doBuy([...cols], buyPrices, qty);
  const { income, unitPrice } = getSellInfo(cols, sellPrices, qty);

  const buyLabel = bought === 0 ? "Sin stock"
    : bought < qty ? `Solo ${bought} disp. — −${cost.toLocaleString()} ⚜`
    : `Comprar ${qty}: −${cost.toLocaleString()} ⚜`;
  const sellLabel = `Vender ${qty} @ ${unitPrice.toLocaleString()}/u → +${income.toLocaleString()} ⚜`;

  return (
    <div className="mrow">
      <div className={`mrow-title ${t}`}>
        {type === "legal" ? "⚖" : "💀"} {type === "legal" ? "LEGAL" : "CONTRABANDO"}
        <span className="mrow-good">{goodName}</span>
      </div>
      <div className={`sell-strip ${t}`}>▲ {sellLabel}</div>
      <div className="sell-strip" style={{color:"#b07030"}}>▼ {buyLabel}</div>
      <div className="cols">
        {cols.map((count, col) => (
          <div
            key={col}
            className={`col ${t} ${count === 0 ? "empty" : ""} ${col === sellCol ? `sell-target ${t}` : ""}`}
            title={`T${col+1} | Cap: ${caps[col]} | ▲${sellPrices[col]} ▼${buyPrices[col]}`}
          >
            <CapBar count={count} cap={caps[col]} type={t} />
            <div className="col-prices">
              <span className="p-sell">▲{sellPrices[col]}</span>
              <span className="p-sep">|</span>
              <span className="p-buy">▼{buyPrices[col]}</span>
            </div>
            <div className="col-qty">{count}</div>
            <div className="col-t">T{col+1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketCard({ market, mi, side, allMarkets, onAction }) {
  const [qty, setQty] = useState(1);
  const [bg, border]  = NATION_BG[market.nation];
  const prices        = PRICES[side];
  const pi            = prevIdx(mi);             // nación superior = anterior
  const ni            = nextIdx(mi);             // nación inferior = siguiente
  const prevMarket    = allMarkets[pi];
  const contraGood    = GOODS[prevMarket.nation];

  return (
    <div className="card" style={{ border:`2px solid ${border}` }}>
      <div className="card-head" style={{ background:`linear-gradient(135deg,${bg},${border})` }}>
        <div className="card-nation">
          {FLAGS[market.nation]} {market.nation}
          <span className="pos-badge">#{mi+1}</span>
        </div>
        <div className="card-sub">
          Legal: {GOODS[market.nation]} · Contra.: {contraGood} (de {prevMarket.nation})
        </div>
      </div>
      <div className="card-body">
        <MarketRow
          type="legal"
          goodName={GOODS[market.nation]}
          cols={market.legal}
          caps={LEGAL_CAPS}
          sellPrices={prices.legal.sell}
          buyPrices={prices.legal.buy}
          qty={qty}
        />
        <MarketRow
          type="contraband"
          goodName={contraGood}
          cols={prevMarket.contraband}
          caps={CONTRA_CAPS}
          sellPrices={prices.contraband.sell}
          buyPrices={prices.contraband.buy}
          qty={qty}
        />
        <div className="actions">
          <div className="qty-row">
            <span className="qty-lbl">Cantidad</span>
            <div className="qty-ctrl">
              <button className="qb" onClick={() => setQty(q => Math.max(1, q-1))}>−</button>
              <span className="qv">{qty}</span>
              <button className="qb" onClick={() => setQty(q => Math.min(12, q+1))}>+</button>
            </div>
          </div>
          <div className="abtns">
            <button className="ab ab-bl" onClick={() => onAction("buyLegal",      mi, qty)}>⬇ Comprar Legal</button>
            <button className="ab ab-sl" onClick={() => onAction("sellLegal",     mi, qty)}>⬆ Vender Legal</button>
            <button className="ab ab-bc" onClick={() => onAction("buyContraband", mi, qty)}>⬇ Comp. Contra.</button>
            <button className="ab ab-sc" onClick={() => onAction("sellContraband",mi, qty)}>⬆ Vend. Contra.</button>
          </div>
          <div className="contra-note">
            Contra.: fila de {prevMarket.nation} · Repone legal → {allMarkets[ni].nation}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preview de dados ──────────────────────────────────────────────────────────
function DicePreview({ caps, roll, type }) {
  const filled = rollFill(caps, roll);
  const total  = filled.reduce((a,b) => a+b, 0);
  const t = type === "legal" ? "l" : "c";
  return (
    <div>
      <div className="dice-pips" style={{marginBottom:"3px"}}>
        {caps.map((cap, col) =>
          Array.from({length: cap}).map((_, k) => (
            <div
              key={`${col}-${k}`}
              className={`dp ${k < filled[col] ? `on ${t}` : "off"}`}
              title={`T${col+1}`}
            />
          ))
        )}
      </div>
      <div className={`dice-preview ${t}`}>
        {filled.map((v,i) => `T${i+1}:${v}`).join("  ")} → {total} fichas
      </div>
    </div>
  );
}

// ── Modal de inicio ───────────────────────────────────────────────────────────
function DiceModal({ onConfirm }) {
  const [order, setOrder] = useState(() => shuffle(NATIONS));
  const [rolls, setRolls] = useState(() => order.map(() => ({ legal: d8(), contraband: d8() })));

  const reroll = () => {
    const newOrder = shuffle(NATIONS);
    setOrder(newOrder);
    setRolls(newOrder.map(() => ({ legal: d8(), contraband: d8() })));
  };

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-title">🎲 Nueva Partida</div>
        <div className="modal-subtitle">Orden de naciones y tirada de dados</div>

        {/* Orden circular */}
        <div className="modal-order">
          <div className="modal-order-title">Orden del mercado (circular)</div>
          <div className="order-chain">
            {order.map((n, i) => (
              <span key={n} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <span className="order-nation">{FLAGS[n]} {n}</span>
                <span className="order-arrow">→</span>
              </span>
            ))}
            <span className="order-nation" style={{opacity:.4,fontSize:"11px"}}>↩ {FLAGS[order[0]]}</span>
          </div>
          <div style={{fontSize:"10px",fontStyle:"italic",color:"#5a3a16",marginTop:"6px"}}>
            El contrabando de cada nación = mercancía de la siguiente en el círculo
          </div>
        </div>

        {/* Dados por nación */}
        <div className="dice-section">
          <div className="dice-section-title">Resultado de los dados (d8 por fila)</div>
          {order.map((nation, i) => (
            <div key={nation} className="dice-nation">
              <div className="dice-nation-label">
                {FLAGS[nation]}<span style={{fontFamily:"'Cinzel',serif",fontSize:"13px"}}>{nation}</span>
              </div>
              <div className="dice-results">
                {/* Legal */}
                <div className="dice-row">
                  <span className="dice-type l">⚖ Legal</span>
                  <div className={`dice-val l`}>{rolls[i].legal}</div>
                  <DicePreview caps={LEGAL_CAPS} roll={rolls[i].legal} type="legal" />
                </div>
                {/* Contrabando */}
                <div className="dice-row">
                  <span className="dice-type c">💀 Contra.</span>
                  <div className={`dice-val c`}>{rolls[i].contraband}</div>
                  <DicePreview caps={CONTRA_CAPS} roll={rolls[i].contraband} type="contraband" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-btns">
          <button className="mbtn mbtn-reroll" onClick={reroll}>🎲 Volver a tirar</button>
          <button className="mbtn mbtn-ok" onClick={() => onConfirm(order, rolls)}>⚓ Comenzar</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [state,     setState]     = useState(() => {
    try { const s = localStorage.getItem("clmk6"); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [showModal, setShowModal] = useState(!state);

  useEffect(() => {
    if (state) try { localStorage.setItem("clmk6", JSON.stringify(state)); } catch {}
  }, [state]);

  const handleConfirm = (order, rolls) => {
    setState(buildState(order, rolls));
    setShowModal(false);
  };

  const act  = (type, mi, qty) => setState(prev => ACTIONS[type](prev, mi, qty));
  const flip = () => setState(s => ({ ...s, side: s.side === "A" ? "B" : "A" }));

  return (
    <>
      <style>{css}</style>
      {showModal && <DiceModal onConfirm={handleConfirm} />}
      {state && (
        <div className="app">
          <div className="hdr">
            <h1>⚓ Captain's Log ⚓</h1>
            <div className="hdr-sub">Gestor de Mercado Pirata</div>
          </div>
          <div className="topbar">
            <div className="coins">
              <span className="coins-icon">🪙</span>
              <div>
                <div className="coins-lbl">Doblones</div>
                <div className="coins-val">{state.doubloons.toLocaleString()}</div>
              </div>
            </div>
            <button className="tbtn tbtn-side" onClick={flip}>
              Cara&nbsp;<span className="sbadge">{state.side}</span>
              &nbsp;→ Cambiar a {state.side === "A" ? "B" : "A"}
            </button>
            <button className="tbtn tbtn-reset" onClick={() => setShowModal(true)}>🎲 Nueva Partida</button>
          </div>
          <div className="legend">
            ▲ precio venta · ▼ precio compra · T1–T4 tramos izq.→dcha. ·
            <span style={{color:"#80c060"}}> verde</span> = tramo de venta actual ·
            los puntitos = capacidad del tramo
          </div>
          <div className="grid">
            {state.markets.map((market, mi) => (
              <MarketCard
                key={market.nation}
                market={market}
                mi={mi}
                side={state.side}
                allMarkets={state.markets}
                onAction={act}
              />
            ))}
          </div>
          <div className="hist">
            <div className="hist-h">📜 Historial de transacciones</div>
            <div className="hist-list">
              {state.history.length === 0
                ? <div className="hist-empty">Sin transacciones aún…</div>
                : state.history.map((item, i) => (
                    <div key={i} className="hi">
                      <span className="hi-t">{item.t}</span>
                      <span className="hi-m">{item.msg}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
}
