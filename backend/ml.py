"""Pronosticos diarios por producto. Sin escritura en PostgreSQL.

Validacion temporal expansiva: primer 80% inicial; ultimo 20% en bloques
no solapados de hasta 30 dias. Cada bloque se predice de forma recursiva,
sin utilizar ventas observadas dentro del propio bloque.
"""
from datetime import timedelta
import math

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import MinMaxScaler

MAX_DAYS = 3660
LAG = 28
HORIZON = 30
MODELS = ['ingenuo', 'regresion_lineal', 'random_forest']
LABELS = {'ingenuo': 'Ultimo valor observado', 'regresion_lineal': 'Regresion lineal multiple', 'random_forest': 'Random Forest'}


def prepare(rows):
    if not rows:
        raise ValueError('El producto no tiene registros de ventas')
    if len(rows) > MAX_DAYS:
        raise ValueError('Esta version admite hasta 3660 registros diarios por producto')
    frame = pd.DataFrame(rows)
    frame['fecha'] = pd.to_datetime(frame['fecha'], errors='raise')
    frame = frame.sort_values('fecha').reset_index(drop=True)
    if frame['fecha'].duplicated().any():
        raise ValueError('Hay fechas duplicadas para el producto')
    if frame['fecha'].isna().any() or not frame['fecha'].eq(frame['fecha'].dt.normalize()).all():
        raise ValueError('Las fechas deben ser dias completos sin valores nulos')
    y = pd.to_numeric(frame['cantidad'], errors='raise').to_numpy(dtype=float)
    if not np.isfinite(y).all() or (y < 0).any() or not np.equal(y, np.floor(y)).all():
        raise ValueError('Las cantidades deben ser enteros no negativos y no nulos')
    first, last = frame['fecha'].iloc[0], frame['fecha'].iloc[-1]
    # Comprobar extension antes de crear un calendario potencialmente grande.
    if (last - first).days + 1 > MAX_DAYS:
        raise ValueError('El historico supera el limite de diez anos de esta version')
    expected = pd.date_range(first, last, freq='D')
    missing = expected.difference(frame['fecha'])
    if len(missing):
        raise ValueError(f'Faltan {len(missing)} dias en el historico. No se asumen como cero ventas. Revisa los datos antes de entrenar.')
    if last < first + pd.DateOffset(months=24) - pd.Timedelta(days=1):
        raise ValueError('Se requieren al menos 24 meses consecutivos de registros diarios por producto, como plantea el protocolo')
    return frame['fecha'].dt.date.tolist(), y


def features(history, target_date, index):
    """Solo historial anterior a target_date y calendario conocido de antemano."""
    return [history[-1], history[-7], history[-14], history[-28],
            float(np.mean(history[-7:])), float(np.mean(history[-28:])),
            float(np.std(history[-7:])), float(np.std(history[-28:])),
            math.sin(2 * math.pi * target_date.weekday() / 7),
            math.cos(2 * math.pi * target_date.weekday() / 7),
            math.sin(2 * math.pi * (target_date.month - 1) / 12),
            math.cos(2 * math.pi * (target_date.month - 1) / 12), index / 365.25]


def fit_model(key, dates, values):
    if key == 'ingenuo':
        return None
    x = np.asarray([features(values[:i], dates[i], i) for i in range(LAG, len(values))])
    target = values[LAG:]
    if key == 'regresion_lineal':
        model = make_pipeline(MinMaxScaler(), LinearRegression())
    else:
        model = RandomForestRegressor(n_estimators=64, max_depth=10, min_samples_leaf=3,
                                      random_state=42, n_jobs=1)
    model.fit(x, target)
    return model


def predict_block(key, model, history, start, count):
    past = list(map(float, history))
    result = []
    for step in range(count):
        when = start + timedelta(days=step)
        value = past[-1] if key == 'ingenuo' else float(model.predict([features(past, when, len(past))])[0])
        if not math.isfinite(value):
            raise ValueError('Un modelo produjo valores no finitos. Revisa la escala y la calidad del historico.')
        value = max(0.0, value)
        result.append(value)
        past.append(value)
    return result


