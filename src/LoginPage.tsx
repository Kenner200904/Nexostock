import React, { useState, useId } from "react";
import BrandLogo from "./BrandLogo";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <circle cx="10" cy="10" r="2.5" />
        </>
      ) : (
        <>
          <path d="M3 3l14 14M10.5 4.07A8.5 8.5 0 0 1 19 10s-.9 1.8-2.5 3.3M6.3 6.3C3.7 7.7 2 10 2 10s3.5 6 8 6c1.6 0 3-.5 4.2-1.3" />
          <path d="M12.4 12.4A2.5 2.5 0 0 1 7.6 7.6" />
        </>
      )}
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2 3 5v5c0 4 3.5 7.3 7 8 3.5-.7 7-4 7-8V5l-7-3Z" />
      <path d="m7 10 2 2 4-4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="12" height="9" rx="0" />
      <path d="M7 9V6a3 3 0 0 1 6 0v3" />
      <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="16" height="12" />
      <path d="m2 4 8 7 8-7" />
    </svg>
  );
}

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("demo@nexostock.example");
  const [password, setPassword] = useState("demo12345");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!emailValid || !passwordValid) return;

    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 1200);
  }

  const showEmailError = touched.email && !emailValid && email.length > 0;
  const showPasswordError = touched.password && !passwordValid && password.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#e8e8e2] text-[#151515]">
      <div className="top-strip" />

      {/* Split layout */}
      <div className="flex flex-1 flex-col md:flex-row">

        {/* ── Left panel — branding ── */}
        <div className="relative hidden flex-col justify-between bg-[#151515] p-10 text-white md:flex md:w-[42%] lg:w-[46%]">
          {/* subtle grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[.04]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          {/* Logo + brand */}
          <div className="relative z-10"><BrandLogo dark /></div>

          {/* Center copy */}
          <div className="relative z-10 my-auto">
            <p className="wire-label text-[#80d3c9]">Nexo Stock · Acceso seguro</p>
            <h2 className="mt-5 text-4xl font-bold leading-tight tracking-[-.06em] lg:text-5xl">
              Inteligencia de inventario
              <br />
              <span className="text-[#80d3c9]">para tu comercio.</span>
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#c1c1bb]">
              Accede a predicciones en tiempo real, alertas de ruptura y análisis de mermas para tu comercio.
            </p>

            {/* trust signals */}
            <div className="mt-10 flex flex-col gap-3">
              {[
                "Cifrado TLS 1.3 en tránsito",
                "Datos anonimizados en reposo",
                "Acceso por rol y comercio",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-[#c1c1bb]">
                  <span className="text-[#80d3c9]">
                    <ShieldIcon />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom label */}
          <p className="relative z-10 wire-label text-[#454540]">
            © 2026 Nexo Stock
          </p>
        </div>

        {/* ── Right panel — form ── */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:py-0">

          {/* Mobile logo */}
          <div className="mb-8 md:hidden"><BrandLogo /></div>

          <div className="w-full max-w-[400px]">
            {/* Heading */}
            <div className="border-b-2 border-[#151515] pb-5">
              <p className="wire-label text-[#168178]">Personal minorista / acceso</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-.05em]">
                Iniciar sesión
              </h1>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">

              {/* Email */}
              <div>
                <label htmlFor={emailId} className="wire-label mb-2 block">
                  Correo corporativo
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#686863]">
                    <MailIcon />
                  </span>
                  <input
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    placeholder="usuario@comercio.com"
                    aria-invalid={showEmailError}
                    aria-describedby={showEmailError ? `${emailId}-err` : undefined}
                    className={`w-full border bg-[#fafaf7] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-[#b6b6b1] transition-colors focus:border-[#168178] ${
                      showEmailError
                        ? "border-[#db3f2f] bg-[#fdf4f3]"
                        : "border-[#b6b6b1]"
                    }`}
                  />
                </div>
                {showEmailError && (
                  <p id={`${emailId}-err`} className="mt-1.5 font-mono text-[11px] text-[#db3f2f]">
                    Ingresa un correo válido.
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor={passwordId} className="wire-label">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    className="wire-label text-[#168178] transition-colors hover:text-[#168178]/70"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#686863]">
                    <LockIcon />
                  </span>
                  <input
                    id={passwordId}
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder="Mínimo 8 caracteres"
                    aria-invalid={showPasswordError}
                    aria-describedby={showPasswordError ? `${passwordId}-err` : undefined}
                    className={`w-full border bg-[#fafaf7] py-3 pl-10 pr-12 text-sm outline-none placeholder:text-[#b6b6b1] transition-colors focus:border-[#168178] ${
                      showPasswordError
                        ? "border-[#db3f2f] bg-[#fdf4f3]"
                        : "border-[#b6b6b1]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#686863] transition-colors hover:text-[#151515]"
                  >
                    <EyeIcon open={showPass} />
                  </button>
                </div>
                {showPasswordError && (
                  <p id={`${passwordId}-err`} className="mt-1.5 font-mono text-[11px] text-[#db3f2f]">
                    La contraseña debe tener al menos 8 caracteres.
                  </p>
                )}

                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {[...Array(4)].map((_, i) => {
                      const strength =
                        password.length >= 12 && /[^a-zA-Z0-9]/.test(password)
                          ? 4
                          : password.length >= 10
                          ? 3
                          : password.length >= 8
                          ? 2
                          : 1;
                      return (
                        <span
                          key={i}
                          className={`h-0.5 flex-1 transition-colors ${
                            i < strength
                              ? strength === 4
                                ? "bg-[#168178]"
                                : strength === 3
                                ? "bg-[#e4ad3d]"
                                : strength === 2
                                ? "bg-[#e4ad3d]"
                                : "bg-[#db3f2f]"
                              : "bg-[#deded8]"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Server error */}
              {error && (
                <div className="border border-[#db3f2f] bg-[#fbe2df] px-4 py-3">
                  <p className="font-mono text-[11px] text-[#9e2c20]">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="relative mt-1 w-full bg-[#151515] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#168178] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    Abriendo demostración…
                  </span>
                ) : (
                  "Entrar a la demostración →"
                )}
              </button>
            </form>

            {/* Session note */}
            <p className="mt-5 wire-label text-center text-[#aaa]">
              Acceso de prueba · No introduzcas credenciales reales
            </p>

            {/* ── Privacy & Data notice ── */}
            <div className="mt-8 border border-[#b6b6b1] bg-[#fafaf7] p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-[#168178]">
                  <ShieldIcon />
                </span>
                <div>
                  <p className="wire-label text-[#168178]">
                    Privacidad y anonimización de datos
                  </p>
                  <p className="mt-2 font-mono text-[11px] leading-5 text-[#686863]">
                    Todos los datos de operación son cifrados en tránsito con{" "}
                    <strong className="text-[#151515]">TLS 1.3</strong> y en reposo con{" "}
                    <strong className="text-[#151515]">AES-256</strong>. La
                    información personal del operador es anonimizada antes de su
                    procesamiento analítico. Nexo Stock no comparte datos con terceros
                    sin consentimiento explícito del titular del comercio.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {["Política de privacidad", "Términos de uso"].map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        className="wire-label text-[#168178] underline underline-offset-2 transition-opacity hover:opacity-70"
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
