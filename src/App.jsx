import { useState, useEffect } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// DATOS — según el manual "El Mercado" (páginas 36-39)
// ══════════════════════════════════════════════════════════════════════════════

// Orden de naciones (índice 0→3). La nación SUPERIOR de X = (X-1+4)%4.
// La reposición va siempre a la nación INFERIOR = (X+1)%4.
const NATIONS = ["Holanda", "España", "Inglaterra", "Francia"];
const FLAGS   = { Holanda:"🇳🇱", España:"🇪🇸", Inglaterra:"🇬🇧", Francia:"🇫🇷" };
const GOODS   = { Holanda:"Té", España:"Plata", Inglaterra:"Algodón", Francia:"Azúcar" };

// La fila de contrabando en cada puerto pertenece a la nación SUPERIOR
// Holanda→superior=Francia(Azúcar), España→Holanda(Té), Inglaterra→España(Plata), Francia→Inglaterra(Algodón)
const UPPER = (n) => NATIONS[(NATIONS.indexOf(n) - 1 + 4) % 4];
const LOWER = (n) => NATIONS[(NATIONS.indexOf(n) + 1) % 4];
const CONTRA_GOOD = (portNation) => GOODS[UPPER(portNation)];

// ── PRECIOS (tablero del manual) ─────────────────────────────────────────────
// 4 columnas, izquierda→derecha (T1=col0 más caro, T4=col3 más barato).
// Compra: derecha→izquierda | Venta: primer hueco libre desde la izquierda.
// ▲ = precio venta (lo que recibes al vender AL mercado)
// ▼ = precio compra (lo que pagas al comprar DEL mercado)
//
// Cara A: mismo precio legal/contrabando
//   Venta: [500, 1000, 1000, 500]   Compra: [1000, 1000, 500, 500]
//
// Cara B: precios de VENTA más altos y distintos para legal/contrabando
//   Legal  venta: [1500, 1000, 1000, 500]   Legal  compra: [1000, 1000, 500, 500]
//   Contra venta: [2000, 1500, 1000, 500]   Contra compra: [1500, 1000, 500, 500]
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
// MOTOR DE REGLAS
// ══════════════════════════════════════════════════════════════════════════════

const roundUp500 = (v) => (v % 500 === 0 ? v : v + 500 - (v % 500));

// COMPRA: derecha→izquierda. Devuelve { cost, bought, newCols }.
function doBuy(cols, buyPrices, qty) {
  const nc = [...cols];
  let rem = qty, cost = 0, bought = 0;
  for (let c = 3; c >= 0 && rem > 0; c--) {
    while (nc[c] > 0 && rem > 0) { cost += buyPrices[c]; nc[c]--; rem--; bought++; }
  }
  return { cost: roundUp500(cost), bought, newCols: nc };
}

// VENTA: precio = primer hueco libre desde la izquierda (o T4 si todos llenos).
// NO modifica el mercado actual — las fichas van a la reserva.
// Reposición: floor(qty/2) al mercado de la nación inferior.
function getSellInfo(cols, sellPrices, qty) {
  const ei = cols.findIndex((v) => v === 0);
  const col = ei === -1 ? 3 : ei;
  return { col, unitPrice: sellPrices[col], income: roundUp500(sellPrices[col] * qty) };
}

// Reposición: rellena desde T4→T1 (derecha a izquierda, primero los más baratos).
function replenish(cols, qty) {
  const nc = [...cols];
  let rem = qty;
  for (let c = 3; c >= 0 && rem > 0; c--) { nc[c]++; rem--; }
  return nc;
}

function deepCopy(markets) {
  return markets.map((m) => ({ ...m, legal:[...m.legal], contraband:[...m.contraband] }));
}

function log(state, msg) {
  const t = new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return { ...state, history: [{ t, msg }, ...state.history].slice(0, 80) };
}

// COMPRA LEGAL en el mercado de la nación actual
function buyLegal(state, mi, qty) {
  const nation  = state.markets[mi].nation;
  const prices  = PRICES[state.side].legal;
  const { cost, bought, newCols } = doBuy(state.markets[mi].legal, prices.buy, qty);
  if (!bought) return log(state, `⚠️ Sin stock legal en ${nation}`);
  const markets = deepCopy(state.markets);
  markets[mi].legal = newCols;
  return log(
    { ...state, doubloons: state.doubloons - cost, markets },
    `💰 Comprado ${bought} ${GOODS[nation]} legal en ${nation} — −${cost.toLocaleString()} doblones`
  );
}

