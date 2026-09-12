# NEXOSTOCK

Base frontend ejecutable fuera de Figma, con el isotipo actualizado del último ZIP y siete pantallas. Esta entrega es una demostración; todavía no es un sistema de inventario para producción.

## Ejecutarlo en Windows, Linux o macOS

1. Instala Node.js 24 y abre la carpeta del proyecto en VS Code o tu editor.
2. Abre una terminal en la carpeta donde está `package.json`.
3. Instala el gestor de paquetes (una sola vez):

```sh
npm install -g pnpm@11.19.0
```

4. Instala las dependencias exactas del proyecto y arranca:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

5. Abre la dirección que indique la terminal, normalmente `http://localhost:5173`.
6. Pulsa el botón de acceso de la portada y después «Entrar a la demostración». El formulario ya contiene datos de prueba. No uses contraseñas reales.

Para detenerlo, pulsa Ctrl+C en la terminal. No abras `index.html` con doble clic: esta aplicación debe servirse por HTTP.

## Compilar

```sh
pnpm typecheck
pnpm build
pnpm preview
```

`dist/` contiene una compilación lista para un servidor de archivos estáticos. Se incluye en este ZIP. Para incorporar cambios posteriores debes volver a ejecutar `pnpm build`. No se ha publicado el proyecto en Internet.

La navegación usa fragmentos de URL (`#/dashboard`), por lo que conserva la pantalla al recargar y permite usar Atrás/Adelante del navegador sin configurar reglas de rutas en el servidor. El estado interno de cada pantalla no persiste al salir ni al recargar. Las rutas son públicas; no existe control de acceso.

## Qué tiene y qué falta

| Módulo | Estado comprobado en el código | Trabajo pendiente para datos reales |
| --- | --- | --- |
| Portada | Diseño, menú y navegación | Ajustar contenido final del negocio |
| Acceso | Formulario y validación de formato | Usuarios, contraseñas cifradas, sesiones y autorización en servidor |
| Dashboard | Indicadores y gráficos de ejemplo | Consultar ventas e inventario de la base de datos |
| Carga CSV | Selección de archivo y secuencia animada | Leer contenido, validar columnas y filas, informar errores y guardar registros |
| Administración | Gráficas y controles visuales | Consultas agregadas, permisos y acciones administrativas |
| Estacionalidad | Calendario y selección de fechas | Guardar configuración y ejecutar cálculo/modelo real |
| Alertas y órdenes | Búsqueda, filtros, ordenamiento y selección sobre productos fijos | Stock real, órdenes persistentes y seguimiento de estados |

La carga CSV original NO lee los registros: estima una cantidad con el tamaño del archivo y un componente aleatorio, y presenta estadísticas fijas. Los pasos de limpieza y entrenamiento son simulados. Las órdenes solo cambian temporalmente de estado en pantalla, no se guardan ni se envían. El botón de actualización del modelo tampoco entrena un modelo. Algunos botones de la maqueta siguen sin acción. El aviso de demostración aparece en todas las pantallas para identificar estos límites.

## Cambios de esta entrega

- Configuración de Vite independiente de los complementos y metadatos de Figma Make.
- Documento HTML en español con título NEXOSTOCK y descripción propia.
- Conservación de React, TypeScript, Tailwind, componentes, logotipo y versiones del lockfile.
- Navegación por URL con soporte para recarga y historial del navegador.
- Aviso global de demostración y credenciales ficticias precargadas; retirada de la afirmación de sesión protegida con cierre automático.
- Foco visible para teclado y respeto a la preferencia de movimiento reducido.
- Comando de verificación TypeScript y compilación incluida.

## Estructura

- `src/App.tsx`: navegación y aviso de demostración.
- `src/LandingPage.tsx`: portada.
- `src/LoginPage.tsx`: formulario de acceso simulado.
- `src/Dashboard.tsx`: resumen.
- `src/DataIngestionPage.tsx`: simulación de carga CSV.
- `src/AdminPanel.tsx`: panel administrativo.
- `src/SeasonalityPage.tsx`: calendario y configuración visual.
- `src/StockAlertsPage.tsx`: productos de ejemplo y órdenes simuladas.
- `src/index.css`: estilos compartidos.
- `src/BrandLogo.tsx`: componente de marca actualizado.
- `src/imports/Nexostock.png`: isotipo actualizado, conservado sin modificar.

Las fuentes Manrope y DM Mono se cargan desde Google Fonts. Sin conexión se usan las alternativas del sistema. El logotipo está incluido localmente.

## Siguiente implementación

Tecnologías elegidas para la siguiente fase: Python + FastAPI, Pandas, Scikit-learn y PostgreSQL. Esta entrega conserva únicamente el frontend React + TypeScript. Falta definir dónde se ejecutará y si servirá a una o varias empresas.

Orden propuesto:

1. Modelo de datos: usuarios/roles, productos, categorías, proveedores, movimientos de inventario, ventas, importaciones, órdenes y fechas especiales. Aclarar si habrá una tienda o varias.
2. API y base de datos con autenticación y permisos reales.
3. Productos, entradas/salidas e importación CSV transaccional con reporte de errores. Confirmar un archivo de ventas representativo y el significado de cada columna.
4. Dashboard y alertas calculadas desde los movimientos; órdenes guardadas con sus cantidades y estados.
5. Pronósticos sobre histórico real con una línea base y evaluación de error; luego incorporar estacionalidad y modelos más complejos si aportan una mejora medible.

## Verificación de esta entrega

- Instalación desde `pnpm-lock.yaml`: correcta.
- `pnpm typecheck`: sin errores.
- `pnpm build`: compilación correcta.
- No se hicieron pruebas visuales ni de interacción en navegador.
- No se añadieron backend, base de datos, autenticación real ni modelos predictivos.
