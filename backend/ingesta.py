"""CSV de ventas diarias/inventario para empresas y productos ya registrados.

Valida primero; inserta filas nuevas y auditoría en una sola transacción.
No limpia, imputa ni sobrescribe datos transaccionales.
"""
import csv
from datetime import date, datetime, timezone, timedelta
from calendar import monthrange
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from io import StringIO
import re
from uuid import uuid4

import pandas as pd
from sqlalchemy import Column, DateTime, JSON, MetaData, String, Table, select, text
from sqlalchemy.dialects.postgresql import JSONB

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 100000
SCHEMAS = {
    'ventas': ['registro_id', 'empresa_id', 'fecha', 'sku', 'cantidad', 'precio_unit', 'promocion', 'evento_sintetico', 'origen'],
    'inventario': ['empresa_id', 'sku', 'fecha_corte', 'stock_actual', 'stock_minimo', 'tipo_umbral', 'origen'],
}
KEYS = {
    'ventas': [('empresa_id', 'registro_id'), ('empresa_id', 'sku', 'fecha')],
    'inventario': [('empresa_id', 'sku', 'fecha_corte')],
}
LIMITS = {'registro_id': 60, 'empresa_id': 40, 'sku': 60, 'evento_sintetico': 100, 'tipo_umbral': 40, 'origen': 12}
audit = Table('importaciones', MetaData(),
    Column('importacion_id', String(36), primary_key=True), Column('empresa_id', String(40)),
    Column('tipo', String(12)), Column('archivo', String(180)), Column('sha256', String(64)),
    Column('creado_en', DateTime(timezone=True)), Column('estado', String(12)),
    Column('informe', JSON().with_variant(JSONB(), 'postgresql')),
    Column('datos', JSON().with_variant(JSONB(), 'postgresql')), schema='public')


def normalize(column, value):
    value = str(value).strip()
    if column == 'evento_sintetico' and not value:
        return None
    if not value or any(ord(c) < 32 for c in value):
        raise ValueError(f'{column}: valor obligatorio vacio o caracteres de control')
    if column in ('fecha', 'fecha_corte'):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError(f'{column}: usa YYYY-MM-DD')
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            raise ValueError(f'{column}: la fecha no existe en el calendario') from None
    if column in ('cantidad', 'stock_actual', 'stock_minimo', 'promocion'):
        if not re.fullmatch(r'\d{1,10}', value) or int(value) > 2147483647:
            raise ValueError(f'{column}: se requiere entero no negativo de hasta 2147483647')
        number = int(value)
        if column == 'promocion' and number not in (0, 1):
            raise ValueError('promocion: solo admite 0 o 1')
        return number
    if column == 'precio_unit':
        if not re.fullmatch(r'\d{1,10}(\.\d{1,2})?', value) or Decimal(value) <= 0:
            raise ValueError('precio_unit: precio positivo, punto decimal y maximo dos decimales')
        return format(Decimal(value), '.2f')
    if len(value) > LIMITS[column]:
        raise ValueError(f'{column}: supera {LIMITS[column]} caracteres')
    if column == 'origen' and value not in ('SINTETICO', 'REAL'):
        raise ValueError('origen: usa SINTETICO o REAL')
    return value


def error(report, line, message):
    report['errores_total'] += 1
    if len(report['errores']) < 100:
        report['errores'].append({'fila': line, 'mensaje': message})


def parse_csv(raw, kind, company):
    report = {'filas': 0, 'nuevas': 0, 'existentes': 0, 'errores_total': 0, 'errores': [], 'muestra': [], 'series': [], 'advertencias': []}
    rows = []
    try:
        content = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        error(report, 1, 'El archivo debe estar codificado como UTF-8.'); return rows, report
    first = content.splitlines()[0] if content else ''
    if len(first) > 4096:
        error(report, 1, 'Encabezado demasiado largo. Utiliza la plantilla CSV.'); return rows, report
    # Detectar delimitador por los encabezados exactos, no por el contenido libre.
    delimiter = next((d for d in (',', ';') if sorted(next(csv.reader([first], delimiter=d), [])) == sorted(SCHEMAS[kind])), None)
    if delimiter is None:
        error(report, 1, 'Encabezados incorrectos. Esperados: ' + ', '.join(SCHEMAS[kind])); return rows, report
    reader = csv.reader(StringIO(content, newline=''), delimiter=delimiter, strict=True)
    header = next(reader)
    seen = [set() for _ in KEYS[kind]]
    try:
        for values in reader:
            line = reader.line_num
            if not values:
                continue
            report['filas'] += 1
            if report['filas'] > MAX_ROWS:
                error(report, line, f'El archivo supera {MAX_ROWS} filas.'); break
            try:
                if len(values) != len(header):
                    raise ValueError('El numero de campos no coincide con los encabezados')
                row = {c: normalize(c, v) for c, v in zip(header, values)}
                if row['empresa_id'] != company:
                    raise ValueError('La empresa de la fila no coincide con la seleccionada')
                row_keys = [tuple(row[c] for c in cols) for cols in KEYS[kind]]
                if any(k in index for k, index in zip(row_keys, seen)):
                    raise ValueError('Clave duplicada dentro del CSV; conserva una fila por registro y producto/fecha')
                for k, index in zip(row_keys, seen): index.add(k)
                rows.append({'fila': line, 'valores': row})
            except (ValueError, InvalidOperation) as exc:
                error(report, line, str(exc))
    except csv.Error:
        error(report, reader.line_num, 'Sintaxis CSV invalida: revisa comillas y delimitadores.')
    if not report['filas']:
        error(report, 2, 'El archivo no contiene registros.')
    report['muestra'] = [r['valores'] for r in rows[:10]]
    return rows, report


