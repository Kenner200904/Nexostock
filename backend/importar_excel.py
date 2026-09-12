"""Carga del Excel sintetico de NEXOSTOCK. No crea tablas ni sobrescribe registros.

Uso (desde backend):
  python importar_excel.py datos/NEXOSTOCK-datos-sinteticos.xlsx --validar
  python importar_excel.py datos/NEXOSTOCK-datos-sinteticos.xlsx

Dependencias: pandas, openpyxl y las dependencias de main.py.
Fuentes API: https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html
https://docs.sqlalchemy.org/en/20/dialects/postgresql.html
"""

import argparse
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
import sys

import pandas as pd


# Hoja, tabla, columnas, claves unicas (coinciden con 001_tablas_iniciales.sql).
SCHEMA = [
    ("Empresas", "empresas", ["empresa_id", "nombre", "sector", "ciudad", "moneda", "origen"],
     [("empresa_id",)]),
    ("Productos", "productos", ["empresa_id", "sku", "nombre", "categoria", "unidad", "precio_base", "plazo_entrega_dias", "origen"],
     [("empresa_id", "sku")]),
    ("Ventas", "ventas", ["registro_id", "empresa_id", "fecha", "sku", "cantidad", "precio_unit", "promocion", "evento_sintetico", "origen"],
     [("empresa_id", "registro_id"), ("empresa_id", "sku", "fecha")]),
    ("Inventario", "inventario", ["empresa_id", "sku", "fecha_corte", "stock_actual", "stock_minimo", "tipo_umbral", "origen"],
     [("empresa_id", "sku", "fecha_corte")]),
]
LENGTHS = {"empresa_id": 40, "sku": 60, "registro_id": 60, "sector": 80,
           "ciudad": 100, "categoria": 100, "unidad": 40, "tipo_umbral": 40,
           "evento_sintetico": 100, "origen": 12, "moneda": 3}
INT_MIN = {"cantidad": 0, "stock_actual": 0, "stock_minimo": 0,
           "plazo_entrega_dias": 1, "promocion": 0}


def normalize(value, col, sheet):
    if pd.isna(value):
        if col == "evento_sintetico":
            return None
        raise ValueError(f"{col}: valor obligatorio ausente")
    if col in ("fecha", "fecha_corte"):
        if isinstance(value, (datetime, pd.Timestamp)):
            if value.hour or value.minute or value.second or value.microsecond:
                raise ValueError(f"{col}: se espera una fecha sin hora")
            return value.date()
        if isinstance(value, date):
            return value
        try:
            return date.fromisoformat(str(value).strip())
        except ValueError:
            raise ValueError(f"{col}: usa una fecha Excel o yyyy-mm-dd") from None
    if col in INT_MIN or col in ("precio_base", "precio_unit"):
        try:
            number = Decimal(str(value))
        except InvalidOperation:
            raise ValueError(f"{col}: se espera un numero") from None
        if not number.is_finite():
            raise ValueError(f"{col}: numero no finito")
        if col in INT_MIN:
            if number != number.to_integral_value() or not INT_MIN[col] <= number <= 2147483647:
                raise ValueError(f"{col}: entero fuera de rango")
            if col == "promocion" and number not in (0, 1):
                raise ValueError("promocion: solo admite 0 o 1")
            return int(number)
        if not 0 < number <= Decimal('9999999999.99') or number != number.quantize(Decimal('0.01')):
            raise ValueError(f"{col}: precio positivo con maximo dos decimales")
        return number
    text = str(value).strip()
    limit = (150 if sheet == "Empresas" else 180) if col == "nombre" else LENGTHS[col]
    if not text or len(text) > limit:
        raise ValueError(f"{col}: texto vacio o supera {limit} caracteres")
    if col == "origen" and text != "SINTETICO":
        raise ValueError("Este importador de pruebas solo acepta origen SINTETICO")
    if col == "moneda" and text != "NIO":
        raise ValueError("Este conjunto de pruebas utiliza moneda NIO")
    return text


