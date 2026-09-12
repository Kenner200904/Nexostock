import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo';

type Empresa = { empresa_id: string; nombre: string; moneda: string; origen: string };
type Producto = {
  empresa_id: string; sku: string; nombre: string; categoria: string; unidad: string;
  precio_base: string | number; plazo_entrega_dias: number; origen: string;
  stock_actual: number | null; stock_minimo: number | null; fecha_corte: string | null;
  tipo_umbral: string | null; origen_inventario: string | null;
};
const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API}${path}`, { signal }); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new Error('No se pudo contactar con la API. Comprueba que FastAPI esté iniciado y que el origen del frontend esté permitido.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `No se pudo completar la consulta (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function estado(p: Producto) {
  if (p.stock_actual === null || p.stock_minimo === null) return { text: 'Sin registro', color: 'text-[#686863]' };
  if (p.stock_actual === 0) return { text: 'Agotado', color: 'text-[#9e2c20]' };
  if (p.stock_actual < p.stock_minimo) return { text: 'Bajo el mínimo', color: 'text-[#9e2c20]' };
  if (p.stock_actual === p.stock_minimo) return { text: 'En el mínimo', color: 'text-[#664d0e]' };
  return { text: 'Sobre el mínimo', color: 'text-[#168178]' };
}

export default function ProductosPage({ onBack }: { onBack: () => void }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [errorEmpresas, setErrorEmpresas] = useState('');
  const [errorProductos, setErrorProductos] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingEmpresas(true); setErrorEmpresas('');
    get<Empresa[]>('/empresas', controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      setEmpresas(rows);
      setEmpresaId(current => rows.some(r => r.empresa_id === current) ? current : rows[0]?.empresa_id || '');
    }).catch(error => { if (!controller.signal.aborted) setErrorEmpresas(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingEmpresas(false); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!empresaId) { setProductos([]); setLoadingProductos(false); return; }
    const controller = new AbortController();
    setProductos([]); setErrorProductos(''); setLoadingProductos(true);
    get<Producto[]>(`/productos?empresa_id=${encodeURIComponent(empresaId)}`, controller.signal).then(rows => {
      if (!controller.signal.aborted) setProductos(rows);
    }).catch(error => { if (!controller.signal.aborted) setErrorProductos(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingProductos(false); });
    return () => controller.abort();
  }, [empresaId, attempt]);

  const empresa = empresas.find(e => e.empresa_id === empresaId);
  const rows = productos.filter(p => p.empresa_id === empresaId);
  const loading = loadingEmpresas || loadingProductos;
  const error = errorEmpresas || errorProductos;
  const price = (v: string | number) => new Intl.NumberFormat('es-NI', { style: 'currency', currency: empresa?.moneda || 'NIO' }).format(Number(v));
  return <main className="min-h-screen bg-[#e8e8e2] text-[#151515]">
    <div className="top-strip" />
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#b6b6b1] bg-[#f5f5f0] px-5 py-5 md:px-10">
      <BrandLogo />
      <button onClick={onBack} className="border border-[#151515] px-4 py-2 text-sm hover:bg-[#deded8]">Volver al resumen</button>
    </header>
    <section className="mx-auto max-w-[1500px] px-5 py-8 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Productos e inventario</h1>
      <p className="mt-2 text-base text-[#686863]">Existencias del último corte registrado para cada producto.</p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full sm:w-auto">
          <label htmlFor="empresa" className="mb-2 block text-sm font-semibold">Empresa</label>
          <select id="empresa" value={empresaId} disabled={loadingEmpresas || !!errorEmpresas || !empresas.length}
            onChange={e => { setEmpresaId(e.target.value); setProductos([]); setErrorProductos(''); setLoadingProductos(true); }}
            className="w-full border border-[#b6b6b1] bg-[#fafaf7] p-3 text-base sm:min-w-72">
            {!empresas.length && <option value="">Sin empresas disponibles</option>}
            {empresas.map(e => <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>)}
          </select>
        </div>
        <button onClick={() => setAttempt(a => a + 1)} disabled={loading}
          className="bg-[#151515] px-5 py-3 text-sm font-semibold text-white hover:bg-[#168178] disabled:opacity-50">Actualizar</button>
      </div>
      {loading ? <p role="status" className="mt-6 border border-[#b6b6b1] bg-[#fafaf7] p-6">Cargando datos…</p>
        : error ? <div role="alert" className="mt-6 border border-[#d67a70] bg-[#fbe2df] p-5 text-[#9e2c20]">{error} Pulsa Actualizar para reintentar.</div>
        : !empresas.length ? <p className="mt-6 bg-[#fafaf7] p-6">No hay empresas registradas. Importa el archivo de prueba para comenzar.</p>
        : <>
          {(empresa?.origen === 'SINTETICO' || rows.some(p => p.origen === 'SINTETICO' || p.origen_inventario === 'SINTETICO')) &&
            <p className="mt-5 border border-[#c39122] bg-[#fff2ca] p-3 text-sm text-[#664d0e]">Datos sintéticos importados para pruebas. Los mínimos son manuales; todavía no son recomendaciones predictivas.</p>}
          <p className="my-4 text-sm">{rows.length} productos · {empresa?.nombre}</p>
          {!rows.length ? <p className="bg-[#fafaf7] p-6">Esta empresa todavía no tiene productos.</p> :
            <div className="overflow-x-auto border border-[#b6b6b1] bg-[#fafaf7]" tabIndex={0} role="region" aria-label="Inventario por producto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <caption className="sr-only">Productos de {empresa?.nombre} y existencias del último corte</caption>
                <thead className="bg-[#151515] text-white"><tr>
                  {['SKU', 'Producto', 'Precio base', 'Stock', 'Mínimo', 'Unidad', 'Fecha de corte', 'Estado'].map(h => <th key={h} scope="col" className="whitespace-nowrap p-4 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>{rows.map(p => <tr key={`${p.empresa_id}/${p.sku}`} className="border-b border-[#deded8] last:border-0">
                  <td className="whitespace-nowrap p-4 font-mono">{p.sku}</td>
                  <th scope="row" className="p-4 font-medium">{p.nombre}<span className="mt-1 block text-xs font-normal text-[#686863]">{p.categoria}</span></th>
                  <td className="whitespace-nowrap p-4">{price(p.precio_base)}</td>
                  <td className="p-4">{p.stock_actual ?? '—'}</td><td className="p-4">{p.stock_minimo ?? '—'}</td>
                  <td className="p-4">{p.unidad}</td><td className="whitespace-nowrap p-4">{p.fecha_corte ?? 'Sin corte'}</td>
                  <td className={`whitespace-nowrap p-4 font-semibold ${estado(p).color}`}>{estado(p).text}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </>}
    </section>
  </main>;
}
