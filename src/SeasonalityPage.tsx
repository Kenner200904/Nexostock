import React, { useState, useMemo, useCallback } from "react";

/* ─── Types ───────────────────────────────────────────────────── */
type Category = "religious" | "national" | "local" | "consumption";

interface Holiday    { id: string; label: string; dates: string[] }
interface HolidayGroup {
  id: string; label: string; category: Category;
  description: string; impactTag: string;
  holidays: Holiday[];
}

const CAT: Record<Category, { dot:string; bg:string; text:string; border:string; label:string }> = {
  religious:   { dot:"#c39122", bg:"#fff9eb", text:"#664d0e", border:"#e4ad3d", label:"Religioso"        },
  national:    { dot:"#168178", bg:"#e6f0ed", text:"#0f5550", border:"#168178", label:"Nacional"          },
  local:       { dot:"#c0392b", bg:"#fbe2df", text:"#9e2c20", border:"#db3f2f", label:"Local/Municipal"   },
  consumption: { dot:"#686863", bg:"#f0f0eb", text:"#333331", border:"#b6b6b1", label:"Consumo especial"  },
};

/* ─── Holiday data (2026) ─────────────────────────────────────── */
const GROUPS: HolidayGroup[] = [
  {
    id:"semana_santa", label:"Semana Santa", category:"religious",
    description:"Semana mayor — alto impacto en abarrotes, bebidas y productos básicos.",
    impactTag:"+38% ventas",
    holidays:[
      { id:"ramos",         label:"Domingo de Ramos",             dates:["2026-03-29"] },
      { id:"semana_mayor",  label:"Semana Mayor (Lun–Mié)",       dates:["2026-03-30","2026-03-31","2026-04-01"] },
      { id:"j_santo",       label:"Jueves Santo",                 dates:["2026-04-02"] },
      { id:"v_santo",       label:"Viernes Santo",                dates:["2026-04-03"] },
      { id:"s_gloria",      label:"Sábado de Gloria",             dates:["2026-04-04"] },
      { id:"resurreccion",  label:"Domingo de Resurrección",      dates:["2026-04-05"] },
    ],
  },
  {
    id:"navidad", label:"Navidad y Año Nuevo", category:"religious",
    description:"Temporada alta de diciembre — mayor pico de demanda del año en todos los SKUs.",
    impactTag:"+52% ventas",
    holidays:[
      { id:"nochebuena",  label:"Nochebuena (24 Dic)",     dates:["2026-12-24"] },
      { id:"navidad",     label:"Navidad (25 Dic)",        dates:["2026-12-25"] },
      { id:"nochevieja",  label:"Nochevieja (31 Dic)",     dates:["2026-12-31"] },
      { id:"anio_nuevo",  label:"Año Nuevo 2027",          dates:["2027-01-01"] },
    ],
  },
  {
    id:"nacionales", label:"Feriados generales", category:"national",
    description:"Días no laborables configurables. Puede haber cambios en abastecimiento y horarios.",
    impactTag:"+15% ventas",
    holidays:[
      { id:"trabajo",       label:"Día del Trabajo (1 May)",         dates:["2026-05-01"] },
      { id:"madre",         label:"Día de la Madre",                dates:["2026-05-10"] },
      { id:"independencia", label:"Jornada de descanso",             dates:["2026-09-15"] },
    ],
  },
  {
    id:"eventos_locales", label:"Eventos comerciales locales", category:"local",
    description:"Eventos municipales con alta afluencia al mercado y demanda de productos básicos.",
    impactTag:"+22% ventas",
    holidays:[
      { id:"feria_local",   label:"Feria de temporada",              dates:["2026-08-14","2026-08-15"] },
      { id:"evento_barrio", label:"Evento de comunidad",             dates:["2026-09-28","2026-09-29"] },
      { id:"aniv_local",    label:"Aniversario comercial",           dates:["2026-04-27"] },
    ],
  },
  {
    id:"consumo", label:"Días de consumo especial", category:"consumption",
    description:"No feriados — con patrones de compra atípicos detectados en datos históricos.",
    impactTag:"+8% ventas",
    holidays:[
      { id:"escolar",   label:"Inicio año escolar (Feb)",   dates:["2026-02-02"] },
      { id:"padre",     label:"Día del Padre (23 Jun)",     dates:["2026-06-23"] },
      { id:"difuntos",  label:"Día de Difuntos (1–2 Nov)",  dates:["2026-11-01","2026-11-02"] },
    ],
  },
];

