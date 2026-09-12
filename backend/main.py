import os
from datetime import date
from decimal import Decimal
from pathlib import Path
from threading import Lock
from uuid import UUID
import historial

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

load_dotenv(Path(__file__).with_name('.env'))

database_url = URL.create(
    drivername='postgresql+psycopg',
    username=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    host=os.environ['DB_HOST'],
    port=int(os.environ['DB_PORT']),
    database=os.environ['DB_NAME'],
)
engine = create_engine(database_url, pool_pre_ping=True, connect_args={'connect_timeout': 5})

app = FastAPI(title='NEXOSTOCK API', version='0.8.0',
              description='Desarrollo local. Consulta de datos importados; autenticacion pendiente.')
origins = os.getenv('FRONTEND_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
app.add_middleware(CORSMiddleware, allow_origins=[s.strip() for s in origins if s.strip()],
                   allow_credentials=False, allow_methods=['GET', 'POST'], allow_headers=['Accept', 'Content-Type'])


class Empresa(BaseModel):
    empresa_id: str
    nombre: str
    sector: str
    ciudad: str
    moneda: str
    origen: str


class Producto(BaseModel):
    empresa_id: str
    sku: str
    nombre: str
    categoria: str
    unidad: str
    precio_base: Decimal
    plazo_entrega_dias: int
    origen: str
    stock_actual: int | None
    stock_minimo: int | None
    fecha_corte: date | None
    tipo_umbral: str | None
    origen_inventario: str | None


@app.get('/')
def inicio():
    return {'mensaje': 'API de NEXOSTOCK funcionando'}


@app.get('/health/db')
def comprobar_base_datos():
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        return {'estado': 'ok', 'base_datos': 'conectada'}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo conectar con PostgreSQL') from None


@app.get('/empresas', response_model=list[Empresa])
def listar_empresas():
    try:
        with engine.connect() as conn:
            return [dict(r) for r in conn.execute(text('''
                SELECT empresa_id, nombre, sector, ciudad, moneda, origen
                FROM public.empresas ORDER BY nombre, empresa_id
            ''')).mappings()]
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudieron consultar las empresas. Revisa PostgreSQL y las tablas.') from None


@app.get('/productos', response_model=list[Producto])
def listar_productos(empresa_id: str = Query(min_length=1, max_length=40)):
    # empresa_id es un filtro, no un permiso. No publicar hasta implementar autenticacion.
    try:
        with engine.connect() as conn:
            exists = conn.execute(text('SELECT 1 FROM public.empresas WHERE empresa_id = :empresa_id'),
                                  {'empresa_id': empresa_id}).first()
            if exists is None:
                raise HTTPException(status_code=404, detail='La empresa no existe')
            result = conn.execute(text('''
                SELECT p.empresa_id, p.sku, p.nombre, p.categoria, p.unidad,
                       p.precio_base, p.plazo_entrega_dias, p.origen,
                       i.stock_actual, i.stock_minimo, i.fecha_corte,
                       i.tipo_umbral, i.origen AS origen_inventario
                FROM public.productos AS p
                LEFT JOIN public.inventario AS i
                  ON i.empresa_id = p.empresa_id AND i.sku = p.sku
                 AND i.fecha_corte = (
                     SELECT MAX(h.fecha_corte) FROM public.inventario AS h
                     WHERE h.empresa_id = p.empresa_id AND h.sku = p.sku
                 )
                WHERE p.empresa_id = :empresa_id
                ORDER BY p.nombre, p.sku
            '''), {'empresa_id': empresa_id})
            return [dict(r) for r in result.mappings()]
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudieron consultar los productos. Revisa PostgreSQL y las tablas.') from None


class MesVentas(BaseModel):
    mes: str
    unidades: int | None
    registros: int


class ProductoVendido(BaseModel):
    sku: str
    nombre: str
    unidad: str
    unidades: int


class AlertaStock(BaseModel):
    sku: str
    nombre: str
    unidad: str
    stock_actual: int
    stock_minimo: int
    fecha_corte: date


class ResumenVentas(BaseModel):
    empresa: Empresa
    desde: date | None
    hasta: date | None
    primera_venta: date | None
    ultima_venta: date | None
    unidades: int
    registros: int
    productos_con_ventas: int
    productos_total: int
    productos_sin_stock: int
    datos_sinteticos: bool
    meses: list[MesVentas]
    mas_vendidos: list[ProductoVendido]
    bajo_minimo: list[AlertaStock]


def mes_siguiente(value: date) -> date:
    return date(value.year + (value.month == 12), 1 if value.month == 12 else value.month + 1, 1)


@app.get('/dashboard', response_model=ResumenVentas)
def dashboard(
    empresa_id: str = Query(min_length=1, max_length=40),
    desde: date | None = None,
    hasta: date | None = None,
):
    if (desde is None) != (hasta is None):
        raise HTTPException(status_code=422, detail='Indica desde y hasta juntos, o deja ambos vacios')
    if desde and hasta and (desde > hasta or (hasta - desde).days > 3660):
        raise HTTPException(status_code=422, detail='El periodo debe estar ordenado y no superar diez anos')
    try:
        with engine.connect() as conn:
            params = {'empresa_id': empresa_id}
            empresa = conn.execute(text('SELECT * FROM public.empresas WHERE empresa_id = :empresa_id'), params).mappings().first()
            if empresa is None:
                raise HTTPException(status_code=404, detail='La empresa no existe')
            limits = conn.execute(text('SELECT MIN(fecha) AS primera, MAX(fecha) AS ultima FROM public.ventas WHERE empresa_id = :empresa_id'), params).mappings().one()
            first = date.fromisoformat(str(limits['primera'])) if limits['primera'] else None
            last = date.fromisoformat(str(limits['ultima'])) if limits['ultima'] else None
            if desde is None and last:
                hasta = last
                # Doce meses calendario hasta el ultimo registro, no hasta la fecha de hoy.
                month_index = last.year * 12 + last.month - 1 - 11
                desde = date(month_index // 12, month_index % 12 + 1, 1)
            params.update(desde=desde, hasta=hasta)
            totals = conn.execute(text('''
                SELECT COALESCE(SUM(cantidad), 0) AS unidades, COUNT(*) AS registros,
                       COUNT(DISTINCT CASE WHEN cantidad > 0 THEN sku END) AS productos_con_ventas,
                       COUNT(CASE WHEN origen = 'SINTETICO' THEN 1 END) AS sinteticos
                FROM public.ventas
                WHERE empresa_id = :empresa_id AND fecha >= :desde AND fecha <= :hasta
            '''), params).mappings().one()
            monthly = conn.execute(text('''
                SELECT substr(CAST(fecha AS VARCHAR), 1, 7) AS mes,
                       SUM(cantidad) AS unidades, COUNT(*) AS registros
                FROM public.ventas
                WHERE empresa_id = :empresa_id AND fecha >= :desde AND fecha <= :hasta
                GROUP BY substr(CAST(fecha AS VARCHAR), 1, 7) ORDER BY mes
            '''), params).mappings().all()
            month_map = {r['mes']: dict(r) for r in monthly}
            months = []
            if desde and hasta:
                cursor = desde.replace(day=1)
                while cursor <= hasta:
                    label = cursor.strftime('%Y-%m')
                    months.append(month_map.get(label, {'mes': label, 'unidades': None, 'registros': 0}))
                    if cursor.year == 9999 and cursor.month == 12:
                        break
                    cursor = mes_siguiente(cursor)
            ranking = conn.execute(text('''
                SELECT v.sku, p.nombre, p.unidad, SUM(v.cantidad) AS unidades
                FROM public.ventas AS v JOIN public.productos AS p
                  ON p.empresa_id = v.empresa_id AND p.sku = v.sku
                WHERE v.empresa_id = :empresa_id AND v.fecha >= :desde AND v.fecha <= :hasta
                GROUP BY v.sku, p.nombre, p.unidad HAVING SUM(v.cantidad) > 0
                ORDER BY unidades DESC, v.sku LIMIT 5
            '''), params).mappings().all()
            stock = conn.execute(text('''
                SELECT p.sku, p.nombre, p.unidad, p.origen AS origen_producto,
                       i.stock_actual, i.stock_minimo, i.fecha_corte, i.origen AS origen_inventario
                FROM public.productos AS p LEFT JOIN public.inventario AS i
                  ON p.empresa_id = i.empresa_id AND p.sku = i.sku
                 AND i.fecha_corte = (SELECT MAX(h.fecha_corte) FROM public.inventario AS h
                                     WHERE h.empresa_id = p.empresa_id AND h.sku = p.sku)
                WHERE p.empresa_id = :empresa_id ORDER BY p.nombre, p.sku
            '''), params).mappings().all()
            alerts = [dict(r) for r in stock if r['stock_actual'] is not None and r['stock_actual'] < r['stock_minimo']]
            return {
                'empresa': dict(empresa), 'desde': desde, 'hasta': hasta,
                'primera_venta': first, 'ultima_venta': last,
                'unidades': totals['unidades'], 'registros': totals['registros'],
                'productos_con_ventas': totals['productos_con_ventas'],
                'productos_total': len(stock),
                'productos_sin_stock': sum(r['stock_actual'] is None for r in stock),
                'datos_sinteticos': empresa['origen'] == 'SINTETICO' or bool(totals['sinteticos']) or any(
                    r['origen_producto'] == 'SINTETICO' or r['origen_inventario'] == 'SINTETICO' for r in stock),
                'meses': months, 'mas_vendidos': [dict(r) for r in ranking], 'bajo_minimo': alerts,
            }
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo consultar el dashboard. Revisa PostgreSQL y las tablas.') from None


class SolicitudPronostico(BaseModel):
    empresa_id: str = Field(min_length=1, max_length=40)
    sku: str = Field(min_length=1, max_length=60)


ml_lock = Lock()


@app.post('/pronosticos')
def generar_pronostico(body: SolicitudPronostico):
    # Una operacion por proceso: la version local usa un unico worker Uvicorn.
    if not ml_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail='Hay un calculo en curso. Espera unos segundos y vuelve a generar el pronostico.')
    try:
        try:
            from ml import forecast
        except ImportError:
            raise HTTPException(status_code=503, detail='Faltan dependencias del motor predictivo. Instala requirements-ml.txt en el entorno del backend.') from None
        with engine.connect() as conn:
            params = body.model_dump()
            product = conn.execute(text('''
                SELECT p.empresa_id, p.sku, p.nombre, p.unidad, p.origen,
                       e.nombre AS empresa, e.origen AS origen_empresa
                FROM public.productos AS p JOIN public.empresas AS e ON e.empresa_id = p.empresa_id
                WHERE p.empresa_id = :empresa_id AND p.sku = :sku
            '''), params).mappings().first()
            if product is None:
                raise HTTPException(status_code=404, detail='El producto no existe en la empresa seleccionada')
            rows = conn.execute(text('''
                SELECT fecha, cantidad, origen FROM public.ventas
                WHERE empresa_id = :empresa_id AND sku = :sku
                ORDER BY fecha LIMIT 3661
            '''), params).mappings().all()
            product = dict(product)
            records = [dict(row) for row in rows]
        result = forecast(records)
        result['producto'] = product
        result['datos_sinteticos'] = product['origen'] == 'SINTETICO' or product['origen_empresa'] == 'SINTETICO' or any(r['origen'] == 'SINTETICO' for r in records)
        return historial.guardar(engine, result, records)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo leer el historico o guardar el pronostico. Revisa PostgreSQL y ejecuta 002_pronosticos.sql.') from None
    finally:
        ml_lock.release()


@app.get('/pronosticos/historial')
def listar_pronosticos(
    empresa_id: str = Query(min_length=1, max_length=40),
    sku: str = Query(min_length=1, max_length=60),
    limite: int = Query(default=20, ge=1, le=100),
):
    try:
        with engine.connect() as conn:
            exists = conn.execute(text('SELECT 1 FROM public.productos WHERE empresa_id=:empresa_id AND sku=:sku'),
                                  {'empresa_id': empresa_id, 'sku': sku}).first()
            if exists is None:
                raise HTTPException(status_code=404, detail='El producto no existe en la empresa seleccionada')
            return historial.listar(conn, empresa_id, sku, limite)
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo consultar el historial. Revisa PostgreSQL y ejecuta 002_pronosticos.sql.') from None


@app.get('/pronosticos/{ejecucion_id}')
def consultar_pronostico(
    ejecucion_id: UUID,
    empresa_id: str = Query(min_length=1, max_length=40),
    sku: str = Query(min_length=1, max_length=60),
):
    # Estos filtros no sustituyen la autenticación: versión exclusivamente local.
    try:
        with engine.connect() as conn:
            result = historial.consultar(conn, ejecucion_id, empresa_id, sku)
            if result is None:
                raise HTTPException(status_code=404, detail='No existe esa ejecucion para el producto seleccionado')
            return result
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo recuperar el pronostico guardado. Revisa PostgreSQL y las tablas.') from None


@app.get('/pronosticos/{ejecucion_id}/excel')
def exportar_pronostico(
    ejecucion_id: UUID,
    empresa_id: str = Query(min_length=1, max_length=40),
    sku: str = Query(min_length=1, max_length=60),
):
    from exportar import crear_excel
    from zipfile import BadZipFile
    result = consultar_pronostico(ejecucion_id, empresa_id, sku)
    try:
        content = crear_excel(result)
    except (OSError, BadZipFile):
        raise HTTPException(status_code=503, detail='No se pudo abrir la plantilla Excel. Copia plantilla_pronostico.xlsx en la carpeta backend.') from None
    except (KeyError, ValueError, TypeError, IndexError):
        raise HTTPException(status_code=409, detail='La ejecucion guardada no contiene los datos necesarios para este reporte.') from None
    return Response(content=content,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="NEXOSTOCK-pronostico-{ejecucion_id}.xlsx"',
                 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})


