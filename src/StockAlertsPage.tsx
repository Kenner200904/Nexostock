import React, { useState, useMemo, useRef, useEffect } from "react";

/* ─── Types ───────────────────────────────────────────────────── */
type Status = "out" | "critical" | "warning" | "watch" | "ok";
type SortKey = "status" | "id" | "name" | "stock" | "reorder" | "deficit" | "runout";
type OrderState = "idle" | "loading" | "done";

interface Product {
  id: string; name: string; category: string;
  stock: number; reorder: number; unit: string;
  supplier: string; leadDays: number; unitCost: number;
  runout: string;
}

/* ─── Status config ───────────────────────────────────────────── */
const S_CONF: Record<Status, {
  rowBg: string; accent: string; badgeBg: string;
  badgeText: string; label: string; priority: number;
}> = {
  out:      { rowBg:"#fbe2df", accent:"#db3f2f", badgeBg:"#db3f2f",  badgeText:"#fff",     label:"RUPTURA",  priority:0 },
  critical: { rowBg:"#fef0ee", accent:"#c0392b", badgeBg:"#c0392b",  badgeText:"#fff",     label:"CRÍTICO",  priority:1 },
  warning:  { rowBg:"#fff9eb", accent:"#e4ad3d", badgeBg:"#e4ad3d",  badgeText:"#664d0e",  label:"ATENCIÓN", priority:2 },
  watch:    { rowBg:"#f5f5f0", accent:"#b6b6b1", badgeBg:"transparent", badgeText:"#686863", label:"VIGILAR",  priority:3 },
  ok:       { rowBg:"#fafaf7", accent:"#168178", badgeBg:"transparent", badgeText:"#168178", label:"OK",       priority:4 },
};

function getStatus(stock: number, reorder: number): Status {
  if (stock === 0)              return "out";
  if (stock <= reorder * 0.3)   return "critical";
  if (stock <= reorder)         return "warning";
  if (stock <= reorder * 1.5)   return "watch";
  return "ok";
}