/* ─── Calendar helpers ────────────────────────────────────────── */
const MESES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS   = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const TODAY  = "2026-09-01";

function mkISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function getMonthCells(year: number, month: number) {
  const first = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const dim   = new Date(year, month + 1, 0).getDate();
  const dprev = new Date(year, month, 0).getDate();
  const cells: { y:number; m:number; d:number; cur:boolean }[] = [];
  for (let i = first - 1; i >= 0; i--) {
    const pm = month - 1; const py = pm < 0 ? year - 1 : year;
    cells.push({ y:py, m:(pm+12)%12, d:dprev-i, cur:false });
  }
  for (let d = 1; d <= dim; d++) cells.push({ y:year, m:month, d, cur:true });
  const tail = (7 - cells.length % 7) % 7;
  for (let d = 1; d <= tail; d++) {
    const nm = month + 1; const ny = nm > 11 ? year + 1 : year;
    cells.push({ y:ny, m:nm%12, d, cur:false });
  }
  return cells;
}

/* ─── Icons ───────────────────────────────────────────────────── */
type IK = "left"|"right"|"check"|"x"|"info"|"refresh"|"back"|"star"|"plus"|"chevron";
function Icon({ n, sz=16 }: { n:IK; sz?:number }) {
  const b: Record<IK,React.ReactNode> = {
    left:    <path d="M13 10H3m0 0 5-5m-5 5 5 5"/>,
    right:   <path d="M3 10h10m0 0-5-5m5 5-5 5"/>,
    check:   <path d="M3 10l5 5 9-9"/>,
    x:       <path d="M4 4l12 12M16 4 4 16"/>,
    info:    <><circle cx="10" cy="10" r="8"/><path d="M10 7v.5M10 10v4"/></>,
    refresh: <path d="M4 10a6 6 0 1 0 1.5-4M4 3v4h4"/>,
    back:    <path d="M15 10H3m0 0 5-5m-5 5 5 5"/>,
    star:    <path d="M10 2l2.4 4.9H18l-4.5 3.3 1.7 5.2L10 12.6l-5.2 2.8 1.7-5.2L2 7l5.6-.1z"/>,
    plus:    <path d="M10 4v12M4 10h12"/>,
    chevron: <path d="M5 8l5 5 5-5"/>,
  };
  return (
    <svg viewBox="0 0 20 20" style={{ width:sz, height:sz }} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{b[n]}</svg>
  );
}

/* ─── Checkbox ────────────────────────────────────────────────── */
function Checkbox({ checked, partial, onChange }: { checked:boolean; partial?:boolean; onChange:()=>void }) {
  return (
    <button type="button" onClick={onChange}
      className={`flex size-4 shrink-0 items-center justify-center border transition-colors ${
        checked || partial
          ? "border-[#168178] bg-[#168178]"
          : "border-[#b6b6b1] bg-white hover:border-[#168178]"
      }`}>
      {checked  && <Icon n="check" sz={9} />}
      {partial && !checked && <span className="h-px w-2.5 bg-white" />}
    </button>
  );
}