@app.get('/pronosticos/{ejecucion_id}/cobertura')
def consultar_cobertura(
    ejecucion_id: UUID,
    empresa_id: str = Query(min_length=1, max_length=40),
    sku: str = Query(min_length=1, max_length=60),
):
    from cobertura import analizar
    result = consultar_pronostico(ejecucion_id, empresa_id, sku)
    try:
        with engine.connect() as conn:
            inventory = conn.execute(text('''
                SELECT i.stock_actual, i.fecha_corte, i.origen,
                       p.plazo_entrega_dias, p.unidad, p.origen AS origen_producto
                FROM public.inventario AS i JOIN public.productos AS p
                  ON p.empresa_id = i.empresa_id AND p.sku = i.sku
                WHERE i.empresa_id = :empresa_id AND i.sku = :sku
                ORDER BY i.fecha_corte DESC LIMIT 1
            '''), {'empresa_id': empresa_id, 'sku': sku}).mappings().first()
            if inventory is None:
                raise HTTPException(status_code=409, detail='Este producto no tiene un corte de inventario registrado para analizar su cobertura.')
            inventory = dict(inventory)
        return analizar(result, inventory)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except (KeyError, TypeError, ArithmeticError):
        raise HTTPException(status_code=409, detail='Los datos guardados no permiten calcular la cobertura. Revisa el pronostico y el inventario.') from None
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo consultar el inventario para la cobertura. Revisa PostgreSQL y las tablas.') from None


