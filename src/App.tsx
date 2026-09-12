import React, { useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import LoginPage from "./LoginPage";
import Dashboard from "./Dashboard";
import DataIngestionPage from "./DataIngestionPage";
import AdminPanel from "./AdminPanel";
import SeasonalityPage from "./SeasonalityPage";
import StockAlertsPage from "./StockAlertsPage";
import ProductosPage from "./ProductosPage";
import PronosticosPage from "./PronosticosPage";

type View = "landing" | "login" | "dashboard" | "ingestion" | "admin" | "seasonality" | "alerts" | "productos" | "pronosticos";

const views: View[] = ["landing", "login", "dashboard", "ingestion", "admin", "seasonality", "alerts", "productos", "pronosticos"];
function currentView(): View {
  const candidate = window.location.hash.replace(/^#\/?/, "") as View;
  return views.includes(candidate) ? candidate : "landing";
}

function Screens() {
  const [view, updateView] = useState<View>(currentView);
  const setView = (next: View) => { window.location.hash = `/${next}`; };
  useEffect(() => {
    const onChange = () => { updateView(currentView()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (view === "pronosticos") return <PronosticosPage onBack={() => setView("dashboard")} />;
  if (view === "productos") return <ProductosPage onBack={() => setView("dashboard")} />;
  if (view === "login")       return <LoginPage onLogin={() => setView("dashboard")} />;
  if (view === "dashboard")   return <Dashboard onPronosticos={() => setView("pronosticos")} onProductos={() => setView("productos")} onBack={() => setView("landing")} onIngestion={() => setView("ingestion")} onAdmin={() => setView("admin")} onAlerts={() => setView("alerts")} />;
  if (view === "ingestion")   return <DataIngestionPage onBack={() => setView("dashboard")} />;
  if (view === "admin")       return <AdminPanel onBack={() => setView("dashboard")} onSeasonality={() => setView("seasonality")} onAlerts={() => setView("alerts")} onIngestion={() => setView("ingestion")} />;
  if (view === "seasonality") return <SeasonalityPage onBack={() => setView("admin")} />;
  if (view === "alerts")      return <StockAlertsPage onBack={() => setView("dashboard")} />;
  return <LandingPage onEnter={() => setView("login")} />;
}

export default function App() {
  return <>
    <div role="note" className="border-b border-[#c39122] bg-[#fff2ca] px-4 py-3 text-center text-sm text-[#664d0e]">
      Versión de desarrollo · Resumen e inventario conectados · Pronósticos experimentales disponibles · Acceso, órdenes y panel admin aún en demostración.
    </div>
    <Screens />
  </>;
}
