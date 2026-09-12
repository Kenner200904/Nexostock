import { useEffect, useRef, useState } from 'react';
import BrandLogo from './BrandLogo';
import CoberturaPanel from './CoberturaPanel';
type Empresa = { empresa_id: string; nombre: string };
type Product = { sku: string; nombre: string; empresa_id: string };
type Point = { fecha: string; cantidad: number };
type HistoryRow = { ejecucion_id: string; creado_en: string; nombre_modelo: string; historico_hasta: string; total_estimado: number };
type Result = {
  ejecucion_id: string; creado_en: string;
  producto: Product & { unidad: string; empresa: string };
  datos_sinteticos: boolean; modelo_elegido: string; nombre_modelo: string;
  metricas: { modelo: string; nombre: string; mae: number; rmse: number; r2: number | null }[];
  mejora_mae_vs_ingenuo_pct: number | null; total_estimado: number;
  dias_historico: number; historico_desde: string; historico_hasta: string;
  dias_entrenamiento_inicial: number; dias_evaluacion: number;
  evaluacion_desde: string; evaluacion_hasta: string;
  bloques_evaluacion: { entrenamiento_hasta: string; evaluacion_desde: string; evaluacion_hasta: string; dias: number }[];
  horizonte_dias: number; pronostico: Point[]; historico_reciente: Point[];
  metodo: string; advertencias: string[];
};
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const num = (value: number) => new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value);
const instante = (value: string) => new Intl.DateTimeFormat('es-NI', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
const fecha = (value: string) => value.split('-').reverse().join('/');
async function request<T>(path: string, options: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(`${API}${path}`, options); }
  catch (e) {
    if (options.signal?.aborted) throw e;
    throw new Error('No se pudo contactar con FastAPI. Revisa el backend y la conexión local.');
  }
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(typeof b?.detail === 'string' ? b.detail : `No se pudo completar la solicitud (${r.status}).`);
  }
  return r.json() as Promise<T>;
}
export default function PronosticosPage({ onBack }: { onBack: () => void }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [sku, setSku] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const exportController = useRef<AbortController | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const [job, setJob] = useState<{ empresa_id: string; sku: string; nonce: number; id?: string } | null>(null);
  const [history, setHistory] = useState<{ scope: string; rows: HistoryRow[] }>({ scope: '', rows: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);
  const scope = `${empresaId}/${sku}`;
  useEffect(() => {
    setHistory({ scope: '', rows: [] }); setHistoryError('');
    if (!empresaId || !sku) { setHistoryLoading(false); return; }
    const c = new AbortController(); setHistoryLoading(true);
    request<HistoryRow[]>(`/pronosticos/historial?empresa_id=${encodeURIComponent(empresaId)}&sku=${encodeURIComponent(sku)}&limite=20`, { signal: c.signal })
      .then(rows => { if (!c.signal.aborted) setHistory({ scope, rows }); })
      .catch(e => { if (!c.signal.aborted) setHistoryError(e.message); })
      .finally(() => { if (!c.signal.aborted) setHistoryLoading(false); });
    return () => c.abort();
  }, [empresaId, sku, scope, historyVersion]);
  useEffect(() => {
    const c = new AbortController(); setCompanyLoading(true); setError('');
    request<Empresa[]>('/empresas', { signal: c.signal }).then(rows => {
      if (c.signal.aborted) return;
      setEmpresas(rows); setEmpresaId(old => rows.some(r => r.empresa_id === old) ? old : rows[0]?.empresa_id || '');
    }).catch(e => { if (!c.signal.aborted) setError(e.message); })
      .finally(() => { if (!c.signal.aborted) setCompanyLoading(false); });
    return () => c.abort();
  }, [retry]);
  useEffect(() => {
    setResult(null); setProducts([]); setSku('');
    if (!empresaId) { setProductLoading(false); return; }
    const c = new AbortController(); setProductLoading(true); setError('');
    request<Product[]>(`/productos?empresa_id=${encodeURIComponent(empresaId)}`, { signal: c.signal }).then(rows => {
      if (c.signal.aborted) return;
      setProducts(rows); setSku(rows[0]?.sku || '');
    }).catch(e => { if (!c.signal.aborted) setError(e.message); })
      .finally(() => { if (!c.signal.aborted) setProductLoading(false); });
    return () => c.abort();
  }, [empresaId, retry]);
  useEffect(() => {
    if (!job) return;
    const c = new AbortController(); setCalculating(true); setResult(null); setError('');
    const path = job.id ? `/pronosticos/${encodeURIComponent(job.id)}?empresa_id=${encodeURIComponent(job.empresa_id)}&sku=${encodeURIComponent(job.sku)}` : '/pronosticos';
    const options: RequestInit = job.id ? { signal: c.signal } : { method: 'POST', signal: c.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa_id: job.empresa_id, sku: job.sku }) };
    request<Result>(path, options)
      .then(data => { if (!c.signal.aborted) { setResult(data); if (!job.id) setHistoryVersion(v => v + 1); } })
      .catch(e => { if (!c.signal.aborted) setError(e.message); })
      .finally(() => { if (!c.signal.aborted) setCalculating(false); });
    return () => c.abort();
  }, [job]);
  const busy = companyLoading || productLoading || calculating;
  const data = result?.producto.empresa_id === empresaId && result.producto.sku === sku ? result : null;
  useEffect(() => {
    exportController.current?.abort(); exportController.current = null;
    setExporting(false); setExportError(''); setExportNotice('');
    return () => { exportController.current?.abort(); };
  }, [result?.ejecucion_id, empresaId, sku]);
  async function downloadExcel() {
    if (!data || exportController.current) return;
    const controller = new AbortController(); exportController.current = controller;
    setExporting(true); setExportError(''); setExportNotice('');
    try {
      const path = `/pronosticos/${encodeURIComponent(data.ejecucion_id)}/excel?empresa_id=${encodeURIComponent(data.producto.empresa_id)}&sku=${encodeURIComponent(data.producto.sku)}`;
      let response: Response;
      try { response = await fetch(`${API}${path}`, { signal: controller.signal }); }
      catch { throw new Error('No se pudo contactar con FastAPI para descargar. Revisa el backend e inténtalo de nuevo.'); }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.detail === 'string' ? body.detail : `No se pudo descargar el reporte (${response.status}).`);
      }
      if (!response.headers.get('Content-Type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        throw new Error('El servidor no devolvió un archivo Excel. Comprueba que instalaste la actualización del backend.');
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `NEXOSTOCK-pronostico-${data.ejecucion_id}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice('Archivo enviado al navegador. Revisa tus descargas.');
    } catch (e) {
      if (!controller.signal.aborted) setExportError(e instanceof Error ? e.message : 'No se pudo descargar el reporte.');
    } finally {
      if (exportController.current === controller) { exportController.current = null; setExporting(false); }
    }
  }
  const chart = data ? [...data.historico_reciente.map(p => ({ ...p, predicted: false })), ...data.pronostico.map(p => ({ ...p, predicted: true }))] : [];
  const max = Math.max(1, ...chart.map(p => p.cantidad));
  return <main className="min-h-screen bg-[#e8e8e2] text-[#151515]">
    <div className="top-strip" />
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#b6b6b1] bg-[#f5f5f0] px-5 py-5 md:px-10">
      <BrandLogo /><button onClick={onBack} className="border border-[#151515] px-4 py-2 text-sm hover:bg-[#deded8]">Volver al resumen</button>
    </header>
    <section className="mx-auto max-w-[1500px] space-y-6 px-5 py-8 md:px-10">
      <div><p className="text-sm font-semibold text-[#168178]">NEXOSTOCK / Análisis predictivo</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Pronóstico de demanda</h1><p className="mt-2 text-base text-[#686863]">Estimación de los 30 días posteriores al último registro de ventas.</p></div>
      <div className="flex flex-wrap items-end gap-4 border border-[#b6b6b1] bg-[#fafaf7] p-5">
        <label className="min-w-0 flex-1 text-sm font-semibold">Empresa
          <select value={empresaId} disabled={busy || !empresas.length} onChange={e => { setEmpresaId(e.target.value); setResult(null); setProducts([]); setSku(''); }} className="mt-2 block w-full min-w-48 border border-[#b6b6b1] bg-white p-3 text-base font-normal">
            {!empresas.length && <option value="">Sin empresas</option>}{empresas.map(e => <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>)}
          </select>
        </label>
        <label className="min-w-0 flex-1 text-sm font-semibold">Producto
          <select value={sku} disabled={busy || !products.length} onChange={e => { setSku(e.target.value); setResult(null); setError(''); }} className="mt-2 block w-full min-w-48 border border-[#b6b6b1] bg-white p-3 text-base font-normal">
            {!products.length && <option value="">Sin productos</option>}{products.map(p => <option key={p.sku} value={p.sku}>{p.nombre} · {p.sku}</option>)}
          </select>
        </label>
        <button disabled={busy || !empresaId || !sku} onClick={() => { setCalculating(true); setJob({ empresa_id: empresaId, sku, nonce: Date.now() }); }} className="bg-[#151515] px-5 py-3 text-sm font-semibold text-white hover:bg-[#168178] disabled:opacity-50">{calculating ? (job?.id ? 'Abriendo…' : 'Calculando…') : 'Comparar y guardar'}</button>
      </div>
      {busy && <p role="status" className="bg-[#fafaf7] p-5">{calculating ? (job?.id ? 'Recuperando el resultado guardado…' : 'Entrenando, evaluando y guardando. El cálculo puede tardar unos segundos.') : 'Cargando empresas y productos…'}</p>}
      {error && <div role="alert" className="border border-[#d67a70] bg-[#fbe2df] p-5 text-[#9e2c20]"><p>{error}</p><button disabled={busy} onClick={() => { setResult(null); setRetry(v => v + 1); }} className="mt-3 border border-current px-4 py-2 text-sm">Recargar datos</button></div>}
      {!busy && !error && !data && <p className="bg-[#fafaf7] p-5">{!empresas.length ? 'No hay empresas registradas. Importa los datos para comenzar.' : !products.length ? 'Esta empresa no tiene productos.' : 'Selecciona un producto y pulsa Comparar y guardar, o abre una ejecución del historial. Se requieren 24 meses consecutivos de registros diarios.'}</p>}
      {empresaId && sku && <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Historial del producto</h2><button disabled={busy || historyLoading} onClick={() => setHistoryVersion(v => v + 1)} className="border border-[#151515] px-4 py-2 text-sm disabled:opacity-50">Actualizar historial</button></div>
        <p className="mt-2 text-sm text-[#686863]">Últimas 20 ejecuciones guardadas. Abrir un resultado no vuelve a entrenar los modelos. Las fechas de ejecución se muestran en tu hora local.</p>
        {historyLoading ? <p role="status" className="mt-4">Cargando historial…</p> : historyError ? <p role="alert" className="mt-4 text-[#9e2c20]">{historyError}</p> : history.scope === scope && (history.rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#151515] text-white"><tr>{['Ejecución', 'Modelo', 'Última venta', 'Total estimado · 30 días', 'Consulta'].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead>
          <tbody>{history.rows.map(row => <tr key={row.ejecucion_id} className="border-b border-[#deded8]"><th scope="row" className="p-3 font-normal">{instante(row.creado_en)}<span className="mt-1 block text-xs text-[#686863]">{row.ejecucion_id.slice(0, 8)}</span></th><td className="p-3">{row.nombre_modelo}</td><td className="p-3">{fecha(row.historico_hasta)}</td><td className="p-3">{num(row.total_estimado)}</td><td className="p-3"><button disabled={busy} aria-label={`Abrir ejecución ${row.ejecucion_id}`} onClick={() => { setCalculating(true); setJob({ empresa_id: empresaId, sku, nonce: Date.now(), id: row.ejecucion_id }); }} className="border border-[#168178] px-3 py-2 text-[#168178] disabled:opacity-50">{data?.ejecucion_id === row.ejecucion_id ? 'Ver de nuevo' : 'Abrir'}</button></td></tr>)}</tbody>
        </table></div> : <p className="mt-4 text-sm">Todavía no hay ejecuciones guardadas para este producto.</p>)}
      </section>}
      {data && !busy && !error && <>
        {data.datos_sinteticos && <p className="border border-[#c39122] bg-[#fff2ca] p-4 text-sm text-[#664d0e]">Cálculos sobre datos sintéticos. Los resultados sirven para probar el sistema y no validan las hipótesis de la investigación.</p>}
        <p role="status" className="border border-[#168178] bg-[#e4f3ef] p-4 text-sm">Resultado guardado · {instante(data.creado_en)} · Ejecución {data.ejecucion_id}</p>
        <div className="flex flex-wrap items-center gap-4">
          <button disabled={exporting} onClick={downloadExcel} className="bg-[#168178] px-5 py-3 text-sm font-semibold text-white hover:bg-[#12675f] disabled:opacity-50">{exporting ? 'Preparando Excel…' : 'Descargar Excel'}</button>
          <p className="text-sm text-[#686863]">Incluye estimaciones, métricas, validación y trazabilidad de esta ejecución.</p>
        </div>
        {exportError && <p role="alert" className="border border-[#d67a70] bg-[#fbe2df] p-4 text-sm text-[#9e2c20]">{exportError} Puedes volver a pulsar Descargar Excel.</p>}
        {(exporting || exportNotice) && <p role="status" className="text-sm text-[#168178]">{exporting ? 'Descargando el resultado guardado…' : exportNotice}</p>}
        <div><h2 className="text-xl font-semibold">{data.producto.nombre}</h2><p className="mt-1 text-sm text-[#686863]">{data.producto.empresa} · {data.producto.sku} · Histórico: {fecha(data.historico_desde)} – {fecha(data.historico_hasta)}</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5"><h3 className="text-sm text-[#686863]">Modelo con menor MAE</h3><p className="mt-3 text-xl font-semibold">{data.nombre_modelo}</p><p className="mt-2 text-sm">Selección en la validación temporal</p></article>
          <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5"><h3 className="text-sm text-[#686863]">Cantidad estimada · próximos 30 días</h3><p className="mt-3 text-3xl font-semibold">{num(data.total_estimado)}</p><p className="mt-2 text-sm">Unidad de catálogo: {data.producto.unidad}</p></article>
          <article className="border border-[#b6b6b1] bg-[#fafaf7] p-5"><h3 className="text-sm text-[#686863]">Reducción del MAE frente al método básico</h3><p className="mt-3 text-3xl font-semibold">{data.mejora_mae_vs_ingenuo_pct === null ? 'No aplica' : `${num(data.mejora_mae_vs_ingenuo_pct)} %`}</p><p className="mt-2 text-sm">{data.mejora_mae_vs_ingenuo_pct === null ? 'El método básico tiene error cero.' : 'Resultado de esta validación; no es una garantía.'}</p></article>
        </div>
        <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
          <h2 className="text-xl font-semibold">Comparación de modelos</h2><p className="mt-2 text-sm text-[#686863]">Menor MAE y RMSE indican menos error. R² puede ser negativo; no se define cuando las cantidades observadas son constantes.</p>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#151515] text-white"><tr>{['Modelo', 'MAE', 'RMSE', 'R²', 'Selección'].map(h => <th key={h} className="p-3" scope="col">{h}</th>)}</tr></thead><tbody>{data.metricas.map(m => <tr key={m.modelo} className="border-b border-[#deded8]"><th scope="row" className="p-3 font-medium">{m.nombre}</th><td className="p-3">{num(m.mae)}</td><td className="p-3">{num(m.rmse)}</td><td className="p-3">{m.r2 === null ? 'No definido' : num(m.r2)}</td><td className="p-3 font-semibold text-[#168178]">{m.modelo === data.modelo_elegido ? 'Elegido' : '—'}</td></tr>)}</tbody></table></div>
          <p className="mt-4 text-sm">{data.dias_entrenamiento_inicial} días de entrenamiento inicial · {data.dias_evaluacion} días de evaluación · {fecha(data.evaluacion_desde)} – {fecha(data.evaluacion_hasta)}</p>
          <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Cómo se evaluaron</summary><p className="mt-3">{data.metodo}</p><ul className="mt-3 space-y-2">{data.bloques_evaluacion.map(b => <li key={b.evaluacion_desde}>Entrena hasta {fecha(b.entrenamiento_hasta)}; evalúa {fecha(b.evaluacion_desde)} – {fecha(b.evaluacion_hasta)} ({b.dias} días).</li>)}</ul></details>
        </section>
        <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
          <h2 className="text-xl font-semibold">Histórico reciente y estimación</h2><p className="mt-2 text-sm">Gris: ventas observadas · Verde: pronóstico diario · {fecha(data.pronostico[0].fecha)} – {fecha(data.pronostico[data.pronostico.length - 1].fecha)}</p>
          <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Cantidades diarias observadas y pronosticadas">
            <div className="flex items-end gap-1 pb-4" style={{ minWidth: 1260 }}>{chart.map((p, i) => <div key={p.fecha} className="min-w-4 flex-1" title={`${fecha(p.fecha)}: ${num(p.cantidad)} (${p.predicted ? 'estimado' : 'observado'})`}>
              <div className="flex h-48 items-end border-b border-[#b6b6b1]"><div className={`w-full ${p.predicted ? 'bg-[#168178]' : 'bg-[#777770]'}`} style={{ height: `${p.cantidad / max * 100}%` }} /></div>
              <span className="mt-2 block h-4 whitespace-nowrap text-xs">{i % 7 === 0 || i === 30 ? p.fecha.slice(5) : ''}</span>
            </div>)}</div>
          </div>
          <p className="mt-2 text-sm text-[#686863]">La estimación comienza después del último dato disponible, aunque esa fecha ya haya pasado. Los valores decimales representan cantidades esperadas.</p>
          <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Ver valores diarios</summary><table className="mt-3 w-full text-left"><thead><tr><th className="p-2">Fecha</th><th className="p-2">Cantidad</th><th className="p-2">Tipo</th></tr></thead><tbody>{chart.map(p => <tr key={p.fecha} className="border-t border-[#deded8]"><td className="p-2">{fecha(p.fecha)}</td><td className="p-2">{num(p.cantidad)}</td><td className="p-2">{p.predicted ? 'Pronóstico' : 'Observado'}</td></tr>)}</tbody></table></details>
        </section>
        <CoberturaPanel key={data.ejecucion_id} id={data.ejecucion_id} empresaId={data.producto.empresa_id} sku={data.producto.sku} />
        <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5"><h2 className="font-semibold">Alcance de esta versión</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#686863]">{data.advertencias.map(a => <li key={a}>{a}</li>)}</ul><p className="mt-3 text-sm">Cada cálculo guarda sus estimaciones, métricas y datos de trazabilidad. Los resultados anteriores conservan la información de su ejecución; no cambian al importar nuevas ventas. No se guardan los modelos entrenados.</p></section>
      </>}
    </section>
  </main>;
}