/* ─── Data ────────────────────────────────────────────────────── */
const PRODUCTS: Product[] = [
  { id:"SKU-001", name:"Aceite vegetal 900 ml",       category:"Abarrotes", stock:0,   reorder:60,  unit:"und.",   supplier:"Distribuidora Central", leadDays:3, unitCost:58.50,  runout:"2026-09-01" },
  { id:"SKU-013", name:"Refresco Tang sobre 20 g",    category:"Bebidas",   stock:0,   reorder:120, unit:"sobres", supplier:"Distribuidora Central", leadDays:2, unitCost:4.80,   runout:"2026-09-01" },
  { id:"SKU-011", name:"Pan de molde mediano",         category:"Panadería", stock:3,   reorder:20,  unit:"und.",   supplier:"Panadería Artesanal",  leadDays:1, unitCost:45.00,  runout:"2026-09-01" },
  { id:"SKU-008", name:"Pollo entero congelado",       category:"Carnes",    stock:5,   reorder:25,  unit:"kg",     supplier:"Avícola del Valle",    leadDays:1, unitCost:92.00,  runout:"2026-09-02" },
  { id:"SKU-002", name:"Arroz 80/20 5 lb",             category:"Granos",    stock:8,   reorder:50,  unit:"und.",   supplier:"Granos del Norte",     leadDays:2, unitCost:62.00,  runout:"2026-09-03" },
  { id:"SKU-003", name:"Leche líquida entera 1 L",     category:"Lácteos",   stock:14,  reorder:40,  unit:"und.",   supplier:"Lácteos Selectos",    leadDays:1, unitCost:35.80,  runout:"2026-09-04" },
  { id:"SKU-014", name:"Cloro líquido 900 ml",         category:"Limpieza",  stock:11,  reorder:30,  unit:"und.",   supplier:"Química Industrial",  leadDays:3, unitCost:28.50,  runout:"2026-09-05" },
  { id:"SKU-004", name:"Azúcar granulada 2 kg",        category:"Abarrotes", stock:22,  reorder:45,  unit:"und.",   supplier:"Azúcar Selecta",      leadDays:4, unitCost:74.50,  runout:"2026-09-06" },
  { id:"SKU-005", name:"Frijoles rojos 1 lb",          category:"Granos",    stock:31,  reorder:80,  unit:"und.",   supplier:"Granos del Norte",     leadDays:2, unitCost:24.00,  runout:"2026-09-08" },
  { id:"SKU-006", name:"Jabón de lavar 400 g",         category:"Higiene",   stock:18,  reorder:30,  unit:"und.",   supplier:"Dist. Nacional",       leadDays:3, unitCost:22.00,  runout:"2026-09-10" },
  { id:"SKU-010", name:"Detergente en polvo 1 kg",     category:"Limpieza",  stock:27,  reorder:35,  unit:"und.",   supplier:"Dist. Nacional",       leadDays:3, unitCost:55.00,  runout:"2026-09-12" },
  { id:"SKU-007", name:"Pasta dental Colgate 100 ml",  category:"Higiene",   stock:45,  reorder:40,  unit:"und.",   supplier:"Dist. Nacional",       leadDays:3, unitCost:32.50,  runout:"2026-09-15" },
  { id:"SKU-015", name:"Cereal Corn Flakes 500 g",     category:"Abarrotes", stock:38,  reorder:30,  unit:"und.",   supplier:"Distribuidora Central", leadDays:5, unitCost:88.00,  runout:"2026-09-18" },
  { id:"SKU-012", name:"Café molido 250 g",             category:"Bebidas",   stock:56,  reorder:45,  unit:"und.",   supplier:"Café Origen",          leadDays:4, unitCost:125.00, runout:"2026-09-20" },
  { id:"SKU-009", name:"Sal refinada 1 kg",             category:"Abarrotes", stock:112, reorder:60,  unit:"und.",   supplier:"Sal del Pacífico",     leadDays:5, unitCost:12.00,  runout:"2026-10-01" },
];

const CATEGORIES = ["Todas", ...Array.from(new Set(PRODUCTS.map(p => p.category))).sort()];

function suggestedQty(p: Product) {
  return Math.max(p.reorder * 2 - p.stock, p.reorder);
}

/* ─── Icons ───────────────────────────────────────────────────── */
type IK = "back"|"search"|"sort-asc"|"sort-desc"|"sort-none"|"alert"|"check"|"x"|"cart"|"chevron-down"|"chevron-up"|"info"|"filter"|"bulk";
function Icon({ n, sz=16 }: { n:IK; sz?:number }) {
  const b: Record<IK, React.ReactNode> = {
    back:         <path d="M15 10H3m0 0 5-5m-5 5 5 5"/>,
    search:       <><circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5"/></>,
    "sort-asc":   <path d="M10 16V4m0 0L6 8m4-4 4 4"/>,
    "sort-desc":  <path d="M10 4v12m0 0L6 8m4 8 4-4"/>,
    "sort-none":  <><path d="M7 4l3 4 3-4"/><path d="M7 16l3-4 3 4"/></>,
    alert:        <><path d="M10 2 1 17h18L10 2Z"/><path d="M10 8v4m0 3.5v.5"/></>,
    check:        <path d="M3 10l5 5 9-9"/>,
    x:            <path d="M4 4l12 12M16 4 4 16"/>,
    cart:         <><path d="M2 2h2l2.4 9.6a1 1 0 0 0 .96.8H14a1 1 0 0 0 .96-.73L17 6H5"/><circle cx="9" cy="17" r="1.5"/><circle cx="14" cy="17" r="1.5"/></>,
    "chevron-down":<path d="M5 8l5 5 5-5"/>,
    "chevron-up":  <path d="M15 12l-5-5-5 5"/>,
    info:         <><circle cx="10" cy="10" r="8"/><path d="M10 7v.5M10 10v4"/></>,
    filter:       <path d="M3 5h14M6 10h8M9 15h2"/>,
    bulk:         <><rect x="3" y="3" width="6" height="6"/><rect x="11" y="3" width="6" height="6"/><rect x="3" y="11" width="6" height="6"/><path d="M11 14h6m-3-3v6"/></>,
  };
  return (
    <svg viewBox="0 0 20 20" style={{ width:sz, height:sz }} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{b[n]}</svg>
  );
}

