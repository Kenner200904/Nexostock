import React, { useState, useRef, useMemo } from "react";
import BrandLogo from "./BrandLogo";

/* ─── Data ────────────────────────────────────────────────────── */
const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const mesLabel = (i: number) => `${MES[i % 12]} ${2023 + Math.floor(i / 12)}`;

interface Pt {
  label: string;
  hist: number | null;
  proj: number | null;
  lo:   number | null;
  hi:   number | null;
}

const H = [
  342,318,356,391,428,465,443,487,509,532,554,509,
  367,341,382,418,456,493,471,518,541,567,589,548,
];

/* [lo, mid, hi] — index 0 = Dec 2024 anchor, indices 1-6 = Jan–Jun 2025 */
const P: [number,number,number][] = [
  [548,548,548],[536,574,612],[518,563,608],
  [546,601,656],[573,634,695],[552,618,684],[580,654,728],
];

const ALL_DATA: Pt[] = [
  ...H.map((v,i) => ({
    label: mesLabel(i), hist: v,
    proj: i === 23 ? P[0][1] : null,
    lo:   i === 23 ? P[0][0] : null,
    hi:   i === 23 ? P[0][2] : null,
  })),
  ...P.slice(1).map(([lo,mid,hi],j) => ({
    label: mesLabel(24+j), hist: null, proj: mid, lo, hi,
  })),
];

/* ─── Chart geometry ──────────────────────────────────────────── */
const VBW = 900, VBH = 300;
const PL = 54, PR = 16, PT = 16, PB = 44;
const CW = VBW - PL - PR;
const CH = VBH - PT - PB;

const tx = (i: number, n: number) => PL + (i / Math.max(n - 1, 1)) * CW;
const ty = (v: number, lo: number, hi: number) => PT + CH - ((v - lo) / (hi - lo)) * CH;

function yRange(data: Pt[]) {
  const vs = data.flatMap(d => [d.hist,d.proj,d.lo,d.hi]).filter((v): v is number => v !== null);
  if (!vs.length) return { yLo: 0, yHi: 1000 };
  const mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn) * 0.12;
  return { yLo: Math.floor((mn - pad) / 50) * 50, yHi: Math.ceil((mx + pad) / 50) * 50 };
}

function yTicks(yLo: number, yHi: number): number[] {
  const range = yHi - yLo;
  let step = 50;
  while (range / step > 5) step *= 2;
  const ticks: number[] = [];
  for (let v = Math.ceil(yLo / step) * step; v <= yHi + 1; v += step) ticks.push(v);
  return ticks;
}

function linePath(data: Pt[], key: "hist" | "proj", n: number, yLo: number, yHi: number) {
  const segs: string[] = [];
  data.forEach((d, i) => {
    const v = d[key];
    if (v === null) return;
    segs.push(`${segs.length === 0 ? "M" : "L"} ${tx(i,n)} ${ty(v,yLo,yHi)}`);
  });
  return segs.join(" ");
}

function bandPath(data: Pt[], n: number, yLo: number, yHi: number) {
  const band = data.map((d,i) => d.lo !== null && d.hi !== null ? {i, lo: d.lo, hi: d.hi} : null).filter(Boolean) as {i:number,lo:number,hi:number}[];
  if (band.length < 2) return "";
  const top = band.map(b => `${tx(b.i,n)} ${ty(b.hi,yLo,yHi)}`);
  const bot = [...band].reverse().map(b => `${tx(b.i,n)} ${ty(b.lo,yLo,yHi)}`);
  return `M ${top.join(" L ")} L ${bot.join(" L ")} Z`;
}

function showLabel(i: number, n: number) {
  if (n <= 10) return true;
  if (n <= 14) return i % 2 === 0;
  if (n <= 20) return i % 3 === 0;
  return i % 5 === 0;
}

/* ─── Icons ───────────────────────────────────────────────────── */
type IK = "grid"|"trend"|"bar"|"box"|"swap"|"alert"|"cpu"|"bell"|"gear"|"back"|"menu"|"x"|"info"|"check"|"dots";

