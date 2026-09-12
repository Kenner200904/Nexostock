import { useEffect, useState, type FormEvent } from 'react';
import BrandLogo from './BrandLogo';

type Empresa = { empresa_id: string; nombre: string; sector: string; origen: string };
type Month = { mes: string; unidades: number | null; registros: number };
type Summary = {
  empresa: Empresa; desde: string | null; hasta: string | null;
  primera_venta: string | null; ultima_venta: string | null;
  unidades: number; registros: number; productos_con_ventas: number;
  productos_total: number; productos_sin_stock: number; datos_sinteticos: boolean;
  meses: Month[];
  mas_vendidos: { sku: string; nombre: string; unidad: string; unidades: number }[];
  bajo_minimo: { sku: string; nombre: string; unidad: string; stock_actual: number; stock_minimo: number; fecha_corte: string }[];
};
type Props = { onPronosticos?: () => void; onBack?: () => void; onIngestion?: () => void; onAdmin?: () => void; onAlerts?: () => void; onProductos?: () => void };
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const fmt = (n: number) => new Intl.NumberFormat('es-NI').format(n);
const dateLabel = (s: string | null) => s ? s.split('-').reverse().join('/') : 'Sin registros';
const monthLabel = (s: string) => {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${months[Number(s.slice(5)) - 1]} ${s.slice(2, 4)}`;
};
async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API}${path}`, { signal }); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new Error('No se pudo contactar con FastAPI. Comprueba que el backend esté iniciado y que el origen del frontend esté permitido.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `No se pudo completar la consulta (${response.status}).`);
  }
  return response.json() as Promise<T>;
}
function Metric({ label, value, note, alert = false }: { label: string; value: number; note: string; alert?: boolean }) {
  return <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
    <h2 className="text-sm font-medium text-[#686863]">{label}</h2>
    <p className={`mt-4 text-3xl font-semibold tracking-tight ${alert ? 'text-[#9e2c20]' : ''}`}>{fmt(value)}</p>
    <p className="mt-3 text-sm text-[#686863]">{note}</p>
  </article>;
}
export default function Dashboard({ onBack, onIngestion, onAdmin, onAlerts, onProductos, onPronosticos }: Props) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyError, setCompanyError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    setCompanyLoading(true); setCompanyError('');
    get<Empresa[]>('/empresas', ctrl.signal).then(rows => {
      if (ctrl.signal.aborted) return;
      setEmpresas(rows); setEmpresaId(old => rows.some(r => r.empresa_id === old) ? old : rows[0]?.empresa_id || '');
    }).catch(e => { if (!ctrl.signal.aborted) setCompanyError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setCompanyLoading(false); });
    return () => ctrl.abort();
  }, [attempt]);
  useEffect(() => {
    if (!empresaId) { setSummary(null); setLoading(false); return; }
    const ctrl = new AbortController();
    setSummary(null); setLoading(true); setError('');
    const params = new URLSearchParams({ empresa_id: empresaId });
    if (period) { params.set('desde', period.from); params.set('hasta', period.to); }
    get<Summary>(`/dashboard?${params}`, ctrl.signal).then(data => {
      if (ctrl.signal.aborted) return;
      setSummary(data); setFrom(data.desde || ''); setTo(data.hasta || '');
    }).catch(e => { if (!ctrl.signal.aborted) setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [empresaId, period, attempt]);
  function apply(e: FormEvent) {
    e.preventDefault();
    if (!from || !to || from > to) { setFormError('Selecciona un período válido: la fecha inicial debe ser anterior o igual a la final.'); return; }
    setFormError(''); setSummary(null); setLoading(true); setPeriod({ from, to });
  }
  const busy = companyLoading || loading;
  const failure = companyError || error;
  const data = summary?.empresa.empresa_id === empresaId ? summary : null;
  const max = Math.max(1, ...data?.meses.map(m => m.unidades || 0) || []);
  const nav = [
    { label: 'Pronósticos', click: onPronosticos },
    { label: 'Inventario', click: onProductos },
    { label: 'Panel admin · demo', click: onAdmin },
    { label: 'Órdenes y alertas · demo', click: onAlerts },
    { label: 'Carga de datos · demo', click: onIngestion },
    { label: 'Inicio', click: onBack },
  ];
  return <main className="min-h-screen bg-[#e8e8e2] text-[#151515]">
    <div className="top-strip" />
    <div className="grid min-h-screen md:grid-cols-[228px_minmax(0,1fr)]">
      <aside className="border-b border-[#b6b6b1] bg-[#f5f5f0] md:border-r md:border-b-0">
        <div className="border-b border-[#b6b6b1] px-5 py-5"><BrandLogo /></div>
        <nav aria-label="Navegación principal" className="flex flex-wrap gap-2 p-4 md:block">
          <span aria-current="page" className="mb-1 block bg-[#151515] px-3 py-3 text-sm font-semibold text-white">Resumen de ventas</span>
          {nav.filter(n => n.click).map(n => <button key={n.label} onClick={n.click} className="mb-1 block px-3 py-3 text-left text-sm hover:bg-[#deded8] md:w-full">{n.label}</button>)}
        </nav>
      </aside>
      <section className="min-w-0">
        <header className="border-b border-[#b6b6b1] bg-[#f5f5f0] px-5 py-6 md:px-8">
          <p className="text-sm font-semibold text-[#168178]">NEXOSTOCK / Histórico</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Resumen de ventas</h1>
          <p className="mt-2 text-base text-[#686863]">Ventas registradas y existencias por empresa.</p>
        </header>
        <div className="space-y-6 p-5 md:p-8">
          <form onSubmit={apply} className="flex flex-wrap items-end gap-4 border border-[#b6b6b1] bg-[#fafaf7] p-5">
            <label className="min-w-0 flex-1 text-sm font-semibold">Empresa
              <select value={empresaId} disabled={companyLoading || !!companyError || !empresas.length} onChange={e => {
                setEmpresaId(e.target.value); setPeriod(null); setSummary(null); setFrom(''); setTo(''); setFormError(''); setLoading(true);
              }} className="mt-2 block w-full min-w-48 border border-[#b6b6b1] bg-white p-3 text-base font-normal">
                {!empresas.length && <option value="">Sin empresas</option>}
                {empresas.map(e => <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Desde<input type="date" required value={from} onChange={e => setFrom(e.target.value)} className="mt-2 block border border-[#b6b6b1] bg-white p-3 text-base font-normal" /></label>
            <label className="text-sm font-semibold">Hasta<input type="date" required value={to} onChange={e => setTo(e.target.value)} className="mt-2 block border border-[#b6b6b1] bg-white p-3 text-base font-normal" /></label>
            <button disabled={busy || !empresaId} className="bg-[#151515] px-5 py-3 text-sm font-semibold text-white hover:bg-[#168178] disabled:opacity-50">Aplicar</button>
            <button type="button" disabled={busy} onClick={() => { setFormError(''); setPeriod(null); setAttempt(a => a + 1); }} className="border border-[#b6b6b1] px-4 py-3 text-sm disabled:opacity-50">Últimos 12 meses con datos</button>
            {formError && <p role="alert" className="w-full text-sm text-[#9e2c20]">{formError}</p>}
          </form>
          {busy ? <p role="status" className="bg-[#fafaf7] p-6">Consultando ventas e inventario…</p> : failure ?
            <div role="alert" className="border border-[#d67a70] bg-[#fbe2df] p-5 text-[#9e2c20]">
              <p>{failure}</p><button onClick={() => setAttempt(a => a + 1)} className="mt-3 border border-current px-4 py-2 text-sm">Reintentar</button>
            </div> : !empresas.length ? <p className="bg-[#fafaf7] p-6">No hay empresas registradas. Importa el archivo de prueba para comenzar.</p> : data && <>
              {data.datos_sinteticos && <p className="border border-[#c39122] bg-[#fff2ca] p-3 text-sm text-[#664d0e]">Datos sintéticos de prueba consultados desde PostgreSQL. No representan resultados de negocios reales.</p>}
              <div className="flex flex-wrap justify-between gap-2 text-sm text-[#686863]">
                <p>Período aplicado: <strong>{dateLabel(data.desde)} – {dateLabel(data.hasta)}</strong></p>
                <p>Histórico disponible: {dateLabel(data.primera_venta)} – {dateLabel(data.ultima_venta)}</p>
              </div>
              {!data.registros && <p className="border border-[#b6b6b1] bg-[#fafaf7] p-4">No hay registros de ventas en este período. Los ceros del resumen indican ausencia de registros, no demanda observada igual a cero.</p>}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Unidades vendidas" value={data.unidades} note="Suma de cantidades del período" />
                <Metric label="Registros diarios" value={data.registros} note="Incluye días registrados sin ventas" />
                <Metric label="Productos con ventas" value={data.productos_con_ventas} note={`De ${data.productos_total} productos del catálogo`} />
                <Metric label="Productos bajo el mínimo" value={data.bajo_minimo.length} note="Último corte · umbral manual" alert={data.bajo_minimo.length > 0} />
              </div>
              <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
                <h2 className="text-xl font-semibold">Evolución mensual</h2>
                <p className="mt-2 text-sm text-[#686863]">Unidades vendidas. Los meses de inicio y fin incluyen únicamente las fechas del período aplicado.</p>
                {!data.meses.length ? <p className="mt-6">Todavía no hay histórico de ventas.</p> : <>
                  <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Gráfico mensual de unidades vendidas">
                    <div className="flex items-end gap-3 pb-2" style={{ minWidth: Math.max(450, data.meses.length * 74) }}>
                      {data.meses.map(m => <div key={m.mes} className="min-w-14 flex-1 text-center">
                        <span className="block h-6 text-sm font-semibold">{m.unidades === null ? '—' : fmt(m.unidades)}</span>
                        <div className="flex h-44 items-end justify-center border-b border-[#b6b6b1]">
                          {m.unidades === null ? <span className="pb-2 text-xs text-[#686863]">Sin datos</span> : <div className="w-9 bg-[#168178]" style={{ height: `${m.unidades / max * 100}%` }} />}
                        </div>
                        <span className="mt-2 block whitespace-nowrap text-xs">{monthLabel(m.mes)}</span>
                      </div>)}
                    </div>
                  </div>
                  <details className="mt-5 text-sm"><summary className="cursor-pointer font-semibold">Ver valores mensuales</summary>
                    <table className="mt-3 w-full text-left"><thead><tr><th className="p-2">Mes</th><th className="p-2">Unidades</th><th className="p-2">Registros</th></tr></thead><tbody>
                      {data.meses.map(m => <tr key={m.mes} className="border-t border-[#deded8]"><td className="p-2">{m.mes}</td><td className="p-2">{m.unidades === null ? 'Sin datos' : fmt(m.unidades)}</td><td className="p-2">{fmt(m.registros)}</td></tr>)}
                    </tbody></table>
                  </details>
                </>}
              </section>
              <div className="grid gap-6 xl:grid-cols-2">
                <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
                  <h2 className="text-xl font-semibold">Productos más vendidos</h2><p className="mt-2 text-sm text-[#686863]">Los 5 primeros por cantidad vendida en el período.</p>
                  {!data.mas_vendidos.length ? <p className="mt-5 text-sm">No hay productos con ventas positivas en este período.</p> :
                    <ol className="mt-4">{data.mas_vendidos.map((p, i) => <li key={p.sku} className="flex items-center justify-between gap-4 border-t border-[#deded8] py-4">
                      <div><p className="font-medium">{i + 1}. {p.nombre}</p><p className="mt-1 text-xs text-[#686863]">{p.sku} · {p.unidad}</p></div><strong className="text-lg">{fmt(p.unidades)}</strong>
                    </li>)}</ol>}
                </section>
                <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
                  <h2 className="text-xl font-semibold">Stock bajo el mínimo</h2>
                  <p className="mt-2 text-sm text-[#686863]">Último corte disponible por producto, independiente del período de ventas. No es una alerta predictiva.</p>
                  {data.productos_sin_stock > 0 && <p className="mt-3 text-sm text-[#664d0e]">{data.productos_sin_stock} productos sin corte de inventario; no se evalúan.</p>}
                  {!data.bajo_minimo.length ? <p className="mt-5 text-sm">No hay productos bajo el mínimo entre los que tienen inventario registrado.</p> :
                    <ul className="mt-4">{data.bajo_minimo.map(p => <li key={p.sku} className="border-t border-[#deded8] py-4">
                      <div className="flex flex-wrap justify-between gap-2"><strong className="font-medium">{p.nombre}</strong><span className="font-semibold text-[#9e2c20]">{p.stock_actual === 0 ? 'Agotado' : 'Bajo el mínimo'}</span></div>
                      <p className="mt-2 text-sm">Stock: {fmt(p.stock_actual)} · Mínimo: {fmt(p.stock_minimo)} · {p.unidad}</p>
                      <p className="mt-1 text-xs text-[#686863]">{p.sku} · Corte: {dateLabel(p.fecha_corte)}</p>
                    </li>)}</ul>}
                  {onProductos && <button onClick={onProductos} className="mt-4 border border-[#151515] px-4 py-2 text-sm hover:bg-[#deded8]">Consultar inventario</button>}
                </section>
              </div>
            </>}
        </div>
      </section>
    </div>
  </main>;
}
