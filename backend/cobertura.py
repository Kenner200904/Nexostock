"""Simulación diaria sin reposiciones, a partir de cantidades esperadas."""
from datetime import date, timedelta, datetime, timezone
from decimal import Decimal


def analizar(result, inventory):
    cutoff = date.fromisoformat(str(inventory['fecha_corte']))
    last = date.fromisoformat(result['historico_hasta'])
    if cutoff != last:
        raise ValueError(f'El inventario tiene corte {cutoff} y el pronostico parte del cierre {last}. Se requiere un pronostico cuyo cierre coincida con el ultimo corte de inventario; no cambies fechas sin registros que lo respalden.')
    if inventory['unidad'] != result['producto']['unidad']:
        raise ValueError('La unidad del catalogo cambio desde la ejecucion. Revisa las unidades antes de combinar inventario y pronostico.')
    stock = Decimal(str(inventory['stock_actual']))
    lead = int(inventory['plazo_entrega_dias'])
    points = result['pronostico']
    if not stock.is_finite() or stock < 0 or lead < 1:
        raise ValueError('El stock y el plazo de entrega deben ser validos.')
    if not points or len(points) != result['horizonte_dias'] or len(points) > 366:
        raise ValueError('El horizonte del pronostico no es valido.')
    accumulated = Decimal(0)
    timeline = []
    first_shortage = None
    first_index = None
    demand_lead = None
    for i, point in enumerate(points, 1):
        day = date.fromisoformat(point['fecha'])
        amount = Decimal(str(point['cantidad']))
        if day != cutoff + timedelta(days=i) or not amount.is_finite() or amount < 0:
            raise ValueError('El pronostico debe tener fechas diarias consecutivas y cantidades no negativas.')
        accumulated += amount
        if accumulated > stock and first_shortage is None:
            first_shortage = day.isoformat(); first_index = i
        if i == lead:
            demand_lead = float(accumulated)
        timeline.append({
            'fecha': day.isoformat(), 'cantidad_estimada': float(amount),
            'demanda_acumulada': float(accumulated),
            'stock_restante': float(max(Decimal(0), stock - accumulated)),
            'faltante_acumulado': float(max(Decimal(0), accumulated - stock)),
        })
    lead_risk = True if first_index is not None and first_index <= lead else (False if lead <= len(points) else None)
    status = 'faltante_en_plazo' if lead_risk is True else ('faltante_en_horizonte' if first_shortage else 'cubre_horizonte')
    return {
        'ejecucion_id': result['ejecucion_id'],
        'consultado_en': datetime.now(timezone.utc).isoformat(),
        'empresa_id': result['producto']['empresa_id'], 'sku': result['producto']['sku'],
        'unidad': inventory['unidad'], 'fecha_corte': cutoff.isoformat(),
        'desde': points[0]['fecha'], 'hasta': points[-1]['fecha'], 'horizonte_dias': len(points),
        'stock_inicial': float(stock), 'plazo_entrega_dias': lead,
        'demanda_en_plazo': demand_lead, 'riesgo_en_plazo': lead_risk,
        'estado': status, 'primer_faltante': first_shortage,
        'dias_completos_cubiertos': first_index - 1 if first_index else len(points),
        'demanda_total': float(accumulated),
        'stock_final': timeline[-1]['stock_restante'],
        'faltante_total': timeline[-1]['faltante_acumulado'],
        'datos_sinteticos': result['datos_sinteticos'] or inventory['origen'] == 'SINTETICO' or inventory['origen_producto'] == 'SINTETICO',
        'serie': timeline,
        'supuestos': [
            'El stock del corte se interpreta como existencia al cierre de ese dia. No se incluyen reposiciones, reservas, mermas ni ajustes futuros.',
            'Se consumen las cantidades esperadas de cada dia en orden cronologico. El primer faltante ocurre cuando su suma supera el stock inicial; la igualdad cubre ese dia.',
            'Para comparar el plazo se supone una entrega al finalizar ese numero de dias calendario desde el corte. No se consulta una orden ni una fecha real de llegada.',
            'Esta simulacion no incluye incertidumbre ni stock de seguridad. El faltante estimado no es una cantidad recomendada de compra.',
            'La consulta combina una ejecucion guardada con el ultimo corte de inventario y el plazo de catalogo disponibles. No guarda la simulacion ni modifica existencias u ordenes.',
        ],
    }
