import { useEffect, useRef, useState } from 'react';
import BrandLogo from './BrandLogo';

type Kind = 'ventas' | 'inventario';
type Report = { importacion_id: string; empresa_id: string; tipo: Kind; archivo: string; estado: 'VALIDADA' | 'RECHAZADA' | 'CONFIRMADA'; sha256: string; informe: {
  filas: number; nuevas: number; existentes: number; errores_total: number;
  errores: { fila: number; mensaje: string }[]; advertencias: string[];
  muestra: Record<string, string | number | null>[];
  series: { sku: string; desde: string; hasta: string; dias_observados: number; dias_faltantes: number; listo_24_meses: boolean }[];
} };
type History = { importacion_id: string; archivo: string; tipo: Kind; creado_en: string; estado: Report['estado']; filas: number; nuevas: number; errores_total: number };
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const states = { VALIDADA: 'Validada · pendiente de confirmar', RECHAZADA: 'Rechazada · sin importar filas', CONFIRMADA: 'Importación confirmada' };
async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API}${path}`, options); }
  catch { throw new Error('No se pudo contactar con FastAPI. Revisa el backend y vuelve a intentarlo.'); }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `No se pudo completar la solicitud (${response.status}).`);
  return body as T;
}
export default function DataIngestionPage({ onBack }: { onBack: () => void }) {
  const [companies, setCompanies] = useState<{ empresa_id: string; nombre: string }[]>([]);
  const [company, setCompany] = useState('');
  const [kind, setKind] = useState<Kind>('ventas');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<History[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [retryCompanies, setRetryCompanies] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const c = new AbortController(); setLoadingCompanies(true); setError('');
    call<typeof companies>('/empresas', { signal: c.signal }).then(rows => { if (!c.signal.aborted) { setCompanies(rows); setCompany(old => rows.some(r => r.empresa_id === old) ? old : rows[0]?.empresa_id || ''); } })
      .catch(e => { if (!c.signal.aborted) setError(e.message); })
      .finally(() => { if (!c.signal.aborted) setLoadingCompanies(false); });
    return () => c.abort();
  }, [retryCompanies]);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => {
    setHistory([]); setHistoryError('');
    if (!company) { setHistoryLoading(false); return; }
    const c = new AbortController(); setHistoryLoading(true);
    call<History[]>(`/ingesta/historial?empresa_id=${encodeURIComponent(company)}`, { signal: c.signal }).then(rows => { if (!c.signal.aborted) setHistory(rows); })
      .catch(e => { if (!c.signal.aborted) setHistoryError(e.message); })
      .finally(() => { if (!c.signal.aborted) setHistoryLoading(false); });
    return () => c.abort();
  }, [company, revision]);
  async function run(path: string, action: string, options: RequestInit = {}) {
    if (controller.current) return;
    const c = new AbortController(); controller.current = c; setBusy(action); setError('');
    try {
      const data = await call<Report>(path, { ...options, signal: c.signal });
      if (!c.signal.aborted) { setReport(data); setRevision(v => v + 1); }
    } catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo completar la operación.'); }
    finally { if (!c.signal.aborted) { setBusy(''); controller.current = null; } }
  }
  function validate() {
    if (!file || !company) return;
    setReport(null);
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) { setError('Selecciona un CSV de hasta 5 MiB.'); return; }
    void run(`/ingesta/validar?empresa_id=${encodeURIComponent(company)}&tipo=${kind}&archivo=${encodeURIComponent(file.name)}`, 'Validando el archivo y comprobando registros existentes…', { method: 'POST', headers: { 'Content-Type': 'text/csv; charset=utf-8' }, body: file });
  }
  const disabled = Boolean(busy) || loadingCompanies;
  const data = report?.empresa_id === company ? report : null;
  const columns = data?.informe.muestra[0] ? Object.keys(data.informe.muestra[0]) : [];
  const button = 'border border-[#151515] px-4 py-2 text-sm disabled:opacity-50 hover:bg-[#deded8]';
  return <main className="min-h-screen bg-[#e8e8e2] text-[#151515]">
    <div className="top-strip" /><header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#b6b6b1] bg-[#f5f5f0] px-5 py-5 md:px-10"><BrandLogo /><button onClick={onBack} className={button}>Volver al resumen</button></header>
    <section className="mx-auto max-w-[1500px] space-y-6 px-5 py-8 md:px-10">
      <div><p className="text-sm font-semibold text-[#168178]">NEXOSTOCK / Datos</p><h1 className="mt-2 text-3xl font-semibold">Importar ventas e inventario</h1><p className="mt-2 text-[#686863]">Valida el archivo, revisa el resultado y confirma la incorporación de filas nuevas.</p></div>
      <div className="space-y-4 border border-[#b6b6b1] bg-[#fafaf7] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">Empresa<select disabled={disabled || !companies.length} value={company} onChange={e => { setCompany(e.target.value); setReport(null); setError(''); }} className="mt-2 block w-full border border-[#b6b6b1] bg-white p-3 font-normal">{!companies.length && <option value="">Sin empresas</option>}{companies.map(c => <option key={c.empresa_id} value={c.empresa_id}>{c.nombre} · {c.empresa_id}</option>)}</select></label>
          <label className="text-sm font-semibold">Contenido del CSV<select disabled={disabled} value={kind} onChange={e => { setKind(e.target.value as Kind); setReport(null); setFile(null); if (input.current) input.current.value = ''; setError(''); }} className="mt-2 block w-full border border-[#b6b6b1] bg-white p-3 font-normal"><option value="ventas">Ventas diarias por producto</option><option value="inventario">Cortes de inventario</option></select></label>
        </div>
        <p className="text-sm text-[#686863]">UTF-8 · Separador coma o punto y coma · Hasta 5 MiB y 100.000 filas · Empresas y productos deben estar registrados.</p>
        <label className="block text-sm font-semibold">Archivo CSV<input ref={input} type="file" accept=".csv,text/csv" disabled={disabled} onChange={e => { setFile(e.target.files?.[0] || null); setReport(null); setError(''); }} className="mt-2 block w-full border border-dashed border-[#b6b6b1] bg-white p-5 font-normal" /></label>
        <div className="flex flex-wrap items-center gap-4"><button onClick={validate} disabled={disabled || !company || !file} className="bg-[#151515] px-5 py-3 text-sm font-semibold text-white hover:bg-[#168178] disabled:opacity-50">Validar archivo</button><a href={`${API}/ingesta/plantilla?tipo=${kind}`} className="text-sm font-semibold text-[#168178] underline">Descargar plantilla CSV vacía</a></div>
        <p className="text-sm">{kind === 'ventas' ? 'Una fila por empresa, SKU y día. Cantidad cero significa un día observado sin ventas. Los meses pueden cargarse por partes; se comprobará el histórico combinado con la base de datos.' : 'Una fila por empresa, SKU y fecha de corte. El stock corresponde al cierre de ese día; no es un movimiento de inventario.'}</p>
        <p className="text-sm text-[#686863]">Fechas YYYY-MM-DD, precios con punto decimal y origen REAL o SINTETICO. La validación no imputa nulos ni elimina valores atípicos: ese procesamiento pertenece al siguiente requisito.</p>
      </div>
      {loadingCompanies && <p role="status">Cargando empresas…</p>}
      {!loadingCompanies && !companies.length && <button className={button} onClick={() => setRetryCompanies(v => v + 1)}>Volver a cargar empresas</button>}
      {busy && <p role="status" className="bg-[#fafaf7] p-4">{busy}</p>}
      {error && <p role="alert" className="border border-[#d67a70] bg-[#fbe2df] p-4 text-[#9e2c20]">{error}</p>}
      {data && <section className="space-y-4 border border-[#b6b6b1] bg-[#fafaf7] p-5">
        <h2 className="text-xl font-semibold">{states[data.estado]}</h2><p className="break-words text-sm">{data.archivo} · {data.tipo} · ID: {data.importacion_id}</p>
        <div className="grid gap-3 sm:grid-cols-4">{[['Filas leídas', data.informe.filas], [data.estado === 'CONFIRMADA' ? 'Filas insertadas' : 'Candidatas nuevas', data.informe.nuevas], ['Idénticas existentes', data.informe.existentes], ['Errores', data.informe.errores_total]].map(([label, value]) => <div key={label} className="border border-[#deded8] p-4"><p className="text-sm text-[#686863]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
        {data.informe.advertencias.map(message => <p key={message} className="border border-[#c39122] bg-[#fff2ca] p-3 text-sm">{message}</p>)}
        {data.estado === 'VALIDADA' && <div className="space-y-3"><p className="text-sm">Aún no se han incorporado las filas. Al confirmar, se comprobarán otra vez los registros existentes y se guardará todo en una sola operación.</p><button disabled={disabled} className="bg-[#168178] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void run(`/ingesta/${data.importacion_id}/confirmar?empresa_id=${encodeURIComponent(company)}`, 'Confirmando la importación…', { method: 'POST' })}>Confirmar importación</button></div>}
        {data.estado === 'CONFIRMADA' && <p role="status" className="border border-[#168178] bg-[#e4f3ef] p-4 text-sm">Importación confirmada. Puedes consultar los datos desde Productos, Resumen o Pronósticos.</p>}
        {data.estado === 'RECHAZADA' && <p role="alert" className="text-sm text-[#9e2c20]">Corrige el archivo y vuelve a validarlo. Ninguna fila de esta importación fue incorporada.</p>}
        {data.informe.errores.length > 0 && <div className="max-h-80 overflow-auto"><p className="mb-2 text-sm">Se muestran hasta los primeros 100 errores.</p><table className="w-full text-left text-sm"><thead><tr><th scope="col" className="p-2">Línea del CSV</th><th scope="col" className="p-2">Problema</th></tr></thead><tbody>{data.informe.errores.map((e, i) => <tr key={i} className="border-t border-[#deded8]"><td className="p-2">{e.fila}</td><td className="p-2">{e.mensaje}</td></tr>)}</tbody></table></div>}
        {columns.length > 0 && <details><summary className="cursor-pointer text-sm font-semibold">Vista previa · primeras 10 filas con formato válido</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#151515] text-white"><tr>{columns.map(c => <th key={c} scope="col" className="whitespace-nowrap p-3">{c}</th>)}</tr></thead><tbody>{data.informe.muestra.map((r, i) => <tr key={i} className="border-b border-[#deded8]">{columns.map(c => <td key={c} className="whitespace-nowrap p-3">{r[c] ?? '—'}</td>)}</tr>)}</tbody></table></div></details>}
        {data.informe.series.length > 0 && <details open><summary className="cursor-pointer text-sm font-semibold">Histórico combinado por producto</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr>{['SKU', 'Desde', 'Hasta', 'Días observados', 'Días faltantes', '24 meses continuos'].map(c => <th key={c} scope="col" className="p-2">{c}</th>)}</tr></thead><tbody>{data.informe.series.map(s => <tr key={s.sku} className="border-t border-[#deded8]"><td className="p-2">{s.sku}</td><td className="p-2">{s.desde}</td><td className="p-2">{s.hasta}</td><td className="p-2">{s.dias_observados}</td><td className="p-2">{s.dias_faltantes}</td><td className="p-2">{s.listo_24_meses ? 'Sí' : 'Pendiente'}</td></tr>)}</tbody></table></div></details>}
      </section>}
      <section className="space-y-4 border border-[#b6b6b1] bg-[#fafaf7] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Historial de importaciones</h2><button disabled={disabled || historyLoading || !company} className={button} onClick={() => setRevision(v => v + 1)}>Actualizar historial</button></div><p className="text-sm text-[#686863]">Últimos 20 archivos validados de esta empresa. Abre el detalle para revisar errores o confirmar una carga pendiente.</p>
        {historyLoading ? <p role="status">Cargando historial…</p> : historyError ? <p role="alert" className="text-[#9e2c20]">{historyError}</p> : !history.length ? <p className="text-sm">Sin importaciones registradas.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr>{['Fecha', 'Archivo', 'Tipo', 'Estado', 'Detalle'].map(c => <th key={c} scope="col" className="p-2">{c}</th>)}</tr></thead><tbody>{history.map(h => <tr key={h.importacion_id} className="border-t border-[#deded8]"><td className="p-2">{new Date(h.creado_en).toLocaleString('es-NI')}</td><td className="p-2">{h.archivo}</td><td className="p-2">{h.tipo}</td><td className="p-2">{states[h.estado]}</td><td className="p-2"><button disabled={disabled} className={button} onClick={() => { setReport(null); setKind(h.tipo); setFile(null); if (input.current) input.current.value = ''; void run(`/ingesta/${h.importacion_id}?empresa_id=${encodeURIComponent(company)}`, 'Abriendo detalle…'); }}>Abrir</button></td></tr>)}</tbody></table></div>}
      </section>
    </section>
  </main>;
}