def forecast(rows):
    dates, values = prepare(rows)
    split = int(len(values) * .8)
    predictions = {key: [] for key in MODELS}
    folds = []
    for origin in range(split, len(values), HORIZON):
        count = min(HORIZON, len(values) - origin)
        folds.append({'entrenamiento_hasta': dates[origin - 1].isoformat(),
                      'evaluacion_desde': dates[origin].isoformat(),
                      'evaluacion_hasta': dates[origin + count - 1].isoformat(), 'dias': count})
        for key in MODELS:
            model = fit_model(key, dates[:origin], values[:origin])
            predictions[key].extend(predict_block(key, model, values[:origin], dates[origin], count))
    truth = values[split:]
    metrics = []
    for key in MODELS:
        pred = predictions[key]
        mae = float(mean_absolute_error(truth, pred))
        rmse = math.sqrt(float(mean_squared_error(truth, pred)))
        r2 = None if np.all(truth == truth[0]) else float(r2_score(truth, pred))
        if not math.isfinite(mae) or not math.isfinite(rmse) or (r2 is not None and not math.isfinite(r2)):
            raise ValueError('No se pudieron calcular metricas finitas para el historico')
        metrics.append({'modelo': key, 'nombre': LABELS[key], 'mae': mae, 'rmse': rmse, 'r2': r2})
    # Empates: primero el modelo mas sencillo. La referencia puede ganar.
    best = min(metrics, key=lambda m: m['mae'])['modelo']
    naive_mae = metrics[0]['mae']
    best_mae = next(m['mae'] for m in metrics if m['modelo'] == best)
    improvement = None if naive_mae == 0 else (naive_mae - best_mae) / naive_mae * 100
    final_model = fit_model(best, dates, values)
    start = dates[-1] + timedelta(days=1)
    future = predict_block(best, final_model, values, start, HORIZON)
    points = [{'fecha': (start + timedelta(days=i)).isoformat(), 'cantidad': round(value, 6)} for i, value in enumerate(future)]
    return {
        'modelo_elegido': best, 'nombre_modelo': LABELS[best],
        'metricas': metrics, 'mejora_mae_vs_ingenuo_pct': improvement,
        'historico_desde': dates[0].isoformat(), 'historico_hasta': dates[-1].isoformat(),
        'dias_historico': len(values), 'dias_entrenamiento_inicial': split,
        'dias_evaluacion': len(truth), 'evaluacion_desde': dates[split].isoformat(),
        'evaluacion_hasta': dates[-1].isoformat(), 'bloques_evaluacion': folds,
        'horizonte_dias': HORIZON, 'pronostico': points,
        'total_estimado': round(sum(p['cantidad'] for p in points), 6),
        'historico_reciente': [{'fecha': d.isoformat(), 'cantidad': int(v)} for d, v in zip(dates[-30:], values[-30:])],
        'evaluacion': [{'fecha': d.isoformat(), 'real': int(v), **{key: round(predictions[key][i], 6) for key in MODELS}}
                       for i, (d, v) in enumerate(zip(dates[split:], truth))],
        'metodo': '80% inicial; evaluacion temporal expansiva sobre el 20% final, con bloques recursivos de hasta 30 dias. Reentrenamiento final con todo el historico.',
        'advertencias': [
            'La seleccion usa el MAE de esta validacion; no constituye una prueba final independiente del modelo elegido.',
            'Las ventas observadas aproximan demanda; no se corrigen ventas perdidas por falta de existencias.',
            'Esta version usa rezagos y calendario. No incorpora promociones futuras, feriados ni eventos configurados.',
            'No se calculan intervalos del 95% ni se modifican minimos, ordenes o existencias.',
        ],
    }