def canonical(row, kind):
    result = dict(row)
    for col in SCHEMAS[kind]:
        if col in ('fecha', 'fecha_corte'): result[col] = str(result[col])
        if col == 'precio_unit': result[col] = format(Decimal(str(result[col])), '.2f')
    return {c: result[c] for c in SCHEMAS[kind]}


def check_database(conn, rows, report, kind, company):
    table = Table(kind, MetaData(), schema='public', autoload_with=conn)
    products = set(conn.execute(text('SELECT sku FROM public.productos WHERE empresa_id=:id'), {'id': company}).scalars())
    existing = [canonical(r, kind) for r in conn.execute(select(table).where(table.c.empresa_id == company)).mappings()]
    indexes = [{tuple(r[c] for c in cols): r for r in existing} for cols in KEYS[kind]]
    new_rows = []
    for item in rows:
        row = item['valores']; old_rows = [index.get(tuple(row[c] for c in cols)) for cols, index in zip(KEYS[kind], indexes)]
        if row['sku'] not in products:
            error(report, item['fila'], f"SKU no registrado en esta empresa: {row['sku']}")
        elif any(old is not None and old != row for old in old_rows):
            error(report, item['fila'], 'Conflicto con un registro existente: sus valores son diferentes. No se sobrescribe.')
        elif any(old is not None for old in old_rows):
            report['existentes'] += 1
        else:
            new_rows.append(row)
    report['nuevas'] = len(new_rows)
    if kind == 'ventas' and report['errores_total'] == 0:
        skus = {r['valores']['sku'] for r in rows}
        all_rows = [r for r in existing if r['sku'] in skus] + new_rows
        if all_rows:
            df = pd.DataFrame(all_rows)
            for sku, group in df.groupby('sku', sort=True):
                days = sorted({date.fromisoformat(v) for v in group['fecha']})
                first, last = days[0], days[-1]
                missing = (last-first).days + 1 - len(days)
                enough = first.year <= 9997 and last >= date(first.year + 2, first.month, min(first.day, monthrange(first.year + 2, first.month)[1])) - timedelta(days=1)
                report['series'].append({'sku': str(sku), 'desde': str(first), 'hasta': str(last), 'dias_observados': len(days), 'dias_faltantes': missing, 'listo_24_meses': bool(enough and missing == 0)})
            if any(not r['listo_24_meses'] for r in report['series']):
                report['advertencias'].append('Algunos productos aun no tienen 24 meses diarios consecutivos. Se permite importar por partes; el motor no podra entrenarlos hasta completar su historico.')
    if any(r['valores']['origen'] == 'SINTETICO' for r in rows):
        report['advertencias'].append('El archivo incluye datos sinteticos destinados a pruebas.')
    return table, new_rows


def validate(conn, raw, kind, company, filename):
    rows, report = parse_csv(raw, kind, company)
    check_database(conn, rows, report, kind, company)
    state = 'RECHAZADA' if report['errores_total'] else 'VALIDADA'
    record = {'importacion_id': str(uuid4()), 'empresa_id': company, 'tipo': kind,
              'archivo': filename, 'sha256': sha256(raw).hexdigest(),
              'creado_en': datetime.now(timezone.utc), 'estado': state, 'informe': report,
              'datos': rows if state == 'VALIDADA' else None}
    conn.execute(audit.insert().values(**record))
    return {k: v for k, v in record.items() if k != 'datos'}


def confirm(conn, id, company):
    record = conn.execute(select(audit).where(audit.c.importacion_id == str(id), audit.c.empresa_id == company).with_for_update()).mappings().first()
    if record is None: return None
    if record['estado'] != 'VALIDADA': return {k:v for k,v in record.items() if k != 'datos'}
    report = dict(record['informe'])
    report.update(nuevas=0, existentes=0, errores_total=0, errores=[], series=[], advertencias=[])
    table, fresh = check_database(conn, record['datos'], report, record['tipo'], company)
    state = 'RECHAZADA' if report['errores_total'] else 'CONFIRMADA'
    if state == 'CONFIRMADA':
        converted = []
        for row in fresh:
            row = dict(row)
            for col in ('fecha', 'fecha_corte'):
                if col in row: row[col] = date.fromisoformat(row[col])
            if 'precio_unit' in row: row['precio_unit'] = Decimal(row['precio_unit'])
            converted.append(row)
        for offset in range(0, len(converted), 500):
            conn.execute(table.insert(), converted[offset:offset+500])
        report['confirmado_en'] = datetime.now(timezone.utc).isoformat()
    conn.execute(audit.update().where(audit.c.importacion_id == str(id)).values(estado=state, informe=report, datos=None))
    return {**{k:v for k,v in record.items() if k != 'datos'}, 'estado':state, 'informe':report}