/* ─── Main component ──────────────────────────────────────────── */
export default function SeasonalityPage({ onBack }: { onBack?: () => void }) {
  const [viewYear,  setViewYear]  = useState(2026);
  const [viewMonth, setViewMonth] = useState(8); // Sep 2026
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set(["semana_santa","navidad","nacionales"]));
  const [enabled,   setEnabled]   = useState<Set<string>>(() => {
    const s = new Set<string>();
    GROUPS.filter(g => ["semana_santa","navidad","nacionales","eventos_locales"].includes(g.id))
      .forEach(g => g.holidays.forEach(h => s.add(h.id)));
    return s;
  });
  const [custom,    setCustom]    = useState<Set<string>>(new Set());
  const [hoverDay,  setHoverDay]  = useState<string | null>(null);
  const [updating,  setUpdating]  = useState(false);
  const [updated,   setUpdated]   = useState(false);

  /* ── Derived: active date map ── */
  const dateMap = useMemo(() => {
    const map = new Map<string, { category: Category; labels: string[] }>();
    GROUPS.forEach(g => {
      g.holidays.forEach(h => {
        if (!enabled.has(h.id)) return;
        h.dates.forEach(iso => {
          const entry = map.get(iso);
          if (!entry) map.set(iso, { category: g.category, labels:[h.label] });
          else entry.labels.push(h.label);
        });
      });
    });
    custom.forEach(iso => {
      if (!map.has(iso)) map.set(iso, { category:"consumption", labels:["Fecha personalizada"] });
    });
    return map;
  }, [enabled, custom]);

  /* ── Sorted selected dates list ── */
  const sortedDates = useMemo(() => [...dateMap.keys()].sort(), [dateMap]);

  /* ── Month overview counts ── */
  const monthCounts = useMemo(() => {
    const counts = new Array(12).fill(0);
    dateMap.forEach((_, iso) => {
      const parts = iso.split("-");
      const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
      if (y === viewYear) counts[m]++;
    });
    return counts;
  }, [dateMap, viewYear]);

  /* ── Calendar cells ── */
  const cells = useMemo(() => getMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  /* ── Nav helpers ── */
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  /* ── Group state helpers ── */
  function groupState(g: HolidayGroup): "all"|"partial"|"none" {
    const n = g.holidays.filter(h => enabled.has(h.id)).length;
    return n === g.holidays.length ? "all" : n > 0 ? "partial" : "none";
  }

  function toggleGroup(g: HolidayGroup) {
    const st = groupState(g);
    setEnabled(prev => {
      const next = new Set(prev);
      g.holidays.forEach(h => st === "all" ? next.delete(h.id) : next.add(h.id));
      return next;
    });
  }

  function toggleHoliday(id: string) {
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCustom(iso: string) {
    if (dateMap.has(iso) && !custom.has(iso)) return; // managed by group
    setCustom(prev => {
      const next = new Set(prev);
      next.has(iso) ? next.delete(iso) : next.add(iso);
      return next;
    });
  }

  /* ── Update model ── */
  function handleUpdate() {
    if (updating) return;
    setUpdating(true); setUpdated(false);
    setTimeout(() => {
      setUpdating(false); setUpdated(true);
      setTimeout(() => setUpdated(false), 4000);
    }, 2200);
  }

  const totalDates = dateMap.size;

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#e8e8e2] text-[#151515]">
      <div className="top-strip" />

      {/* Header */}
      <header className="border-b border-[#b6b6b1] bg-[#f5f5f0]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="text-[#686863] transition-colors hover:text-[#151515]">
                <Icon n="back" sz={18} />
              </button>
            )}
            <div>
              <p className="wire-label text-[#168178]">Modelo ML / parámetros de estacionalidad</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-[-.04em]">
                Configuración de estacionalidad
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="wire-label">Fechas activas</p>
              <p className="font-mono text-sm font-semibold text-[#168178]">{totalDates} días</p>
            </div>
            {updated && (
              <span className="flex items-center gap-1.5 border border-[#168178] bg-[#e6f0ed] px-3 py-1.5 font-mono text-[11px] text-[#0f5550]">
                <Icon n="check" sz={12} /> Modelo actualizado
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

          {/* ══ LEFT: Calendar ══════════════════════════════════ */}
          <div className="flex flex-col gap-4">

            {/* Info notice */}
            <div className="flex gap-3 border border-[#168178] bg-[#e6f0ed] px-4 py-3">
              <span className="mt-0.5 shrink-0 text-[#168178]"><Icon n="info" sz={16} /></span>
              <p className="font-mono text-[11px] leading-5 text-[#0f5550]">
                Marca los días con comportamiento atípico de ventas. El modelo ajustará sus
                predicciones para cada período configurado. Los cambios tienen efecto en el
                próximo ciclo de entrenamiento.
              </p>
            </div>

            {/* Calendar card */}
            <div className="border border-[#b6b6b1] bg-[#fafaf7]">

              {/* Month nav */}
              <div className="flex items-center justify-between border-b border-[#b6b6b1] px-5 py-3">
                <button onClick={prevMonth}
                  className="flex items-center gap-1 border border-[#b6b6b1] px-2 py-1.5 text-[#686863] transition-colors hover:border-[#151515] hover:text-[#151515]">
                  <Icon n="left" sz={14} />
                </button>

                <div className="text-center">
                  <p className="text-base font-semibold tracking-[-.04em]">
                    {MESES[viewMonth]} {viewYear}
                  </p>
                  <div className="mt-0.5 flex items-center justify-center gap-2">
                    <button onClick={() => setViewYear(y => y - 1)}
                      className="wire-label transition-colors hover:text-[#168178]">
                      ← {viewYear - 1}
                    </button>
                    <span className="wire-label text-[#deded8]">|</span>
                    <button onClick={() => setViewYear(y => y + 1)}
                      className="wire-label transition-colors hover:text-[#168178]">
                      {viewYear + 1} →
                    </button>
                  </div>
                </div>

                <button onClick={nextMonth}
                  className="flex items-center gap-1 border border-[#b6b6b1] px-2 py-1.5 text-[#686863] transition-colors hover:border-[#151515] hover:text-[#151515]">
                  <Icon n="right" sz={14} />
                </button>
              </div>

              {/* Year mini overview */}
              <div className="border-b border-[#b6b6b1] px-4 py-3">
                <p className="wire-label mb-2">Densidad de feriados por mes — {viewYear}</p>
                <div className="grid grid-cols-12 gap-1">
                  {MESES.map((mes, i) => {
                    const cnt = monthCounts[i];
                    const active = i === viewMonth;
                    return (
                      <button key={i}
                        onClick={() => setViewMonth(i)}
                        className={`flex flex-col items-center border py-1.5 transition-colors ${
                          active
                            ? "border-[#168178] bg-[#e6f0ed]"
                            : "border-[#deded8] hover:border-[#b6b6b1]"
                        }`}>
                        <span className={`font-mono text-[8px] uppercase leading-none ${active ? "text-[#168178]" : "text-[#aaa]"}`}>
                          {mes.slice(0,3)}
                        </span>
                        {cnt > 0
                          ? <span className="mt-1 font-mono text-[9px] font-bold text-[#168178]">{cnt}</span>
                          : <span className="mt-1 h-[11px] block" />
                        }
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-[#deded8]">
                {DIAS.map(d => (
                  <div key={d} className={`py-2 text-center ${d === "Sáb" || d === "Dom" ? "bg-[#f0f0eb]" : ""}`}>
                    <span className="wire-label">{d}</span>
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px bg-[#deded8]">
                {cells.map((cell, i) => {
                  const iso = mkISO(cell.y, cell.m, cell.d);
                  const info = cell.cur ? dateMap.get(iso) : undefined;
                  const isToday = iso === TODAY;
                  const isCustomDay = custom.has(iso);
                  const isHovered = hoverDay === iso;
                  const isWeekend = (i % 7 === 5) || (i % 7 === 6);
                  const style = info ? CAT[info.category] : null;

                  return (
                    <div key={i} className="relative" onMouseEnter={() => cell.cur && setHoverDay(iso)} onMouseLeave={() => setHoverDay(null)}>
                      <button
                        onClick={() => cell.cur && toggleCustom(iso)}
                        disabled={!cell.cur}
                        className={`flex h-11 w-full flex-col items-center justify-center gap-0.5 transition-colors ${
                          !cell.cur ? "cursor-default" : "cursor-pointer"
                        } ${
                          isWeekend && !info ? "bg-[#f5f5f0]" : ""
                        }`}
                        style={
                          info
                            ? { background: style!.bg }
                            : isCustomDay
                            ? { background:"#e8e8e2", outline:"1px solid #686863", outlineOffset:"-2px" }
                            : undefined
                        }
                      >
                        <span
                          className={`font-mono text-[12px] font-medium leading-none ${
                            !cell.cur ? "text-[#c1c1bb]" : ""
                          } ${isToday ? "font-bold" : ""}`}
                          style={
                            info && style
                              ? { color: style.text }
                              : isCustomDay
                              ? { color: "#333331" }
                              : undefined
                          }
                        >
                          {cell.d}
                        </span>
                        {info && style && (
                          <span className="h-1 w-1 rounded-full" style={{ background: style.dot }} />
                        )}
                        {isToday && !info && (
                          <span className="h-1 w-1 rounded-full bg-[#168178]" />
                        )}
                      </button>

                      {/* Today ring overlay */}
                      {isToday && (
                        <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#168178]" />
                      )}

                      {/* Hover tooltip */}
                      {isHovered && info && cell.cur && (
                        <div className={`pointer-events-none absolute z-20 min-w-[180px] border border-[#b6b6b1] bg-[#fafaf7] shadow-sm ${
                          i % 7 >= 5 ? "right-0" : "left-0"
                        } top-full mt-0.5`}>
                          <div className="border-b border-[#e8e8e2] px-3 py-2">
                            <p className="font-mono text-[10px] font-semibold">{iso}</p>
                          </div>
                          <div className="px-3 py-2">
                            {info.labels.map((lbl, li) => (
                              <p key={li} className="font-mono text-[11px] leading-5 text-[#686863]">{lbl}</p>
                            ))}
                            <span className="mt-1.5 inline-block font-mono text-[9px] uppercase tracking-[.08em]"
                              style={{ color: CAT[info.category].dot }}>
                              {CAT[info.category].label}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calendar footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#deded8] px-4 py-3">
                <div className="flex flex-wrap gap-4">
                  {(Object.keys(CAT) as Category[]).map(cat => (
                    <span key={cat} className="flex items-center gap-1.5 font-mono text-[10px] text-[#686863]">
                      <span className="h-2 w-2 rounded-full" style={{ background: CAT[cat].dot }} />
                      {CAT[cat].label}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#686863]">
                    <span className="h-2 w-2 rounded-full ring-1 ring-[#168178]" />
                    Hoy
                  </span>
                </div>
                <p className="wire-label text-[#aaa]">Clic en día libre para agregar fecha personalizada</p>
              </div>
            </div>

            {/* Category legend cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(CAT) as Category[]).map(cat => {
                const count = [...dateMap.values()].filter(v => v.category === cat).length;
                const s = CAT[cat];
                return (
                  <div key={cat} className="border border-[#b6b6b1] p-3" style={{ borderLeftColor: s.dot, borderLeftWidth: 3 }}>
                    <p className="font-mono text-[9px] uppercase tracking-[.10em]" style={{ color: s.dot }}>{s.label}</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-.05em]">{count}</p>
                    <p className="wire-label mt-0.5 text-[#aaa]">días activos</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══ RIGHT: Sidebar ══════════════════════════════════ */}
          <div className="flex flex-col gap-4">

            {/* Holiday groups */}
            <div className="border border-[#b6b6b1] bg-[#fafaf7]">
              <div className="border-b border-[#b6b6b1] px-5 py-4">
                <p className="wire-label text-[#168178]">Feriados y eventos / selección</p>
                <h2 className="mt-1 text-base font-semibold tracking-[-.04em]">Grupos de estacionalidad</h2>
              </div>

              <div className="divide-y divide-[#eeeee8]">
                {GROUPS.map(g => {
                  const st  = groupState(g);
                  const exp = expanded.has(g.id);
                  const s   = CAT[g.category];

                  return (
                    <div key={g.id}>
                      {/* Group header */}
                      <div className="flex items-start gap-3 px-4 py-3">
                        <Checkbox
                          checked={st === "all"}
                          partial={st === "partial"}
                          onChange={() => toggleGroup(g)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold leading-snug">{g.label}</p>
                            <span className="shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold"
                              style={{ borderColor: s.border, color: s.text, background: s.bg }}>
                              {g.impactTag}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[10px] leading-4 text-[#686863]">{g.description}</p>
                          <button
                            onClick={() => setExpanded(prev => {
                              const next = new Set(prev);
                              next.has(g.id) ? next.delete(g.id) : next.add(g.id);
                              return next;
                            })}
                            className="mt-1.5 flex items-center gap-1 wire-label text-[#168178] hover:opacity-70 transition-opacity">
                            <Icon n="chevron" sz={11} />
                            {exp ? "Contraer" : `${g.holidays.length} feriados`}
                          </button>
                        </div>
                      </div>

                      {/* Individual holidays */}
                      {exp && (
                        <div className="border-t border-[#eeeee8] bg-[#f5f5f0]">
                          {g.holidays.map(h => (
                            <label key={h.id}
                              className="flex cursor-pointer items-start gap-2.5 px-5 py-2 transition-colors hover:bg-[#eeeee8]">
                              <Checkbox
                                checked={enabled.has(h.id)}
                                onChange={() => toggleHoliday(h.id)}
                              />
                              <div className="min-w-0 flex-1 pt-px">
                                <p className="text-sm leading-snug">{h.label}</p>
                                <p className="mt-0.5 font-mono text-[10px] text-[#aaa]">
                                  {h.dates.length === 1
                                    ? h.dates[0]
                                    : `${h.dates[0]} — ${h.dates[h.dates.length-1]}`}
                                </p>
                              </div>
                              <span
                                className="mt-1 size-2 shrink-0 rounded-full"
                                style={{ background: enabled.has(h.id) ? s.dot : "#deded8" }}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom / manual dates */}
            {custom.size > 0 && (
              <div className="border border-[#b6b6b1] bg-[#fafaf7]">
                <div className="flex items-center justify-between border-b border-[#b6b6b1] px-4 py-3">
                  <p className="wire-label">Fechas personalizadas</p>
                  <button onClick={() => setCustom(new Set())}
                    className="wire-label text-[#db3f2f] transition-opacity hover:opacity-70">
                    Limpiar todo
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto divide-y divide-[#eeeee8]">
                  {[...custom].sort().map(iso => (
                    <div key={iso} className="flex items-center justify-between px-4 py-2">
                      <span className="font-mono text-[11px]">{iso}</span>
                      <button onClick={() => setCustom(prev => { const n=new Set(prev); n.delete(iso); return n; })}
                        className="text-[#686863] transition-colors hover:text-[#db3f2f]">
                        <Icon n="x" sz={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected dates summary */}
            <div className="border border-[#b6b6b1] bg-[#fafaf7]">
              <div className="border-b border-[#b6b6b1] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="wire-label text-[#168178]">Fechas configuradas</p>
                  <span className="font-mono text-sm font-bold text-[#168178]">{totalDates}</span>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {sortedDates.length === 0
                  ? <p className="px-4 py-4 text-center font-mono text-[11px] text-[#aaa]">Ninguna fecha seleccionada</p>
                  : sortedDates.map(iso => {
                      const info = dateMap.get(iso)!;
                      const s = CAT[info.category];
                      return (
                        <div key={iso}
                          className="flex items-center gap-2.5 border-b border-[#eeeee8] px-4 py-2 last:border-0">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.dot }} />
                          <span className="flex-1 font-mono text-[11px]">{iso}</span>
                          <span className="font-mono text-[10px]" style={{ color: s.dot }}>
                            {s.label.split("/")[0].trim()}
                          </span>
                        </div>
                      );
                    })
                }
              </div>
            </div>

            {/* Estimated model impact */}
            <div className="border border-[#b6b6b1] bg-[#fafaf7] px-4 py-4">
              <p className="wire-label text-[#168178]">Impacto estimado en el modelo</p>
              <div className="mt-3 space-y-2.5">
                {[
                  { label:"Reducción de error (MAE)",   value:"−1.8 und.",  pct:72 },
                  { label:"Mejora precisión estacional", value:"+4.2 pts",  pct:84 },
                  { label:"Cobertura de picos cubiertos",value:"94%",       pct:94 },
                ].map(({ label, value, pct }) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between">
                      <span className="font-mono text-[10px] text-[#686863]">{label}</span>
                      <span className="font-mono text-[10px] font-bold text-[#168178]">{value}</span>
                    </div>
                    <div className="h-px w-full bg-[#e1e1dc]">
                      <div className="h-full bg-[#168178] transition-all duration-700" style={{ width:`${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="border border-[#b6b6b1] bg-[#fafaf7] p-4">
              <div className="mb-3 flex items-start gap-2.5 border border-[#e4ad3d] bg-[#fff9eb] px-3 py-2.5">
                <Icon n="star" sz={14} />
                <p className="font-mono text-[10px] leading-5 text-[#664d0e]">
                  {totalDates} fechas configuradas para {viewYear}–{viewYear+1}.
                  El reentrenamiento tomará aproximadamente 4 minutos.
                </p>
              </div>

              <button
                onClick={handleUpdate}
                disabled={updating || totalDates === 0}
                className={`relative w-full overflow-hidden py-4 text-sm font-bold tracking-[-.02em] transition-colors ${
                  updated
                    ? "bg-[#168178] text-white"
                    : "bg-[#151515] text-white hover:bg-[#168178] disabled:cursor-not-allowed disabled:opacity-50"
                }`}
              >
                {/* Progress animation */}
                {updating && (
                  <span className="absolute inset-0 animate-[shimmer_1.4s_linear_infinite] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,.08)_50%,transparent_100%)] bg-[length:200%_100%]" />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {updating && (
                    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/>
                      <path d="M4 12a8 8 0 018-8v4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  )}
                  {updated && <Icon n="check" sz={16} />}
                  {updating
                    ? "Actualizando modelo predictivo…"
                    : updated
                    ? "Modelo actualizado correctamente"
                    : `Actualizar Modelo Predictivo (${totalDates} días) →`}
                </span>
              </button>

              <p className="mt-2 wire-label text-center text-[#aaa]">
                Los cambios se aplicarán en el próximo ciclo de entrenamiento
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