// COMPRA DE CONTRABANDO en la fila de la nación SUPERIOR
function buyContraband(state, mi, qty) {
  const port   = state.markets[mi].nation;
  const upper  = UPPER(port);
  const ui     = state.markets.findIndex((m) => m.nation === upper);
  const prices = PRICES[state.side].contraband;
  const { cost, bought, newCols } = doBuy(state.markets[ui].contraband, prices.buy, qty);
  if (!bought) return log(state, `⚠️ Sin contrabando de ${upper} en ${port}`);
  const markets = deepCopy(state.markets);
  markets[ui].contraband = newCols;
  return log(
    { ...state, doubloons: state.doubloons - cost, markets },
    `🏴‍☠️ Comprado ${bought} ${GOODS[upper]} (contra. de ${upper}) en ${port} — −${cost.toLocaleString()} doblones`
  );
}

// VENTA LEGAL: precio por primer hueco libre. Reposición → nación inferior.
function sellLegal(state, mi, qty) {
  const nation  = state.markets[mi].nation;
  const lower   = LOWER(nation);
  const prices  = PRICES[state.side].legal;
  const { income, unitPrice } = getSellInfo(state.markets[mi].legal, prices.sell, qty);
  const repAmt  = Math.floor(qty / 2);
  const markets = deepCopy(state.markets);
  const li      = markets.findIndex((m) => m.nation === lower);
  if (repAmt > 0) markets[li].legal = replenish(markets[li].legal, repAmt);
  return log(
    { ...state, doubloons: state.doubloons + income, markets },
    `⚓ Vendido ${qty} ${GOODS[nation]} legal (${unitPrice.toLocaleString()}/u) en ${nation} — +${income.toLocaleString()} doblones${repAmt ? ` | reposición: ${repAmt} ${GOODS[lower]} → ${lower}` : ""}`
  );
}

// VENTA DE CONTRABANDO en la fila de la nación SUPERIOR.
// Reposición: floor(qty/2) al contrabando del PROPIO puerto (UPPER(port)+1 = port).
function sellContraband(state, mi, qty) {
  const port   = state.markets[mi].nation;
  const upper  = UPPER(port);
  const ui     = state.markets.findIndex((m) => m.nation === upper);
  const prices = PRICES[state.side].contraband;
  const { income, unitPrice } = getSellInfo(state.markets[ui].contraband, prices.sell, qty);
  const repAmt = Math.floor(qty / 2);
  const markets = deepCopy(state.markets);
  // Repón en el contrabando del propio puerto (nación inferior de upper = port)
  if (repAmt > 0) markets[mi].contraband = replenish(markets[mi].contraband, repAmt);
  return log(
    { ...state, doubloons: state.doubloons + income, markets },
    `🏴‍☠️ Vendido ${qty} ${GOODS[upper]} contra. (${unitPrice.toLocaleString()}/u) en ${port} — +${income.toLocaleString()} doblones${repAmt ? ` | reposición: ${repAmt} → ${port}` : ""}`
  );
}

const ACTIONS = { buyLegal, buyContraband, sellLegal, sellContraband };

// ══════════════════════════════════════════════════════════════════════════════
// ESTADO INICIAL
// ══════════════════════════════════════════════════════════════════════════════