function Icon({ n, sz = 18 }: { n: IK; sz?: number }) {
  const b: Record<IK, React.ReactNode> = {
    grid:  <><rect x="3" y="3" width="6" height="6"/><rect x="11" y="3" width="6" height="6"/><rect x="3" y="11" width="6" height="6"/><rect x="11" y="11" width="6" height="6"/></>,
    trend: <><path d="M2 14 7 9l4 4 7-8"/><path d="M15 5h5v5"/></>,
    bar:   <><rect x="2" y="11" width="3" height="7"/><rect x="7" y="7" width="3" height="11"/><rect x="12" y="3" width="3" height="15"/><rect x="17" y="8" width="3" height="10"/></>,
    box:   <><path d="m3 6 7-3 7 3-7 3-7-3Z"/><path d="M3 6v8l7 3 7-3V6M10 9v8"/></>,
    swap:  <><path d="M3 7h14M3 7l4-4M3 7l4 4"/><path d="M17 13H3m14 0-4-4m4 4-4 4"/></>,
    alert: <><path d="M10 2 1 17h18L10 2Z"/><path d="M10 8v4m0 3.5v.5"/></>,
    cpu:   <><rect x="5" y="5" width="10" height="10"/><path d="M9 1v4m2-4v4M9 15v4m2-4v4M1 9h4m-4 2h4m11-2h4m-4 2h4"/></>,
    bell:  <><path d="M15 9a5 5 0 0 0-10 0c0 6-2 6-2 7h14c0-1-2-1-2-7Z"/><path d="M8 20h4"/></>,
    gear:  <><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2m0 12v2m8-8h-2M4 10H2m13.7-5.7-1.4 1.4M5.7 14.3l-1.4 1.4m11.4 0-1.4-1.4M5.7 5.7 4.3 4.3"/></>,
    back:  <path d="M15 10H3m0 0 5-5m-5 5 5 5"/>,
    menu:  <><path d="M3 5h14M3 10h14M3 15h14"/></>,
    x:     <path d="M4 4l12 12M16 4 4 16"/>,
    info:  <><circle cx="10" cy="10" r="8"/><path d="M10 7v.5M10 10v4"/></>,
    check: <path d="M3 10l5 5 9-9"/>,
    dots:  <><circle cx="5" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none"/></>,
  };
  return (
    <svg viewBox="0 0 20 20" style={{ width: sz, height: sz }} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{b[n]}</svg>
  );
}

/* ─── KPI card ────────────────────────────────────────────────── */
interface KpiProps {
  label: string; value: string; unit?: string;
  change: string; up: boolean; sub?: string;
}
function KpiCard({ label, value, unit, change, up, sub }: KpiProps) {
  return (
    <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
      <p className="wire-label">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p>
          <strong className="text-[2rem] font-medium leading-none tracking-[-.06em]">{value}</strong>
          {unit && <span className="ml-1.5 font-mono text-sm text-[#686863]">{unit}</span>}
        </p>
        <span className={`shrink-0 font-mono text-[11px] font-medium ${up ? "text-[#168178]" : "text-[#db3f2f]"}`}>
          {change}
        </span>
      </div>
      {sub && <p className="mt-2.5 font-mono text-[10px] leading-[1.5] text-[#686863]">{sub}</p>}
    </article>
  );
}

/* ─── Nav ─────────────────────────────────────────────────────── */
const NAV_GROUPS = [
  { group: "Análisis", items: [
    { id: "resumen",      label: "Resumen",               icon: "grid"  as IK },
    { id: "prediccion",   label: "Predicciones",           icon: "trend" as IK },
    { id: "comparativo",  label: "Comparativo histórico",  icon: "bar"   as IK },
  ]},
  { group: "Inventario", items: [
    { id: "stock",        label: "Stock actual",           icon: "box"   as IK },
    { id: "movimientos",  label: "Movimientos",            icon: "swap"  as IK },
    { id: "mermas",       label: "Mermas",                 icon: "alert" as IK },
  ]},
  { group: "Sistema", items: [
    { id: "modelo",       label: "Modelo ML",              icon: "cpu"   as IK },
    { id: "alertas",      label: "Alertas",                icon: "bell"  as IK },
    { id: "ajustes",      label: "Configuración",          icon: "gear"  as IK },
  ]},
];

const BADGE: Record<string, string> = { alertas: "3", mermas: "!" };

/* ─── Period options ──────────────────────────────────────────── */
const PERIODS = ["3M","6M","12M","Todo"] as const;
type PeriodT = typeof PERIODS[number];
const PERIOD_N: Record<PeriodT, number> = { "3M": 9, "6M": 12, "12M": 18, "Todo": 30 };

