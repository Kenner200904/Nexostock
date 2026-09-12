import React, { useState, useEffect } from "react";
import BrandLogo from "./BrandLogo";

const METRICS = [
  { val: "87%", label: "Precisión predictiva", desc: "Nuestros modelos de ML supervisado predicen demanda con 87% de exactitud en series históricas de 90+ días." },
  { val: "−34%", label: "Reducción de mermas", desc: "Los comercios con Nexo Stock reducen en promedio un 34% sus pérdidas por vencimiento y sobreinventario." },
  { val: "2.1×", label: "Retorno sobre inversión", desc: "Por cada unidad invertida en Nexo Stock, los negocios recuperan 2.1 en eficiencia operativa el primer año." },
  { val: "98.4%", label: "Disponibilidad", desc: "Plataforma disponible 24/7 con sincronización de datos cada 15 minutos para decisiones en tiempo real." },
];

const SERVICES = [
  {
    num: "01",
    title: "Predicción de demanda",
    desc: "Modelos de aprendizaje supervisado que analizan historial de ventas, estacionalidad y eventos locales para anticipar cuánto necesitarás antes de quedarte sin stock.",
    tags: ["ML Supervisado", "Serie temporal", "Categorías"],
  },
  {
    num: "02",
    title: "Control de inventario",
    desc: "Seguimiento en tiempo real de existencias por SKU, sucursal y categoría. Panel unificado con alertas automáticas cuando el stock cae bajo umbrales configurables.",
    tags: ["Tiempo real", "Multi-SKU", "Alertas"],
  },
  {
    num: "03",
    title: "Análisis de mermas",
    desc: "Identifica productos con mayor riesgo de vencimiento, detecta patrones de pérdida y genera recomendaciones de pedido para reducir sobreinventario.",
    tags: ["Optimización", "Rotación", "Recomendaciones"],
  },
];

const CLIENTS = [
  { name: "Pulpería Don Carlos", type: "Abarrotes generales", since: "Cliente desde 2024", skus: "340 SKUs" },
  { name: "Mercado San Juan", type: "Mercado minorista", since: "Cliente desde 2024", skus: "1,284 SKUs" },
  { name: "Abarrotería La Central", type: "Abarrotes y granos", since: "Cliente desde 2025", skus: "512 SKUs" },
  { name: "Distribuidora Flores", type: "Distribución local", since: "Cliente desde 2025", skus: "890 SKUs" },
  { name: "Minisuper El Buen Precio", type: "Supermercado", since: "Cliente desde 2025", skus: "720 SKUs" },
  { name: "Colmado El Progreso", type: "Colmado familiar", since: "Cliente desde 2026", skus: "280 SKUs" },
];

const TIMELINE = [
  ["2024", "Fundación de Nexo Stock. Primeros dos comercios integrados."],
  ["2025", "Expansión a 6 comercios activos con 3,800+ SKUs gestionados."],
  ["2026", "Lanzamiento de predicción multi-categoría con modelo ML v2.0."],
];