const mkState = () => ({
  side: "A",
  doubloons: 10000,
  markets: NATIONS.map((nation) => ({
    nation,
    legal:      [1, 1, 2, 2],
    contraband: [0, 1, 2, 2],
  })),
  history: [],
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES
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
    radial-gradient(ellipse at 15% 15%, rgba(100,60,10,.16) 0%,transparent 45%),
    radial-gradient(ellipse at 85% 85%, rgba(60,20,5,.2) 0%,transparent 45%);
}

/* ── Header ── */
.hdr { text-align:center; margin-bottom:20px; }
.hdr h1 {
  font-family:'Pirata One',serif;
  font-size:clamp(24px,5.5vw,50px);
  color:var(--gold);
  text-shadow:0 0 22px rgba(240,192,48,.4), 2px 2px 0 #200e00;
  letter-spacing:2px;
}
.hdr-sub { font-family:'Cinzel',serif; font-size:10px; color:var(--gold2); letter-spacing:5px; text-transform:uppercase; margin-top:4px; }

/* ── Top bar ── */
.topbar { display:flex; justify-content:center; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:18px; }

.coins {
  display:flex; align-items:center; gap:9px;
  background:linear-gradient(135deg,#1c1206,#120c04);
  border:1.5px solid var(--gold2); border-radius:10px;
  padding:9px 18px;
  box-shadow:0 0 16px rgba(180,130,30,.16);
}
.coins-icon { font-size:24px; }
.coins-lbl { font-family:'Cinzel',serif; font-size:9px; color:var(--gold2); letter-spacing:2px; text-transform:uppercase; }
.coins-val { font-family:'Cinzel',serif; font-size:20px; font-weight:700; color:var(--gold); }

.tbtn { font-family:'Cinzel',serif; font-size:11px; letter-spacing:1px; cursor:pointer; border-radius:7px; padding:8px 16px; transition:all .18s; }
.tbtn-side { background:linear-gradient(135deg,#28180a,#160e04); border:1.5px solid #8a6020; color:var(--gold); }
.tbtn-side:hover { background:linear-gradient(135deg,#44280e,#281606); box-shadow:0 0 12px rgba(190,130,30,.35); }
.tbtn-reset { background:linear-gradient(135deg,#180808,#0c0404); border:1.5px solid #502020; color:#b07070; }
.tbtn-reset:hover { border-color:#903030; color:#d09090; }
.sbadge { background:var(--gold); color:#180800; border-radius:3px; padding:2px 9px; font-weight:700; font-size:12px; letter-spacing:1px; }

.legend {
  text-align:center; font-size:10px; font-style:italic; color:#5a3a16;
  margin:0 0 16px; letter-spacing:.5px;
}

/* ── Market grid ── */
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(264px,1fr)); gap:14px; max-width:1160px; margin:0 auto 22px; }

/* ── Card ── */
.card { border-radius:12px; overflow:hidden; box-shadow:0 6px 26px rgba(0,0,0,.6); }

.card-head { padding:11px 13px 9px; }
.card-nation { font-family:'Cinzel',serif; font-size:16px; font-weight:700; display:flex; align-items:center; gap:7px; color:#fff; }
.card-sub { font-size:11px; font-style:italic; color:rgba(255,255,255,.65); margin-top:2px; }

.card-body { background:var(--panel); padding:11px 13px; }

/* ── Market row ── */
.mrow { margin-bottom:10px; }
.mrow-title { font-family:'Cinzel',serif; font-size:8.5px; letter-spacing:3px; text-transform:uppercase; margin-bottom:5px; display:flex; align-items:center; gap:6px; }
.mrow-title.l { color:var(--lcol); }
.mrow-title.c { color:var(--ccol); }
.mrow-good { font-style:italic; font-family:'Crimson Text',serif; font-size:10px; opacity:.68; letter-spacing:0; }

/* Sell info strip */
.sell-strip { font-size:9.5px; font-style:italic; margin-bottom:4px; color:#80a060; }
.sell-strip.c { color:#c06060; }

/* Columns */
.cols { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; }

.col { border-radius:5px; padding:5px 2px 4px; text-align:center; }
.col.l  { background:rgba(180,140,30,.1);  border:1px solid rgba(180,140,30,.2); }
.col.c  { background:rgba(180,30,30,.1);   border:1px solid rgba(180,30,30,.2); }
.col.empty { opacity:.3; }
.col.sell-target { box-shadow:0 0 0 1.5px #80c060; }
.col.sell-target.c { box-shadow:0 0 0 1.5px #c06060; }

.col-prices { display:flex; justify-content:center; gap:2px; margin-bottom:2px; }
.p-sell { font-family:'Cinzel',serif; font-size:7px; color:#68b848; letter-spacing:.3px; }
.p-buy  { font-family:'Cinzel',serif; font-size:7px; color:#b87830; letter-spacing:.3px; }
.p-sep  { font-size:6.5px; opacity:.25; }
.col-qty { font-family:'Cinzel',serif; font-size:20px; font-weight:700; line-height:1; }
.col.l .col-qty { color:var(--lcol); }
.col.c .col-qty { color:var(--ccol); }
.col-t { font-size:7.5px; opacity:.4; margin-top:1px; }

/* ── Actions ── */
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

/* ── History ── */
.hist { max-width:1160px; margin:0 auto; border:1px solid var(--bdr); border-radius:10px; overflow:hidden; }
.hist-h { padding:9px 15px; background:rgba(18,12,4,.9); border-bottom:1px solid var(--bdr); font-family:'Cinzel',serif; font-size:9.5px; letter-spacing:3px; color:var(--gold2); text-transform:uppercase; }
.hist-list { max-height:200px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#362006 transparent; }
.hi { display:flex; gap:10px; padding:5px 15px; border-bottom:1px solid rgba(255,255,255,.025); font-size:13px; }
.hi:hover { background:rgba(255,255,255,.02); }
.hi-t { font-family:'Cinzel',serif; font-size:8.5px; color:#4e3010; white-space:nowrap; flex-shrink:0; padding-top:2px; }
.hi-m { color:#bfa060; line-height:1.45; }
.hist-empty { padding:16px 15px; font-style:italic; color:#432e0e; font-size:13px; }
`;

// ── MarketRow ──────────────────────────────────────────────────────────────
function MarketRow({ type, goodName, cols, sellPrices, buyPrices, qty }) {
  const t = type === "legal" ? "l" : "c";
  const { col: sellCol } = getSellInfo(cols, sellPrices, qty);
  const { cost, bought } = doBuy([...cols], buyPrices, qty);

  const buyLabel = bought === 0
    ? "Sin stock"
    : bought < qty ? `Solo ${bought} disponibles — −${cost.toLocaleString()} ⚜`
    : `Compra ${qty}: −${cost.toLocaleString()} ⚜`;

  const { income, unitPrice } = getSellInfo(cols, sellPrices, qty);
  const sellLabel = `Venta ${qty} @ ${unitPrice.toLocaleString()}/u → +${income.toLocaleString()} ⚜`;

  return (
    <div className="mrow">
      <div className={`mrow-title ${t}`}>
        {type === "legal" ? "⚖" : "💀"} {type === "legal" ? "LEGAL" : "CONTRABANDO"}
        <span className="mrow-good">{goodName}</span>
      </div>

      <div className={`sell-strip ${t}`}>▲ {sellLabel}</div>
      <div className="sell-strip" style={{color:"#b07030"}}>▼ {buyLabel}</div>

      <div className="cols" style={{marginTop:"5px"}}>
        {cols.map((count, col) => (
          <div
            key={col}
            className={`col ${t} ${count === 0 ? "empty" : ""} ${col === sellCol ? `sell-target ${t}` : ""}`}
            title={`T${col+1} | Venta: ${sellPrices[col]} | Compra: ${buyPrices[col]}`}
          >
            <div className="col-prices">
              <span className="p-sell">▲{sellPrices[col]}</span>
              <span className="p-sep">|</span>
              <span className="p-buy">▼{buyPrices[col]}</span>
            </div>
            <div className="col-qty">{count}</div>
            <div className="col-t">T{col + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MarketCard ─────────────────────────────────────────────────────────────
function MarketCard({ market, mi, side, allMarkets, onAction }) {
  const [qty, setQty] = useState(1);
  const [bg, border]  = NATION_BG[market.nation];
  const prices        = PRICES[side];
  const upperNation   = UPPER(market.nation);
  const upperMarket   = allMarkets.find((m) => m.nation === upperNation);

  return (
    <div className="card" style={{ border:`2px solid ${border}` }}>
      <div className="card-head" style={{ background:`linear-gradient(135deg,${bg},${border})` }}>
        <div className="card-nation">{FLAGS[market.nation]} {market.nation}</div>
        <div className="card-sub">Puerto de {GOODS[market.nation]} · Contra.: {CONTRA_GOOD(market.nation)} ({upperNation})</div>
      </div>

      <div className="card-body">
        {/* Mercado legal de esta nación */}
        <MarketRow
          type="legal"
          goodName={GOODS[market.nation]}
          cols={market.legal}
          sellPrices={prices.legal.sell}
          buyPrices={prices.legal.buy}
          qty={qty}
        />

        {/* Fila de contrabando = la de la nación superior */}
        <MarketRow
          type="contraband"
          goodName={GOODS[upperNation]}
          cols={upperMarket.contraband}
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
          <div className="contra-note">Contrabando: fila de {upperNation}</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [state, setState] = useState(() => {
    try { const s = localStorage.getItem("clmk4"); return s ? JSON.parse(s) : mkState(); }
    catch { return mkState(); }
  });

  useEffect(() => {
    try { localStorage.setItem("clmk4", JSON.stringify(state)); } catch {}
  }, [state]);

  const act = (type, mi, qty) => setState((prev) => ACTIONS[type](prev, mi, qty));
  const flip  = () => setState((s) => ({ ...s, side: s.side === "A" ? "B" : "A" }));
  const reset = () => { if (confirm("¿Reiniciar partida?")) setState(mkState()); };

  return (
    <>
      <style>{css}</style>
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
          <button className="tbtn tbtn-reset" onClick={reset}>↺ Reiniciar</button>
        </div>

        <div className="legend">
          ▲ precio de venta (lo que recibes) &nbsp;·&nbsp; ▼ precio de compra (lo que pagas) &nbsp;·&nbsp;
          T1–T4 = tramos izq.→dcha. &nbsp;·&nbsp; <span style={{color:"#80c060"}}>borde verde</span> = tramo de venta actual
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
            {state.history.length === 0 ? (
              <div className="hist-empty">Sin transacciones aún…</div>
            ) : state.history.map((item, i) => (
              <div key={i} className="hi">
                <span className="hi-t">{item.t}</span>
                <span className="hi-m">{item.msg}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
