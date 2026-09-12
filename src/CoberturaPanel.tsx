import { useEffect, useState } from 'react';

type Coverage = {
  ejecucion_id: string; fecha_corte: string; desde: string; hasta: string;
  horizonte_dias: number; stock_inicial: number; unidad: string;
  plazo_entrega_dias: number; demanda_en_plazo: number | null; riesgo_en_plazo: boolean | null;
  estado: 'faltante_en_plazo' | 'faltante_en_horizonte' | 'cubre_horizonte';
  primer_faltante: string | null; dias_completos_cubiertos: number;
  demanda_total: number; stock_final: number; faltante_total: number;
  datos_sinteticos: boolean; supuestos: string[];
  serie: { fecha: string; cantidad_estimada: number; demanda_acumulada: number; stock_restante: number; faltante_acumulado: number }[];
};
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const num = (value: number) => new Intl.NumberFormat('es-NI', { maximumFractionDigits: 6 }).format(value);
const fecha = (value: string) => value.split('-').reverse().join('/');
const labels = {
  faltante_en_plazo: 'Posible faltante durante el plazo de entrega',
  faltante_en_horizonte: 'Posible faltante dentro del período pronosticado',
  cubre_horizonte: 'El stock cubriría la demanda estimada del período',
};

export default function CoberturaPanel({ id, empresaId, sku }: { id: string; empresaId: string; sku: string }) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Coverage | null>(null);
  useEffect(() => {
    if (!version) return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    async function load() {
      try {
        let response: Response;
        try { response = await fetch(`${API}/pronosticos/${encodeURIComponent(id)}/cobertura?empresa_id=${encodeURIComponent(empresaId)}&sku=${encodeURIComponent(sku)}`, { signal: controller.signal, cache: 'no-store' }); }
        catch { throw new Error('No se pudo contactar con FastAPI. Revisa la conexión del backend.'); }
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `No se pudo analizar la cobertura (${response.status}).`);
        if (!body || body.ejecucion_id !== id) throw new Error('La respuesta no corresponde a esta ejecución. Actualiza el backend e inténtalo de nuevo.');
        if (!controller.signal.aborted) setData(body as Coverage);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo analizar la cobertura.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [id, empresaId, sku, version]);
  return <section className="border border-[#b6b6b1] bg-[#fafaf7] p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-semibold">Cobertura estimada del inventario</h2><p className="mt-2 max-w-3xl text-sm text-[#686863]">Simula el consumo del stock registrado con este pronóstico, sin reposiciones. El corte debe coincidir con el cierre del histórico utilizado.</p></div>
      <button disabled={loading} onClick={() => { setLoading(true); setVersion(v => v + 1); }} className="border border-[#168178] px-5 py-3 text-sm font-semibold text-[#168178] hover:bg-[#e4f3ef] disabled:opacity-50">{loading ? 'Analizando…' : version ? 'Actualizar cobertura' : 'Analizar cobertura'}</button>
    </div>
    {loading && <p role="status" className="mt-4 text-sm">Consultando el inventario y calculando su consumo estimado…</p>}
    {error && <p role="alert" className="mt-4 border border-[#d67a70] bg-[#fbe2df] p-4 text-sm text-[#9e2c20]">{error}</p>}
    {data && !loading && <div className="mt-5 space-y-5">
      <div className={`border p-4 ${data.estado === 'cubre_horizonte' ? 'border-[#168178] bg-[#e4f3ef]' : 'border-[#c39122] bg-[#fff2ca]'}`}>
        <h3 className="font-semibold">{labels[data.estado]}</h3>
        <p className="mt-2 text-sm">Corte: {fecha(data.fecha_corte)} · Simulación: {fecha(data.desde)} – {fecha(data.hasta)} · Unidad: {data.unidad}.</p>
        <p className="mt-2 text-sm">Es un escenario desde ese corte, no una confirmación del stock disponible hoy.</p>
        {data.datos_sinteticos && <p className="mt-2 text-sm font-semibold">Incluye datos sintéticos: resultado destinado a pruebas.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Stock al corte', num(data.stock_inicial)], ['Días completos con demanda cubierta', `${data.dias_completos_cubiertos} de ${data.horizonte_dias}`], ['Primer día con faltante estimado', data.primer_faltante ? fecha(data.primer_faltante) : 'Ninguno en este período'], ['Faltante acumulado estimado', num(data.faltante_total)]].map(([label, value]) => <article key={label} className="border border-[#deded8] p-4"><h3 className="text-sm text-[#686863]">{label}</h3><p className="mt-3 text-xl font-semibold">{value}</p></article>)}
      </div>
      <div className="border-l-4 border-[#168178] pl-4 text-sm">
        <h3 className="font-semibold">Plazo de entrega del catálogo: {data.plazo_entrega_dias} días calendario</h3>
        <p className="mt-2">{data.demanda_en_plazo === null ? `El plazo supera los ${data.horizonte_dias} días pronosticados. No se estima la demanda de todo el plazo.` : `Demanda estimada durante el plazo: ${num(data.demanda_en_plazo)} ${data.unidad}.`}</p>
        <p className="mt-2">{data.riesgo_en_plazo === null ? 'No hay suficientes días pronosticados para determinar si el stock cubriría todo el plazo.' : data.riesgo_en_plazo ? 'La simulación prevé un faltante durante ese plazo. Revisa existencias y entregas pendientes antes de decidir una reposición.' : 'La simulación no prevé un faltante durante ese plazo.'}</p>
      </div>
      <p className="text-sm">Demanda estimada del período: {num(data.demanda_total)} · Stock restante estimado al cierre: {num(data.stock_final)}.</p>
      <details className="text-sm"><summary className="cursor-pointer font-semibold">Ver evolución diaria</summary>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[750px] text-left"><thead className="bg-[#151515] text-white"><tr>{['Fecha', 'Demanda estimada', 'Demanda acumulada', 'Stock restante', 'Faltante acumulado'].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>{data.serie.map(row => <tr key={row.fecha} className="border-b border-[#deded8]"><th scope="row" className="p-3 font-normal">{fecha(row.fecha)}</th><td className="p-3">{num(row.cantidad_estimada)}</td><td className="p-3">{num(row.demanda_acumulada)}</td><td className="p-3">{num(row.stock_restante)}</td><td className="p-3">{num(row.faltante_acumulado)}</td></tr>)}</tbody></table></div>
      </details>
      <details className="text-sm"><summary className="cursor-pointer font-semibold">Supuestos y límites</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-[#686863]">{data.supuestos.map(s => <li key={s}>{s}</li>)}</ul></details>
      <p className="text-sm text-[#686863]">El faltante estimado no es una orden de compra. Esta consulta no modifica inventario, mínimos ni órdenes y no se incluye en el Excel del pronóstico.</p>
    </div>}
  </section>;
}