def read_data(path):
    if not path.is_file():
        raise ValueError(f"No se encontro el archivo: {path}")
    if path.suffix.lower() != ".xlsx":
        raise ValueError("Se requiere un archivo .xlsx")
    result = {}
    with pd.ExcelFile(path, engine="openpyxl") as book:
        for sheet, table, columns, keys in SCHEMA:
            if sheet not in book.sheet_names:
                raise ValueError(f"Falta la hoja {sheet}")
            df = pd.read_excel(book, sheet_name=sheet, dtype=object)
            if list(df.columns) != columns:
                raise ValueError(f"Columnas incorrectas en {sheet}. Esperadas: {', '.join(columns)}")
            if df.empty:
                raise ValueError(f"La hoja {sheet} esta vacia")
            records = []
            seen = [set() for _ in keys]
            for rownum, values in enumerate(df.itertuples(index=False, name=None), start=2):
                try:
                    row = {col: normalize(val, col, sheet) for col, val in zip(columns, values)}
                    for unique_key, index in zip(keys, seen):
                        key = tuple(row[col] for col in unique_key)
                        if key in index:
                            raise ValueError(f"Registro duplicado por {', '.join(unique_key)}")
                        index.add(key)
                    records.append(row)
                except ValueError as exc:
                    raise ValueError(f"{sheet}, fila {rownum}: {exc}") from None
            result[table] = records
    company_ids = {r['empresa_id'] for r in result['empresas']}
    product_ids = {(r['empresa_id'], r['sku']) for r in result['productos']}
    for table, rows in result.items():
        for row in rows:
            if row['empresa_id'] not in company_ids:
                raise ValueError(f"{table}: empresa ausente de la hoja Empresas")
            if table in ('ventas', 'inventario') and (row['empresa_id'], row['sku']) not in product_ids:
                raise ValueError(f"{table}: producto ausente del catalogo de su empresa")
    return result


def save_data(data):
    # Reutiliza la conexion y el .env del backend que ya funciona.
    from main import engine
    from sqlalchemy import MetaData, Table, select
    from sqlalchemy.dialects.postgresql import insert

    stats = []
    try:
        with engine.begin() as conn:
            metadata = MetaData()
            companies = [r['empresa_id'] for r in data['empresas']]
            for _, name, columns, keys in SCHEMA:
                table = Table(name, metadata, schema="public", autoload_with=conn)
                existing = conn.execute(select(table).where(table.c.empresa_id.in_(companies))).mappings().all()
                indexes = [{tuple(row[c] for c in key): row for row in existing} for key in keys]
                for row in data[name]:
                    for key, index in zip(keys, indexes):
                        old = index.get(tuple(row[c] for c in key))
                        if old is not None and any(old[c] != row[c] for c in columns):
                            raise ValueError(f"{name}: un registro existente tiene valores diferentes. No se sobrescribio nada.")
                inserted = 0
                for offset in range(0, len(data[name]), 500):
                    stmt = insert(table).values(data[name][offset:offset + 500]).on_conflict_do_nothing().returning(table.c.empresa_id)
                    inserted += len(conn.execute(stmt).all())
                stats.append((name, inserted, len(data[name]) - inserted))
        # Solo se anuncia exito cuando la transaccion completa se confirmo.
        print("\nImportacion confirmada:")
        for name, inserted, skipped in stats:
            print(f"  {name}: {inserted} nuevos; {skipped} ya existentes")
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Importar los datos sinteticos de NEXOSTOCK")
    parser.add_argument("archivo", type=Path)
    parser.add_argument("--validar", action="store_true", help="Validar Excel sin conectar ni escribir en PostgreSQL")
    args = parser.parse_args()
    try:
        data = read_data(args.archivo)
        print("Excel validado:")
        for table, rows in data.items():
            print(f"  {table}: {len(rows)} registros")
        if args.validar:
            print("No se escribio en la base de datos.")
        else:
            save_data(data)
        return 0
    except (ValueError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
    except Exception as exc:
        # No imprimir detalles SQL que puedan incluir datos o credenciales.
        print(f"ERROR ({type(exc).__name__}): revisa las dependencias, las tablas y la conexion de main.py. No se confirmo la importacion.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