const NAV = [
  ["confianza", "Por qué nosotros"],
  ["servicios", "Servicios"],
  ["clientes", "Clientes"],
  ["acerca", "Acerca de"],
];

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function scrollTo(id: string) {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-[#e8e8e2] text-[#151515]">
      <div className="top-strip" />

      {/* ── Header ── */}
      <header
        className={`sticky top-0 z-50 border-b border-[#b6b6b1] bg-[#f5f5f0] transition-shadow duration-150 ${
          scrolled ? "shadow-[0_2px_12px_rgba(0,0,0,.08)]" : ""
        }`}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <BrandLogo />

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="wire-label transition-colors hover:text-[#168178]"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onEnter}
              className="bg-[#151515] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#168178]"
            >
              Empezar →
            </button>
            <button
              className="flex flex-col gap-1.5 p-2 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menú"
            >
              <span className="block h-px w-5 bg-[#151515]" />
              <span className="block h-px w-5 bg-[#151515]" />
              <span className="block h-px w-3 bg-[#151515]" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-[#b6b6b1] bg-[#f5f5f0] px-6 py-4 md:hidden">
            {NAV.map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="block w-full py-3 text-left wire-label transition-colors hover:text-[#168178]"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="bg-[#151515] text-white">
        <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-20 md:pb-24 md:pt-28">
          <p className="wire-label text-[#80d3c9]">Plataforma B2B · Inventario inteligente</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[1.04] tracking-[-.06em] md:text-7xl">
            Inventario que{" "}
            <span className="text-[#80d3c9]">predice,</span>
            <br />
            no que reacciona.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#c1c1bb]">
            Plataforma de optimización con aprendizaje supervisado, diseñada para
            comercios minoristas. Anticipa la demanda, reduce mermas
            y elimina quiebres de stock.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <button
              onClick={onEnter}
              className="bg-[#168178] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#80d3c9] hover:text-[#12332f]"
            >
              Entrar al dashboard →
            </button>
            <button
              onClick={() => scrollTo("servicios")}
              className="border border-[#454540] px-7 py-4 text-sm font-semibold text-[#c1c1bb] transition-colors hover:border-white hover:text-white"
            >
              Ver servicios
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-[#454540]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap">
            {[
              ["87%", "Precisión predictiva"],
              ["−34%", "Reducción de mermas"],
              ["1,284", "SKUs gestionados"],
              ["48 h", "Implementación"],
            ].map(([val, label], i) => (
              <div
                key={label}
                className={`w-1/2 py-8 pl-6 pr-6 md:w-1/4 ${
                  i === 0 ? "pl-6 md:pl-6" : "border-l border-[#454540]"
                } ${i >= 2 ? "border-t border-[#454540] md:border-t-0" : ""}`}
              >
                <strong className="block font-mono text-3xl font-medium text-[#80d3c9]">
                  {val}
                </strong>
                <p className="wire-label mt-2 text-[#686863]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ¿Por qué confiar? ── */}
      <section id="confianza" className="py-20 md:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="border-b-2 border-[#151515] pb-6">
            <p className="wire-label text-[#168178]">Evidencia / resultados reales</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-.05em] md:text-4xl">
              ¿Por qué confiar en nosotros?
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {METRICS.map((m) => (
              <article key={m.val} className="border border-[#b6b6b1] bg-[#fafaf7] p-6">
                <strong className="block text-4xl font-medium tracking-[-.06em] text-[#168178]">
                  {m.val}
                </strong>
                <p className="wire-label mt-4">{m.label}</p>
                <p className="mt-3 text-sm leading-6 text-[#686863]">{m.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Servicios ── */}
      <section id="servicios" className="bg-[#f5f5f0] py-20 md:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="border-b-2 border-[#151515] pb-6">
            <p className="wire-label text-[#168178]">Módulos de plataforma</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-.05em] md:text-4xl">
              Servicios
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {SERVICES.map((svc) => (
              <article
                key={svc.num}
                className="flex flex-col border border-[#b6b6b1] bg-[#fafaf7] p-7 transition-colors hover:border-[#168178]"
              >
                <p className="font-mono text-5xl font-medium text-[#deded8]">{svc.num}</p>
                <h3 className="mt-6 text-xl font-semibold tracking-[-.04em]">{svc.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-[#686863]">{svc.desc}</p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {svc.tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Clientes ── */}
      <section id="clientes" className="py-20 md:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="border-b-2 border-[#151515] pb-6">
            <p className="wire-label text-[#168178]">Red de comercios / activos en 2026</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-.05em] md:text-4xl">
              Clientes
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#686863]">
              Comercios minoristas que ya optimizan su inventario
              con Nexo Stock.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CLIENTS.map((c) => (
              <article
                key={c.name}
                className="border border-[#b6b6b1] bg-[#fafaf7] p-5 transition-colors hover:border-[#168178]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold tracking-[-.03em]">{c.name}</p>
                    <p className="wire-label mt-1">{c.type}</p>
                  </div>
                  <span className="shrink-0 border border-[#b6b6b1] bg-[#e8e8e2] px-2 py-1 font-mono text-[10px] text-[#168178]">
                    {c.skus}
                  </span>
                </div>
                <p className="wire-label mt-5 text-[#aaa]">{c.since}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 border border-[#e4ad3d] bg-[#fff9eb] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="wire-label text-[#664d0e]">¿Tu comercio no está en la lista?</p>
                <p className="mt-1 text-sm font-semibold">
                  Únete a la red de comercios inteligentes.
                </p>
              </div>
              <button
                onClick={onEnter}
                className="shrink-0 bg-[#151515] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#168178]"
              >
                Solicitar acceso →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Acerca de ── */}
      <section id="acerca" className="bg-[#151515] py-20 text-white md:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid gap-16 md:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="wire-label text-[#80d3c9]">Nuestra misión</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-.05em] md:text-5xl">
                Democratizar el análisis predictivo para el comercio local.
              </h2>
              <p className="mt-6 text-sm leading-7 text-[#c1c1bb]">
                Nexo Stock nació con la convicción de que las herramientas de
                inteligencia artificial no deben ser exclusivas de las grandes cadenas.
                Los comercios minoristas locales merecen la misma ventaja competitiva.
              </p>
              <p className="mt-4 text-sm leading-7 text-[#c1c1bb]">
                Nuestra plataforma combina algoritmos de aprendizaje supervisado con la
                realidad del comercio minorista: estacionalidad,
                festividades, fluctuaciones de precios y cadenas de suministro.
              </p>
              <button
                onClick={onEnter}
                className="mt-8 bg-[#168178] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#80d3c9] hover:text-[#12332f]"
              >
                Acceder a la plataforma →
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <p className="wire-label text-[#454540]">Hitos de la empresa</p>
              {TIMELINE.map(([year, event]) => (
                <div
                  key={year}
                  className="border border-[#333330] bg-[#1d1d1a] p-5 transition-colors hover:border-[#454540]"
                >
                  <p className="font-mono text-sm font-medium text-[#80d3c9]">{year}</p>
                  <p className="mt-2 text-sm leading-6 text-[#c1c1bb]">{event}</p>
                </div>
              ))}
              <div className="mt-2 border-t border-[#333330] pt-5">
                <p className="wire-label text-[#686863]">Plataforma de comercio minorista</p>
                <p className="wire-label mt-1 text-[#686863]">
                  Equipo:{" "}
                  <span className="text-[#c1c1bb]">Ingeniería · Datos · Comercio</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#b6b6b1] bg-[#f5f5f0]">
        <div className="mx-auto max-w-[1200px] px-6 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <BrandLogo />

            <nav className="flex flex-wrap gap-6">
              {NAV.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="wire-label transition-colors hover:text-[#168178]"
                >
                  {label}
                </button>
              ))}
            </nav>

            <p className="wire-label text-[#aaa]">© 2026 Nexo Stock</p>
          </div>

          <div className="mt-8 border-t border-[#deded8] pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="wire-label text-[#aaa]">
                Plataforma de optimización de inventario con inteligencia artificial
              </p>
              <div className="flex gap-4">
                <span className="wire-label text-[#aaa]">Privacidad</span>
                <span className="wire-label text-[#aaa]">Términos</span>
                <span className="wire-label text-[#aaa]">Contacto</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