/* ─── Order panel (drawer) ────────────────────────────────────── */
interface OrderPanelProps {
  product: Product & { status: Status };
  qty: number;
  onQtyChange: (q: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  state: OrderState;
}
function OrderPanel({ product, qty, onQtyChange, onConfirm, onClose, state }: OrderPanelProps) {
  const total = qty * product.unitCost;
  const sc = S_CONF[product.status];
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#151515]/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-[#b6b6b1] bg-[#fafaf7] shadow-xl">
        {/* Panel header */}
        <div className="flex items-start justify-between border-b border-[#b6b6b1] px-6 py-5">
          <div>
            <p className="wire-label text-[#168178]">Orden de compra / generación</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-.04em]">Nueva orden</h2>
          </div>
          <button onClick={onClose} className="text-[#686863] transition-colors hover:text-[#151515]">
            <Icon n="x" sz={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Product info */}
          <div className="border border-[#b6b6b1] p-4" style={{ borderLeft:`4px solid ${sc.accent}` }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold leading-snug tracking-[-.03em]">{product.name}</p>
                <p className="wire-label mt-0.5">{product.category} · {product.id}</p>
              </div>
              <span className="shrink-0 px-2 py-0.5 font-mono text-[10px] font-bold"
                style={{ background: sc.badgeBg, color: sc.badgeText, outline: sc.badgeBg === "transparent" ? `1px solid ${sc.accent}` : "none" }}>
                {sc.label}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e8e8e2] pt-3">
              {[["Stock actual", `${product.stock} ${product.unit}`],["Punto de reorden", `${product.reorder} ${product.unit}`],
                ["Ruptura estimada", product.runout],["Proveedor", product.supplier]].map(([k,v])=>(
                <div key={k}>
                  <p className="wire-label">{k}</p>
                  <p className="mt-0.5 font-mono text-[11px] font-medium">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quantity input */}
          <div>
            <label className="wire-label mb-2 block text-[#168178]">
              Cantidad a ordenar ({product.unit})
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => onQtyChange(Math.max(1, qty - 1))}
                className="flex size-9 items-center justify-center border border-[#b6b6b1] bg-white text-lg font-bold transition-colors hover:bg-[#e8e8e2]">
                −
              </button>
              <input
                type="number" min={1} value={qty}
                onChange={e => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-9 w-24 border border-[#b6b6b1] bg-white px-3 text-center font-mono text-sm outline-none focus:border-[#168178]"
              />
              <button onClick={() => onQtyChange(qty + 1)}
                className="flex size-9 items-center justify-center border border-[#b6b6b1] bg-white text-lg font-bold transition-colors hover:bg-[#e8e8e2]">
                +
              </button>
              <button onClick={() => onQtyChange(suggestedQty(product))}
                className="border border-[#168178] px-3 py-1.5 font-mono text-[10px] text-[#168178] transition-colors hover:bg-[#e6f0ed]">
                Sugerido: {suggestedQty(product)}
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div className="border border-[#b6b6b1] divide-y divide-[#e8e8e2]">
            {[
              ["Cantidad", `${qty} ${product.unit}`],
              ["Costo unitario", `C$ ${product.unitCost.toFixed(2)}`],
              ["Plazo de entrega", `${product.leadDays} día${product.leadDays !== 1 ? "s" : ""}`],
              ["Llegada estimada", (() => {
                const d = new Date("2026-09-01");
                d.setDate(d.getDate() + product.leadDays);
                return d.toISOString().split("T")[0];
              })()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-[#686863]">{k}</span>
                <span className="font-mono text-sm font-medium">{v}</span>
              </div>
            ))}
            <div className="flex justify-between bg-[#f0f0eb] px-4 py-3">
              <span className="font-semibold">Total estimado</span>
              <strong className="font-mono text-base text-[#168178]">C$ {total.toFixed(2)}</strong>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="wire-label mb-2 block">Notas para el proveedor (opcional)</label>
            <textarea rows={2}
              placeholder="Ej. Entrega en almacén principal, Av. Central..."
              className="w-full resize-none border border-[#b6b6b1] bg-white px-3 py-2 font-mono text-sm outline-none focus:border-[#168178] placeholder:text-[#b6b6b1]" />
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-[#b6b6b1] px-6 py-5 space-y-2">
          <button onClick={onConfirm} disabled={state !== "idle"}
            className={`relative w-full overflow-hidden py-4 text-sm font-bold transition-colors ${
              state === "done"
                ? "bg-[#168178] text-white"
                : "bg-[#151515] text-white hover:bg-[#168178] disabled:opacity-60"
            }`}>
            <span className="flex items-center justify-center gap-2">
              {state === "loading" && (
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/>
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              )}
              {state === "done" && <Icon n="check" sz={16} />}
              {state === "idle" && <Icon n="cart" sz={16} />}
              {state === "loading" ? "Generando orden…" : state === "done" ? "Orden enviada al proveedor" : "Confirmar orden de compra"}
            </span>
          </button>
          <p className="wire-label text-center text-[#aaa]">
            La orden será enviada a {product.supplier}
          </p>
        </div>
      </aside>
    </>
  );
}

/* ─── Sort header cell ────────────────────────────────────────── */
function SortTh({ label, sk, current, dir, onSort, className = "" }:
  { label:string; sk:SortKey; current:SortKey; dir:"asc"|"desc"; onSort:(k:SortKey)=>void; className?:string }) {
  const active = current === sk;
  return (
    <th className={`wire-label select-none py-3 pr-3 text-left font-medium transition-colors hover:text-[#168178] ${className}`}>
      <button className="flex items-center gap-1" onClick={() => onSort(sk)}>
        {label}
        <span className={active ? "text-[#168178]" : "text-[#deded8]"}>
          <Icon n={active ? (dir === "asc" ? "sort-asc" : "sort-desc") : "sort-none"} sz={12} />
        </span>
      </button>
    </th>
  );
}

/* ─── Main component ──────────────────────────────────────────── */
export default function StockAlertsPage({ onBack }: { onBack?: () => void }) {
  const [search,   setSearch]   = useState("");
  const [stFilter, setStFilter] = useState<Status | "all">("all");
  const [catFilter,setCatFilter]= useState("Todas");
  const [sortKey,  setSortKey]  = useState<SortKey>("status");
  const [sortDir,  setSortDir]  = useState<"asc"|"desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orders,   setOrders]   = useState<Record<string, OrderState>>({});
  const [panel,    setPanel]    = useState<(Product & { status: Status }) | null>(null);
  const [panelQty, setPanelQty] = useState(0);
  const [bulkState,setBulkState]= useState<"idle"|"loading"|"done">("idle");
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Status counts (global, unfiltered) ── */
  const counts = useMemo(() => {
    const c: Record<Status, number> = { out:0, critical:0, warning:0, watch:0, ok:0 };
    PRODUCTS.forEach(p => c[getStatus(p.stock, p.reorder)]++);
    return c;
  }, []);

  /* ── Processed rows ── */
  const rows = useMemo(() => {
    let list = PRODUCTS.map(p => ({ ...p, status: getStatus(p.stock, p.reorder) }));
    if (stFilter !== "all") list = list.filter(r => r.status === stFilter);
    if (catFilter !== "Todas") list = list.filter(r => r.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status")   cmp = S_CONF[a.status].priority - S_CONF[b.status].priority;
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "id")   cmp = a.id.localeCompare(b.id);
      else if (sortKey === "stock")   cmp = a.stock - b.stock;
      else if (sortKey === "reorder") cmp = a.reorder - b.reorder;
      else if (sortKey === "deficit") cmp = (a.stock - a.reorder) - (b.stock - b.reorder);
      else if (sortKey === "runout")  cmp = a.runout.localeCompare(b.runout);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [search, stFilter, catFilter, sortKey, sortDir]);

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  /* ── Row selection ── */
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const someSelected = rows.some(r => selected.has(r.id));

  function toggleAll() {
    setSelected(prev => {
      if (allSelected) { const n = new Set(prev); rows.forEach(r => n.delete(r.id)); return n; }
      else { const n = new Set(prev); rows.forEach(r => n.add(r.id)); return n; }
    });
  }

  function toggleRow(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  /* ── Order actions ── */
  function openPanel(p: Product & { status: Status }) {
    setPanel(p); setPanelQty(suggestedQty(p));
  }

  function confirmOrder(id: string) {
    setOrders(prev => ({ ...prev, [id]: "loading" }));
    setTimeout(() => {
      setOrders(prev => ({ ...prev, [id]: "done" }));
      setPanel(null);
    }, 1800);
  }

  function handleBulkOrder() {
    const ids = [...selected].filter(id => orders[id] !== "done");
    if (!ids.length) return;
    setBulkState("loading");
    ids.forEach(id => setOrders(prev => ({ ...prev, [id]: "loading" })));
    setTimeout(() => {
      ids.forEach(id => setOrders(prev => ({ ...prev, [id]: "done" })));
      setSelected(new Set());
      setBulkState("done");
      setTimeout(() => setBulkState("idle"), 3000);
    }, 2000);
  }

  /* ── Derived summary ── */
  const criticalCount = counts.out + counts.critical;
  const atentionCount = counts.warning;
  const totalCost = PRODUCTS
    .filter(p => ["out","critical"].includes(getStatus(p.stock, p.reorder)))
    .reduce((sum, p) => sum + suggestedQty(p) * p.unitCost, 0);

  return (
    <div className="min-h-screen bg-[#e8e8e2] text-[#151515]">
      <div className="top-strip" />

      {/* ── Page header ── */}
      <header className="border-b border-[#b6b6b1] bg-[#f5f5f0]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="text-[#686863] transition-colors hover:text-[#151515]">
                <Icon n="back" sz={18} />
              </button>
            )}
            <div>
              <p className="wire-label text-[#168178]">Inventario / alertas preventivas</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-[-.04em]">Panel de alertas de stock</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="wire-label">Capital en riesgo</p>
              <p className="font-mono text-sm font-bold text-[#db3f2f]">C$ {totalCost.toLocaleString("es-NI", { minimumFractionDigits:0 })}</p>
            </div>
            <div className="hidden border-l border-[#b6b6b1] pl-3 text-right sm:block">
              <p className="wire-label">Actualizado</p>
              <p className="font-mono text-[11px]">01 sep, 09:12 a.m.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">

        {/* ── Summary cards ── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label:"Sin stock / ruptura",  value:counts.out,      sub:"Requieren orden urgente",   accent:"#db3f2f", bg:"#fbe2df", filt:"out"      as Status },
            { label:"Estado crítico",        value:counts.critical, sub:"Menos del 30% del mínimo",  accent:"#c0392b", bg:"#fef0ee", filt:"critical"  as Status },
            { label:"Bajo punto de reorden", value:counts.warning,  sub:"Por debajo del mínimo",     accent:"#e4ad3d", bg:"#fff9eb", filt:"warning"   as Status },
            { label:"En vigilancia / OK",    value:counts.watch+counts.ok, sub:"Dentro de rango aceptable", accent:"#168178", bg:"#e6f0ed", filt:"watch" as Status },
          ].map(({ label, value, sub, accent, bg, filt }) => (
            <button key={label}
              onClick={() => setStFilter(prev => prev === filt ? "all" : filt)}
              className={`border p-5 text-left transition-all ${
                stFilter === filt ? "ring-1 ring-[#151515]" : "hover:ring-1 hover:ring-[#b6b6b1]"
              }`}
              style={{ background: stFilter === filt ? bg : "#fafaf7", borderColor: stFilter === filt ? accent : "#b6b6b1" }}>
              <p className="wire-label" style={{ color: accent }}>{label}</p>
              <p className="mt-3 text-4xl font-medium tracking-[-.07em]">{value}</p>
              <p className="mt-1.5 font-mono text-[10px] text-[#686863]">{sub}</p>
            </button>
          ))}
        </div>

        {/* ── Filter / action bar ── */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#686863]">
              <Icon n="search" sz={15} />
            </span>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o categoría…"
              className="h-9 w-full border border-[#b6b6b1] bg-[#fafaf7] pl-9 pr-3 font-mono text-sm outline-none focus:border-[#168178] placeholder:text-[#b6b6b1]"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#686863] hover:text-[#151515]">
                <Icon n="x" sz={13} />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setStFilter("all")}
              className={`border px-3 py-1.5 font-mono text-[10px] transition-colors ${
                stFilter === "all" ? "border-[#151515] bg-[#151515] text-white" : "border-[#b6b6b1] bg-[#fafaf7] text-[#686863] hover:border-[#151515]"
              }`}>
              Todos ({PRODUCTS.length})
            </button>
            {(["out","critical","warning","watch","ok"] as Status[]).map(s => (
              <button key={s} onClick={() => setStFilter(prev => prev === s ? "all" : s)}
                className={`border px-3 py-1.5 font-mono text-[10px] transition-colors ${
                  stFilter === s
                    ? "text-white"
                    : "border-[#b6b6b1] bg-[#fafaf7] text-[#686863] hover:border-[#686863]"
                }`}
                style={stFilter === s ? { background: S_CONF[s].accent, borderColor: S_CONF[s].accent } : undefined}>
                {S_CONF[s].label} ({counts[s]})
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <Icon n="filter" sz={14} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="border border-[#b6b6b1] bg-[#fafaf7] px-2 py-1.5 font-mono text-[11px] outline-none focus:border-[#168178]">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* ── Bulk action bar ── */}
        {someSelected && (
          <div className="mb-3 flex items-center justify-between border border-[#151515] bg-[#151515] px-4 py-3 text-white">
            <span className="font-mono text-sm">
              {selected.size} producto{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-3">
              <button onClick={() => setSelected(new Set())}
                className="font-mono text-[11px] text-[#9a9a94] transition-colors hover:text-white">
                Deseleccionar
              </button>
              <button onClick={handleBulkOrder} disabled={bulkState !== "idle"}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  bulkState === "done" ? "bg-[#168178] text-white" : "bg-[#80d3c9] text-[#12332f] hover:bg-white"
                }`}>
                {bulkState === "loading" && (
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".3"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                )}
                {bulkState === "done" ? <><Icon n="check" sz={14} /> Órdenes generadas</> :
                 bulkState === "loading" ? "Generando órdenes…" :
                 <><Icon n="cart" sz={14} /> Generar {selected.size} orden{selected.size !== 1 ? "es" : ""}</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="border border-[#b6b6b1] bg-[#fafaf7]">
          {/* Table meta row */}
          <div className="flex items-center justify-between border-b border-[#b6b6b1] px-5 py-3">
            <p className="wire-label">
              Mostrando <strong className="font-mono text-[#151515]">{rows.length}</strong> de {PRODUCTS.length} productos
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                {(["out","critical","warning"] as Status[]).map(s => (
                  <span key={s} className="flex items-center gap-1 font-mono text-[10px]" style={{ color: S_CONF[s].accent }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: S_CONF[s].accent }} />
                    {S_CONF[s].label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#deded8] bg-[#f5f5f0]">
                  <th className="w-10 py-3 pl-4 pr-2">
                    <button onClick={toggleAll}
                      className={`flex size-4 items-center justify-center border transition-colors ${
                        allSelected ? "border-[#168178] bg-[#168178]" :
                        someSelected ? "border-[#168178] bg-[#168178]" : "border-[#b6b6b1] bg-white"
                      }`}>
                      {allSelected && <Icon n="check" sz={9} />}
                      {!allSelected && someSelected && <span className="h-px w-2.5 bg-white" />}
                    </button>
                  </th>
                  <SortTh label="SKU / ID"        sk="id"      current={sortKey} dir={sortDir} onSort={handleSort} className="w-24" />
                  <SortTh label="Producto"         sk="name"    current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Stock actual"     sk="stock"   current={sortKey} dir={sortDir} onSort={handleSort} className="w-32" />
                  <SortTh label="Punto de reorden" sk="reorder" current={sortKey} dir={sortDir} onSort={handleSort} className="w-32" />
                  <SortTh label="Déficit"          sk="deficit" current={sortKey} dir={sortDir} onSort={handleSort} className="w-28" />
                  <SortTh label="Ruptura estimada" sk="runout"  current={sortKey} dir={sortDir} onSort={handleSort} className="w-32" />
                  <SortTh label="Estado"           sk="status"  current={sortKey} dir={sortDir} onSort={handleSort} className="w-28" />
                  <th className="wire-label w-44 py-3 pr-4 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sc    = S_CONF[row.status];
                  const ord   = orders[row.id] ?? "idle";
                  const ratio = row.reorder > 0 ? Math.min(1, row.stock / row.reorder) : 0;
                  const deficit = row.stock - row.reorder;
                  const isSel = selected.has(row.id);
                  const isCrit = row.status === "out" || row.status === "critical";

                  return (
                    <tr key={row.id}
                      style={{
                        background: isSel ? "#e6f0ed" : sc.rowBg,
                        borderLeft: `4px solid ${isSel ? "#168178" : sc.accent}`,
                      }}
                      className="border-b border-[#e8e8e2] transition-colors last:border-0 hover:brightness-[.97]">

                      {/* Checkbox */}
                      <td className="py-3 pl-4 pr-2">
                        <button onClick={() => toggleRow(row.id)}
                          className={`flex size-4 items-center justify-center border transition-colors ${
                            isSel ? "border-[#168178] bg-[#168178]" : "border-[#b6b6b1] bg-white hover:border-[#168178]"
                          }`}>
                          {isSel && <Icon n="check" sz={9} />}
                        </button>
                      </td>

                      {/* SKU */}
                      <td className="py-3 pr-3">
                        <span className="font-mono text-[11px] text-[#686863]">{row.id}</span>
                      </td>

                      {/* Product name + category */}
                      <td className="py-3 pr-3">
                        <p className={`font-semibold leading-snug tracking-[-.02em] ${isCrit ? "text-[#9e2c20]" : ""}`}>
                          {row.name}
                        </p>
                        <span className="mt-0.5 inline-block font-mono text-[9px] uppercase tracking-[.08em] text-[#686863]">
                          {row.category} · {row.unit}
                        </span>
                      </td>

                      {/* Stock actual with progress bar */}
                      <td className="py-3 pr-3">
                        <p className={`font-mono text-sm font-bold ${
                          row.stock === 0 ? "text-[#db3f2f]" :
                          row.stock <= row.reorder * 0.3 ? "text-[#c0392b]" :
                          row.stock <= row.reorder ? "text-[#c39122]" : "text-[#168178]"
                        }`}>
                          {row.stock === 0 ? "SIN STOCK" : `${row.stock} ${row.unit}`}
                        </p>
                        <div className="mt-1.5 h-1 w-20 bg-[#e1e1dc]">
                          <div className="h-full transition-all" style={{
                            width: `${ratio * 100}%`,
                            background: row.stock === 0 ? "#db3f2f" : row.stock <= row.reorder ? "#e4ad3d" : "#168178",
                          }} />
                        </div>
                        <p className="mt-0.5 font-mono text-[9px] text-[#aaa]">
                          {Math.round(ratio * 100)}% del mínimo
                        </p>
                      </td>

                      {/* Reorder point */}
                      <td className="py-3 pr-3">
                        <span className="font-mono text-sm">{row.reorder} {row.unit}</span>
                      </td>

                      {/* Deficit / surplus */}
                      <td className="py-3 pr-3">
                        <span className={`font-mono text-sm font-semibold ${deficit < 0 ? "text-[#db3f2f]" : "text-[#168178]"}`}>
                          {deficit < 0 ? `−${Math.abs(deficit)}` : `+${deficit}`}
                        </span>
                        <span className="ml-1 font-mono text-[10px] text-[#aaa]">{row.unit}</span>
                      </td>

                      {/* Estimated runout */}
                      <td className="py-3 pr-3">
                        <span className={`font-mono text-[11px] font-medium ${isCrit ? "text-[#db3f2f]" : row.status === "warning" ? "text-[#c39122]" : "text-[#686863]"}`}>
                          {row.runout}
                        </span>
                        {isCrit && (
                          <p className="mt-0.5 font-mono text-[9px] text-[#db3f2f]">⚠ urgente</p>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="py-3 pr-3">
                        <span className="inline-block px-2 py-0.5 font-mono text-[10px] font-bold"
                          style={{
                            background:  sc.badgeBg,
                            color:       sc.badgeText,
                            outline:     sc.badgeBg === "transparent" ? `1px solid ${sc.accent}` : "none",
                          }}>
                          {sc.label}
                        </span>
                      </td>

                      {/* Action button */}
                      <td className="py-3 pr-4 text-right">
                        <button
                          onClick={() => ord === "idle" ? openPanel(row) : undefined}
                          disabled={ord === "loading"}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                            ord === "done"
                              ? "bg-[#e6f0ed] text-[#0f5550] cursor-default"
                              : ord === "loading"
                              ? "cursor-not-allowed bg-[#e8e8e2] text-[#686863]"
                              : isCrit
                              ? "bg-[#db3f2f] text-white hover:bg-[#c0392b]"
                              : "border border-[#b6b6b1] bg-white text-[#151515] hover:border-[#151515]"
                          }`}>
                          {ord === "loading" && (
                            <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".3"/>
                              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                            </svg>
                          )}
                          {ord === "done"    && <Icon n="check" sz={12} />}
                          {ord !== "loading" && ord !== "done" && <Icon n="cart" sz={12} />}
                          <span>
                            {ord === "done"    ? "Orden generada" :
                             ord === "loading" ? "Generando…"     : "Generar orden"}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <p className="font-mono text-sm text-[#686863]">
                        No hay productos con los filtros aplicados.
                      </p>
                      <button onClick={() => { setSearch(""); setStFilter("all"); setCatFilter("Todas"); }}
                        className="mt-3 font-mono text-[11px] text-[#168178] underline underline-offset-2">
                        Limpiar filtros
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#deded8] px-5 py-3">
            <p className="wire-label text-[#aaa]">
              Haz clic en "Generar orden" para crear una orden individual · Selecciona filas para órdenes masivas
            </p>
            <div className="flex items-center gap-4">
              <p className="wire-label">
                Órdenes generadas hoy: <strong className="font-mono text-[#168178]">
                  {Object.values(orders).filter(s => s === "done").length}
                </strong>
              </p>
              <p className="wire-label text-[#aaa]">
                {rows.length} resultado{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order panel ── */}
      {panel && (
        <OrderPanel
          product={panel}
          qty={panelQty}
          onQtyChange={setPanelQty}
          onConfirm={() => confirmOrder(panel.id)}
          onClose={() => setPanel(null)}
          state={orders[panel.id] ?? "idle"}
        />
      )}
    </div>
  );
}