/* ─── Main component ──────────────────────────────────────────── */
export default function AdminPanel({ onBack, onSeasonality, onAlerts, onIngestion }: { onBack?: () => void; onSeasonality?: () => void; onAlerts?: () => void; onIngestion?: () => void }) {
  const [activeNav, setActiveNav] = useState("resumen");
  const [period, setPeriod]       = useState<PeriodT>("12M");
  const [showHist, setShowHist]   = useState(true);
  const [showProj, setShowProj]   = useState(true);
  const [showBand, setShowBand]   = useState(true);
  const [hoverIdx, setHoverIdx]   = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const visible   = useMemo(() => ALL_DATA.slice(ALL_DATA.length - PERIOD_N[period]), [period]);
  const { yLo, yHi } = useMemo(() => yRange(visible), [visible]);
  const ticks     = useMemo(() => yTicks(yLo, yHi), [yLo, yHi]);
  const n         = visible.length;

  const hPath = useMemo(() => showHist ? linePath(visible,"hist",n,yLo,yHi) : "", [visible,n,yLo,yHi,showHist]);
  const pPath = useMemo(() => showProj ? linePath(visible,"proj",n,yLo,yHi) : "", [visible,n,yLo,yHi,showProj]);
  const bPath = useMemo(() => showBand ? bandPath(visible,n,yLo,yHi) : "", [visible,n,yLo,yHi,showBand]);

  /* index where purely-projection starts (hist becomes null) */
  const splitIdx = visible.findIndex(d => d.hist === null && d.proj !== null);

  /* hover */
  const hPct    = hoverIdx !== null ? (tx(hoverIdx, n) / VBW) * 100 : null;
  const isRight = hPct !== null && hPct > 55;

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VBW;
    const cx = svgX - PL;
    if (cx < 0 || cx > CW) { setHoverIdx(null); return; }
    setHoverIdx(Math.max(0, Math.min(n - 1, Math.round((cx / CW) * (n - 1)))));
  }

  const hd = hoverIdx !== null ? visible[hoverIdx] : null;

  /* MAE sparkline: fixed values for illustration */
  const maeSpark = [11.2,10.8,10.1,9.7,9.4,9.0,8.6,8.3];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#e8e8e2] text-[#151515]">
      <div className="top-strip shrink-0" />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className={`flex h-full flex-col overflow-y-auto border-r border-[#2a2a27] bg-[#151515] transition-all duration-200 ${collapsed ? "w-[64px]" : "w-56"} shrink-0`}>

          {/* Logo row */}
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#2a2a27] px-4">
            <div className={`flex items-center gap-1.5 overflow-hidden ${collapsed ? "w-0 opacity-0" : "opacity-100"} transition-all`}>
              <BrandLogo dark />
            </div>
            <button onClick={() => setCollapsed(v => !v)}
              className="shrink-0 text-[#686863] transition-colors hover:text-white"
              aria-label="Colapsar menú">
              <Icon n={collapsed ? "menu" : "x"} sz={16} />
            </button>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto py-4">
            {NAV_GROUPS.map(({ group, items }) => (
              <div key={group} className="mb-5">
                {!collapsed && (
                  <p className="mb-1.5 px-4 font-mono text-[9px] font-medium uppercase tracking-[.14em] text-[#454540]">
                    {group}
                  </p>
                )}
                {items.map(({ id, label, icon }) => {
                  const active = activeNav === id;
                  const badge = BADGE[id];
                  return (
                    <button key={id} onClick={() => setActiveNav(id)}
                      className={`relative flex w-full items-center gap-3 py-2.5 text-left text-sm transition-colors ${
                        collapsed ? "justify-center px-0" : "px-4"
                      } ${active
                        ? "border-l-2 border-[#168178] bg-[#1d1d1a] text-white"
                        : "border-l-2 border-transparent text-[#9a9a94] hover:bg-[#1d1d1a] hover:text-white"
                      }`}
                    >
                      <Icon n={icon} sz={16} />
                      {!collapsed && <span className="flex-1 leading-none">{label}</span>}
                      {!collapsed && badge && (
                        <span className={`rounded-none px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                          badge === "!" ? "bg-[#db3f2f] text-white" : "bg-[#2a2a27] text-[#9a9a94]"
                        }`}>{badge}</span>
                      )}
                      {collapsed && badge && (
                        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#db3f2f]" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Profile / back */}
          <div className="shrink-0 border-t border-[#2a2a27] py-3">
            {!collapsed && (
              <div className="mb-2 px-4 pb-2 border-b border-[#2a2a27]">
                <p className="text-sm font-semibold text-white">Ana M. Rojas</p>
                <p className="wire-label mt-0.5 text-[#454540]">Administrador · Mercado SJ</p>
              </div>
            )}
            {!collapsed && (
              <p className="mb-1 px-4 font-mono text-[9px] font-medium uppercase tracking-[.14em] text-[#454540]">
                Accesos rápidos
              </p>
            )}
            {onSeasonality && (
              <button onClick={onSeasonality}
                className={`flex w-full items-center gap-3 py-2.5 text-[#9a9a94] transition-colors hover:bg-[#1d1d1a] hover:text-white ${collapsed ? "justify-center" : "px-4"}`}>
                <Icon n="bar" sz={16} />
                {!collapsed && <span className="text-sm">Estacionalidad</span>}
              </button>
            )}
            {onAlerts && (
              <button onClick={onAlerts}
                className={`flex w-full items-center gap-3 py-2.5 text-[#9a9a94] transition-colors hover:bg-[#1d1d1a] hover:text-white ${collapsed ? "justify-center" : "px-4"}`}>
                <Icon n="alert" sz={16} />
                {!collapsed && <span className="text-sm">Alertas de stock</span>}
              </button>
            )}
            {onIngestion && (
              <button onClick={onIngestion}
                className={`flex w-full items-center gap-3 py-2.5 text-[#9a9a94] transition-colors hover:bg-[#1d1d1a] hover:text-white ${collapsed ? "justify-center" : "px-4"}`}>
                <Icon n="swap" sz={16} />
                {!collapsed && <span className="text-sm">Ingesta de datos</span>}
              </button>
            )}
            {onBack && (
              <button onClick={onBack}
                className={`flex w-full items-center gap-3 py-2.5 text-[#686863] transition-colors hover:text-white ${collapsed ? "justify-center" : "px-4"}`}>
                <Icon n="back" sz={16} />
                {!collapsed && <span className="text-sm">Volver al dashboard</span>}
              </button>
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex flex-1 flex-col overflow-hidden">

          {/* Page header */}
          <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#b6b6b1] bg-[#f5f5f0] px-6 md:px-8">
            <div>
              <p className="wire-label text-[#168178]">Panel de control / {activeNav}</p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-[-.04em]">
                {activeNav === "resumen"     ? "Resumen ejecutivo" :
                 activeNav === "prediccion"  ? "Predicciones de demanda" :
                 activeNav === "comparativo" ? "Comparativo histórico" :
                 activeNav === "stock"       ? "Stock actual" :
                 activeNav === "movimientos" ? "Movimientos" :
                 activeNav === "mermas"      ? "Análisis de mermas" :
                 activeNav === "modelo"      ? "Configuración del modelo" :
                 activeNav === "alertas"     ? "Centro de alertas" :
                 "Configuración del sistema"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="wire-label">Actualizado</p>
                <p className="font-mono text-[11px] font-medium">Hoy, 08:43 a.m.</p>
              </div>
              <div className="relative">
                <button className="border border-[#b6b6b1] bg-[#e8e8e2] p-2 transition-colors hover:bg-[#deded8]">
                  <Icon n="bell" sz={16} />
                </button>
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#db3f2f]" />
              </div>
              <button className="border border-[#b6b6b1] bg-[#e8e8e2] p-2 transition-colors hover:bg-[#deded8]">
                <Icon n="dots" sz={16} />
              </button>
            </div>
          </header>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] p-5 md:p-7">

              {/* ── KPI row 1: Model quality ── */}
              <div className="mb-2">
                <p className="wire-label text-[#168178]">Calidad del modelo / métricas de error</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="MAE — Error absoluto medio"
                  value="8.3" unit="und."
                  change="−1.2 vs mes ant."
                  up={true}
                  sub={`Sparkline: ${maeSpark.join(" → ")}`}
                />
                {/* MAE sparkline card override with visual */}
                <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
                  <p className="wire-label">MAE — Evolución mensual</p>
                  <div className="mt-4 flex items-end gap-0.5 h-10">
                    {maeSpark.map((v,i) => {
                      const mn = Math.min(...maeSpark), mx = Math.max(...maeSpark);
                      const h = ((v - mn) / (mx - mn)) * 32 + 8;
                      return (
                        <div key={i} style={{ height: h, flex: 1 }}
                          className={`transition-colors ${i === maeSpark.length-1 ? "bg-[#168178]" : "bg-[#deded8]"}`} />
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="wire-label text-[#aaa]">11.2 → 8.3</span>
                    <span className="wire-label text-[#168178]">−26%</span>
                  </div>
                </article>
                <KpiCard
                  label="MAPE — Error porcentual"
                  value="11.2" unit="%"
                  change="−0.8 pts"
                  up={true}
                  sub="Umbral aceptable: &lt; 15% · Estado: dentro del rango"
                />
                <KpiCard
                  label="Precisión global del modelo"
                  value="87.4" unit="%"
                  change="+2.1 pts"
                  up={true}
                  sub="RMSE: 12.7 und. · R²: 0.91 · Entrenado: ago 2026"
                />
              </div>

              {/* ── KPI row 2: Capital optimization ── */}
              <div className="mb-2 mt-6">
                <p className="wire-label text-[#168178]">Optimización de capital / impacto comercial</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Capital optimizado"
                  value="C$ 142,800"
                  change="+C$ 18,400"
                  up={true}
                  sub="Reducción de sobreinventario congelado este trimestre"
                />
                <KpiCard
                  label="Ahorro en inventario"
                  value="C$ 48,200"
                  change="−34% mermas"
                  up={true}
                  sub="Vencimientos evitados + pedidos optimizados vs línea base"
                />
                <KpiCard
                  label="ROI del modelo"
                  value="2.4×"
                  change="+0.3× trimestre"
                  up={true}
                  sub="Por cada C$ 1 invertido en Nexo Stock → C$ 2.4 en eficiencia"
                />
                <KpiCard
                  label="SKUs activos / en seguimiento"
                  value="1,284"
                  change="+46 esta semana"
                  up={true}
                  sub="8 SKUs en riesgo crítico de ruptura · Requieren acción"
                />
              </div>

              {/* ── Chart ── */}
              <section className="mt-6 border border-[#b6b6b1] bg-[#fafaf7]">

                {/* Chart header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#b6b6b1] p-5">
                  <div>
                    <p className="wire-label text-[#168178]">Modelo supervisado / regresión temporal</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-.04em]">
                      Ventas históricas vs. Proyección de demanda
                    </h2>
                    <p className="mt-1 font-mono text-[11px] text-[#686863]">
                      Categoría: abarrotes · Intervalo de confianza 90% · Confianza: 91%
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap items-start gap-4">
                    {/* Period selector */}
                    <div className="flex border border-[#b6b6b1]">
                      {PERIODS.map(p => (
                        <button key={p} onClick={() => { setPeriod(p); setHoverIdx(null); }}
                          className={`px-3 py-1.5 font-mono text-[11px] transition-colors ${
                            period === p
                              ? "bg-[#151515] text-white"
                              : "bg-[#fafaf7] text-[#686863] hover:bg-[#e8e8e2]"
                          }`}>{p}</button>
                      ))}
                    </div>

                    {/* Series toggles */}
                    <div className="flex flex-col gap-1.5">
                      {[
                        { show: showHist, set: setShowHist, color: "#168178", label: "Ventas históricas", dash: false },
                        { show: showProj, set: setShowProj, color: "#80d3c9", label: "Proyección ML",     dash: true  },
                        { show: showBand, set: setShowBand, color: "#168178", label: "Intervalo 90%",     band: true  },
                      ].map(({ show, set, color, label, dash, band }) => (
                        <label key={label} className="flex cursor-pointer items-center gap-2 select-none">
                          <span onClick={() => set(v => !v)}
                            className={`flex size-4 shrink-0 items-center justify-center border transition-colors ${
                              show ? "border-[#168178] bg-[#168178]" : "border-[#b6b6b1] bg-white"
                            }`}>
                            {show && <Icon n="check" sz={10} />}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#686863]">
                            {band
                              ? <span className="h-2.5 w-4 opacity-30" style={{ background: color }} />
                              : dash
                              ? <span className="h-px w-4 border-t border-dashed" style={{ borderColor: color }} />
                              : <span className="h-px w-4" style={{ background: color }} />
                            }
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SVG chart */}
                <div className="relative select-none px-2 py-4">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${VBW} ${VBH}`}
                    className="w-full cursor-crosshair"
                    style={{ height: "auto", minHeight: 200 }}
                    preserveAspectRatio="xMidYMid meet"
                    onMouseMove={onMouseMove}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    {/* Y grid + labels */}
                    {ticks.map(v => (
                      <g key={v}>
                        <line x1={PL} y1={ty(v,yLo,yHi)} x2={PL+CW} y2={ty(v,yLo,yHi)}
                          stroke="#e1e1dc" strokeWidth="1" />
                        <text x={PL-6} y={ty(v,yLo,yHi)+3.5} textAnchor="end"
                          fontSize="9" fill="#686863" fontFamily="DM Mono,monospace">{v}</text>
                      </g>
                    ))}

                    {/* Axes */}
                    <line x1={PL} y1={PT} x2={PL} y2={PT+CH} stroke="#b6b6b1" strokeWidth="1" />
                    <line x1={PL} y1={PT+CH} x2={PL+CW} y2={PT+CH} stroke="#b6b6b1" strokeWidth="1" />

                    {/* Projection zone background */}
                    {splitIdx > 0 && (() => {
                      const startX = tx(splitIdx, n);
                      return <rect x={startX} y={PT} width={PL+CW-startX} height={CH} fill="#168178" fillOpacity="0.04" />;
                    })()}

                    {/* Projection separator */}
                    {splitIdx > 0 && (
                      <>
                        <line
                          x1={tx(splitIdx,n)} y1={PT}
                          x2={tx(splitIdx,n)} y2={PT+CH}
                          stroke="#e4ad3d" strokeWidth="1" strokeDasharray="4 2" opacity="0.7"
                        />
                        <text x={tx(splitIdx,n)+5} y={PT+13}
                          fontSize="8" fill="#c39122" fontFamily="DM Mono,monospace"
                          letterSpacing="0.06em">PROYECCIÓN →</text>
                      </>
                    )}

                    {/* Confidence band */}
                    {bPath && <path d={bPath} fill="#168178" fillOpacity="0.12" stroke="none" />}

                    {/* Historical line */}
                    {hPath && (
                      <path d={hPath} fill="none" stroke="#168178" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    )}

                    {/* Projection line */}
                    {pPath && (
                      <path d={pPath} fill="none" stroke="#80d3c9" strokeWidth="2"
                        strokeDasharray="6 4" strokeLinecap="round" />
                    )}

                    {/* X axis labels */}
                    {visible.map((d, i) => showLabel(i, n) && (
                      <text key={i} x={tx(i,n)} y={VBH-6} textAnchor="middle"
                        fontSize="9" fill="#686863" fontFamily="DM Mono,monospace">
                        {d.label}
                      </text>
                    ))}

                    {/* Hover crosshair */}
                    {hoverIdx !== null && (
                      <>
                        <line
                          x1={tx(hoverIdx,n)} y1={PT}
                          x2={tx(hoverIdx,n)} y2={PT+CH}
                          stroke="#686863" strokeWidth="1" strokeDasharray="3 3"
                        />
                        {hd?.hist !== null && hd?.hist !== undefined && (
                          <circle cx={tx(hoverIdx,n)} cy={ty(hd.hist,yLo,yHi)}
                            r="4.5" fill="#168178" stroke="#fafaf7" strokeWidth="2" />
                        )}
                        {hd?.proj !== null && hd?.proj !== undefined && (
                          <circle cx={tx(hoverIdx,n)} cy={ty(hd.proj,yLo,yHi)}
                            r="4" fill="#80d3c9" stroke="#fafaf7" strokeWidth="2" />
                        )}
                      </>
                    )}
                  </svg>

                  {/* HTML tooltip */}
                  {hoverIdx !== null && hd && (
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: `${hPct}%`,
                        transform: isRight ? "translateX(-108%)" : "translateX(4px)",
                        pointerEvents: "none",
                        zIndex: 10,
                      }}
                      className="min-w-[172px] border border-[#b6b6b1] bg-[#fafaf7] shadow-sm"
                    >
                      <div className="border-b border-[#e8e8e2] px-3 py-2">
                        <p className="wire-label">{hd.label}</p>
                      </div>
                      <div className="px-3 py-2.5 space-y-1.5">
                        {hd.hist !== null && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#686863]">
                              <span className="h-px w-4 bg-[#168178] inline-block" />
                              Ventas hist.
                            </span>
                            <strong className="font-mono text-[11px]">{hd.hist} und.</strong>
                          </div>
                        )}
                        {hd.proj !== null && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#686863]">
                              <span className="h-px w-4 border-t border-dashed border-[#80d3c9] inline-block" />
                              Proyección ML
                            </span>
                            <strong className="font-mono text-[11px] text-[#168178]">{hd.proj} und.</strong>
                          </div>
                        )}
                        {hd.lo !== null && hd.hi !== null && hd.lo !== hd.hi && (
                          <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#e8e8e2]">
                            <span className="font-mono text-[10px] text-[#aaa]">IC 90%</span>
                            <span className="font-mono text-[10px] text-[#686863]">{hd.lo}–{hd.hi}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Legend + stats strip */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#b6b6b1] px-5 py-3">
                  <div className="flex flex-wrap gap-5">
                    <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.10em] text-[#686863]">
                      <span className="h-px w-5 bg-[#168178] inline-block" />
                      Ventas históricas
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.10em] text-[#686863]">
                      <span className="h-px w-5 border-t border-dashed border-[#80d3c9] inline-block" />
                      Proyección de demanda
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.10em] text-[#686863]">
                      <span className="h-3 w-4 bg-[#168178] opacity-20 inline-block" />
                      Intervalo de confianza 90%
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="wire-label">Confianza</p>
                      <p className="font-mono text-sm font-medium text-[#168178]">91%</p>
                    </div>
                    <div className="text-right">
                      <p className="wire-label">Horizonte</p>
                      <p className="font-mono text-sm font-medium">+6 meses</p>
                    </div>
                    <div className="text-right">
                      <p className="wire-label">Modelo</p>
                      <p className="font-mono text-sm font-medium">ARIMA + XGB</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Bottom detail row ── */}
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {/* Projection summary */}
                <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
                  <p className="wire-label text-[#168178]">Proyección / resumen Jun 2025</p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-.05em]">654 <span className="text-base font-normal text-[#686863]">und. proyectadas</span></p>
                  <div className="mt-4 space-y-2 border-t border-[#e8e8e2] pt-3">
                    {[["Mínimo IC 90%","580 und."],["Máximo IC 90%","728 und."],["Crecimiento vs Dic 2024","+19.3%"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-[#686863]">{k}</span>
                        <strong className="font-mono text-[12px]">{v}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                {/* Error decomposition */}
                <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
                  <p className="wire-label text-[#168178]">Descomposición del error / MAE</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Error de tendencia",  pct: 28, v: "2.3 und." },
                      { label: "Error estacional",    pct: 45, v: "3.7 und." },
                      { label: "Error residual",      pct: 27, v: "2.3 und." },
                    ].map(({ label, pct, v }) => (
                      <div key={label}>
                        <div className="mb-1 flex justify-between">
                          <span className="font-mono text-[11px] text-[#686863]">{label}</span>
                          <span className="font-mono text-[11px] font-medium">{v}</span>
                        </div>
                        <div className="h-1 w-full bg-[#e1e1dc]">
                          <div className="h-full bg-[#168178] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 wire-label text-[#aaa]">MAE total: 8.3 und. · RMSE: 12.7 und.</p>
                </article>

                {/* Capital recommendation */}
                <article className="border border-[#151515] bg-[#151515] p-5 text-white">
                  <p className="wire-label text-[#80d3c9]">Siguiente acción / capital</p>
                  <p className="mt-4 text-lg font-semibold leading-snug tracking-[-.04em]">
                    Liberar C$ 18,400 en sobreinventario de aceite vegetal.
                  </p>
                  <div className="mt-5 space-y-2.5 border-t border-[#2a2a27] pt-4">
                    {[["SKUs afectados","3 productos"],["Impacto en ROI","+0.2×"],["Fecha límite","13 sep. 2026"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-[#9a9a94]">{k}</span>
                        <strong className="font-mono text-[12px]">{v}</strong>
                      </div>
                    ))}
                  </div>
                  <button className="mt-5 w-full bg-[#80d3c9] px-4 py-3 text-sm font-bold text-[#12332f] transition-colors hover:bg-white">
                    Ejecutar recomendación →
                  </button>
                </article>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
