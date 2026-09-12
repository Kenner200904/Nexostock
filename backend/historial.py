"""Almacenamiento de resultados; no guarda ni deserializa modelos ejecutables."""
from datetime import datetime, timezone
from hashlib import sha256
from importlib.metadata import version
import json
from pathlib import Path
from uuid import uuid4

from sqlalchemy import Column, DateTime, JSON, MetaData, String, Table, select
from sqlalchemy.dialects.postgresql import JSONB

ejecuciones = Table(
    'pronosticos_ejecuciones', MetaData(),
    Column('ejecucion_id', String(36), primary_key=True),
    Column('empresa_id', String(40), nullable=False),
    Column('sku', String(60), nullable=False),
    Column('creado_en', DateTime(timezone=True), nullable=False),
    Column('resultado', JSON().with_variant(JSONB(), 'postgresql'), nullable=False),
    schema='public',
)


def guardar(engine, result, records):
    result = dict(result)
    result.update(ejecucion_id=str(uuid4()), creado_en=datetime.now(timezone.utc).isoformat())
    # Hash del conjunto ordenado que efectivamente recibió el motor.
    source = [{'fecha': str(r['fecha']), 'cantidad': int(r['cantidad']), 'origen': r['origen']} for r in records]
    result['trazabilidad'] = {
        'version_motor': '1.0.0',
        'codigo_ml_sha256': sha256(Path(__file__).with_name('ml.py').read_bytes()).hexdigest(),
        'datos_sha256': sha256(json.dumps(source, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
        'dependencias': {name: version(name) for name in ('numpy', 'pandas', 'scikit-learn')},
    }
    with engine.begin() as conn:
        conn.execute(ejecuciones.insert().values(
            ejecucion_id=result['ejecucion_id'], empresa_id=result['producto']['empresa_id'],
            sku=result['producto']['sku'], creado_en=datetime.fromisoformat(result['creado_en']),
            resultado=result,
        ))
    # Solo devolver éxito una vez confirmado el commit.
    return result


def listar(conn, empresa_id, sku, limite):
    # Proyección JSON: evita transferir todas las series para mostrar el listado.
    result = ejecuciones.c.resultado
    query = select(
        ejecuciones.c.ejecucion_id, ejecuciones.c.creado_en,
        result['nombre_modelo'].as_string().label('nombre_modelo'),
        result['historico_hasta'].as_string().label('historico_hasta'),
        result['total_estimado'].as_float().label('total_estimado'),
    ).where(ejecuciones.c.empresa_id == empresa_id, ejecuciones.c.sku == sku).order_by(
        ejecuciones.c.creado_en.desc(), ejecuciones.c.ejecucion_id.desc()).limit(limite)
    rows = []
    for row in conn.execute(query).mappings():
        item = dict(row)
        # SQLite de pruebas devuelve datetime sin zona; los registros se crean en UTC.
        if item['creado_en'].tzinfo is None:
            item['creado_en'] = item['creado_en'].replace(tzinfo=timezone.utc)
        rows.append(item)
    return rows


def consultar(conn, ejecucion_id, empresa_id, sku):
    return conn.execute(select(ejecuciones.c.resultado).where(
        ejecuciones.c.ejecucion_id == str(ejecucion_id),
        ejecuciones.c.empresa_id == empresa_id, ejecuciones.c.sku == sku,
    )).scalar_one_or_none()