# Ingesta CSV agregada; el acceso sigue limitado al entorno local.
import ingesta
from typing import Literal
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool


def empresa_existe(conn, company):
    if conn.execute(text('SELECT 1 FROM public.empresas WHERE empresa_id=:id'), {'id':company}).first() is None:
        raise HTTPException(status_code=404, detail='La empresa no existe')


@app.get('/ingesta/plantilla')
def plantilla_csv(tipo: Literal['ventas', 'inventario']):
    return Response(content='\ufeff' + ','.join(ingesta.SCHEMAS[tipo]) + '\r\n',
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="NEXOSTOCK-{tipo}-plantilla.csv"'})


@app.post('/ingesta/validar')
async def validar_csv(request: Request, tipo: Literal['ventas', 'inventario'],
    empresa_id: str = Query(min_length=1, max_length=40),
    archivo: str = Query(min_length=1, max_length=180)):
    if not archivo.lower().endswith('.csv') or any(ord(c)<32 for c in archivo):
        raise HTTPException(status_code=422, detail='Selecciona un archivo con extension .csv y nombre valido')
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > ingesta.MAX_BYTES:
            raise HTTPException(status_code=413, detail='El archivo supera el limite de 5 MiB')
        raw.extend(chunk)
    def work():
        try:
            with engine.begin() as conn:
                empresa_existe(conn, empresa_id)
                result = ingesta.validate(conn, bytes(raw), tipo, empresa_id, archivo)
            return result
        except SQLAlchemyError:
            raise HTTPException(status_code=503, detail='No se pudo validar el archivo contra la base de datos. Revisa PostgreSQL y ejecuta 003_importaciones.sql.') from None
    return await run_in_threadpool(work)


@app.post('/ingesta/{importacion_id}/confirmar')
def confirmar_csv(importacion_id: UUID, empresa_id: str = Query(min_length=1, max_length=40)):
    try:
        with engine.begin() as conn:
            # Serializa las confirmaciones de esta aplicación por empresa.
            if conn.dialect.name == 'postgresql':
                conn.execute(text('SELECT pg_advisory_xact_lock(hashtext(:id))'), {'id':empresa_id})
            result = ingesta.confirm(conn, importacion_id, empresa_id)
            if result is None:
                raise HTTPException(status_code=404, detail='La importacion no existe para esta empresa')
        return result
    except IntegrityError:
        raise HTTPException(status_code=409, detail='Los datos cambiaron durante la importacion. No se confirmo ninguna fila; vuelve a confirmar para revalidar.') from None
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo confirmar la importacion. Revisa PostgreSQL. La operacion no confirmada se revierte completa.') from None


@app.get('/ingesta/historial')
def historial_csv(empresa_id: str = Query(min_length=1, max_length=40)):
    try:
        with engine.connect() as conn:
            empresa_existe(conn, empresa_id)
            t = ingesta.audit
            rows = conn.execute(select(t.c.importacion_id,t.c.archivo,t.c.tipo,t.c.creado_en,t.c.estado,
                t.c.informe['filas'].as_integer().label('filas'),
                t.c.informe['nuevas'].as_integer().label('nuevas'),
                t.c.informe['errores_total'].as_integer().label('errores_total'))
                .where(t.c.empresa_id == empresa_id).order_by(t.c.creado_en.desc(),t.c.importacion_id.desc()).limit(20)).mappings().all()
            result = []
            from datetime import timezone
            for r in rows:
                item = dict(r)
                if item['creado_en'].tzinfo is None: item['creado_en'] = item['creado_en'].replace(tzinfo=timezone.utc)
                result.append(item)
            return result
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo consultar el historial. Revisa PostgreSQL y ejecuta 003_importaciones.sql.') from None


@app.get('/ingesta/{importacion_id}')
def detalle_csv(importacion_id: UUID, empresa_id: str = Query(min_length=1, max_length=40)):
    try:
        with engine.connect() as conn:
            t = ingesta.audit
            row = conn.execute(select(*[c for c in t.c if c.name != 'datos']).where(t.c.importacion_id==str(importacion_id),t.c.empresa_id==empresa_id)).mappings().first()
            if row is None: raise HTTPException(status_code=404, detail='La importacion no existe para esta empresa')
            return dict(row)
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='No se pudo consultar el detalle de la importacion.') from None
