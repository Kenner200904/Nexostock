"""Rellena la plantilla XLSX distribuida con los resultados de una ejecución.

Solo usa la biblioteca estándar de Python. Los textos se escriben como
inlineStr de OpenXML; nunca se interpretan como fórmulas ni enlaces.
"""
from copy import deepcopy
from datetime import date
from io import BytesIO
import math
from pathlib import Path
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('x', NS)
TEMPLATE = Path(__file__).with_name('plantilla_pronostico.xlsx')


def tag(name):
    return f'{{{NS}}}{name}'


def texto(value):
    # XML 1.0 no admite estos controles, aunque un catálogo pueda contenerlos.
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]', '', str(value))[:32767]


def escribir(cell, value, date_style, number_style):
    for child in list(cell):
        cell.remove(child)
    cell.attrib.pop('t', None)
    if value is None:
        return
    if isinstance(value, date):
        cell.set('s', date_style)
        ET.SubElement(cell, tag('v')).text = str((value - date(1899, 12, 30)).days)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value):
            raise ValueError('Resultado numérico no finito')
        cell.set('s', number_style)
        ET.SubElement(cell, tag('v')).text = str(value)
    else:
        cell.set('t', 'inlineStr')
        child = ET.SubElement(ET.SubElement(cell, tag('is')), tag('t'))
        child.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        child.text = texto(value)


def datos_hojas(result):
    p = result['producto']
    future = result['pronostico']
    if len(future) != result['horizonte_dias'] or not future:
        raise ValueError('Horizonte inconsistente')
    trace = result.get('trazabilidad', {})
    origin = 'SINTÉTICO · Solo para pruebas; no valida hipótesis de investigación.' if result['datos_sinteticos'] else 'No marcado como sintético en la ejecución; verificar procedencia.'
    summary = [
        ['Ejecución', result['ejecucion_id']], ['Fecha de ejecución (UTC)', result['creado_en']],
        ['Empresa', p['empresa']], ['ID de empresa', p['empresa_id']],
        ['Producto', p['nombre']], ['SKU', p['sku']], ['Unidad de catálogo', p['unidad']],
        ['Origen de los datos', origin], ['Modelo elegido', result['nombre_modelo']],
        ['Histórico desde', date.fromisoformat(result['historico_desde'])],
        ['Histórico hasta', date.fromisoformat(result['historico_hasta'])],
        ['Días de histórico', result['dias_historico']],
        ['Días de entrenamiento inicial', result['dias_entrenamiento_inicial']],
        ['Días de evaluación', result['dias_evaluacion']],
        ['Días de pronóstico', result['horizonte_dias']],
        ['Pronóstico desde', date.fromisoformat(future[0]['fecha'])],
        ['Pronóstico hasta', date.fromisoformat(future[-1]['fecha'])],
        ['Total estimado guardado', result['total_estimado']],
        ['Reducción de MAE (%)', result['mejora_mae_vs_ingenuo_pct']],
        ['Lectura de porcentajes', 'La reducción se expresa como porcentaje numérico: 25 significa 25 %. Vacío: no aplica porque el MAE ingenuo es cero.'],
        ['Fuente del reporte', 'Resultado guardado en PostgreSQL. Exportar no recalcula ni modifica la ejecución.'],
    ]
    rows = {
        'Resumen': summary,
        'Pronostico': [[date.fromisoformat(v['fecha']), v['cantidad']] for v in future],
        'Metricas': [[m['nombre'], m['mae'], m['rmse'], m['r2'], 'Elegido' if m['modelo'] == result['modelo_elegido'] else ''] for m in result['metricas']],
        'Validacion': [[date.fromisoformat(v['fecha']), v['real'], v['ingenuo'], v['regresion_lineal'], v['random_forest']] for v in result['evaluacion']],
        'Historico': [[date.fromisoformat(v['fecha']), v['cantidad']] for v in result['historico_reciente']],
        'Bloques': [[date.fromisoformat(b['entrenamiento_hasta']), date.fromisoformat(b['evaluacion_desde']), date.fromisoformat(b['evaluacion_hasta']), b['dias']] for b in result['bloques_evaluacion']],
        'Trazabilidad': [
            ['Ejecución', result['ejecucion_id']], ['Versión del reporte', '1.0.0'],
            ['Versión del motor', trace.get('version_motor', 'No registrada')],
            ['SHA-256 de datos', trace.get('datos_sha256', 'No registrado')],
            ['SHA-256 de ml.py', trace.get('codigo_ml_sha256', 'No registrado')],
            *[[f'Versión {name}', value] for name, value in sorted(trace.get('dependencias', {}).items())],
            ['Método de evaluación', result['metodo']],
            *[[f'Advertencia {i}', value] for i, value in enumerate(result['advertencias'], 1)],
            ['Precisión', 'Métricas originales del motor; las predicciones diarias están guardadas con seis decimales. Recalcular métricas con esas series puede producir diferencias de redondeo.'],
            ['Reproducibilidad', 'Las huellas identifican los datos y el código utilizados. El reporte no contiene todo el histórico de entrenamiento ni el modelo entrenado; conserva sus fuentes y dependencias.'],
            ['Uso', 'El Excel es una copia editable. Los cambios en el archivo no se envían a NEXOSTOCK.'],
        ],
    }
    return rows, origin


def crear_excel(result):
    rows_by_sheet, origin = datos_hojas(result)
    with ZipFile(TEMPLATE) as template:
        parts = {name: template.read(name) for name in template.namelist()}
    root = ET.fromstring(parts['xl/worksheets/sheet2.xml'])
    date_style = root.find(f'.//{tag("c")}[@r="A5"]').get('s')
    number_style = root.find(f'.//{tag("c")}[@r="B5"]').get('s')
    integer_style = ET.fromstring(parts['xl/worksheets/sheet6.xml']).find(f'.//{tag("c")}[@r="D5"]').get('s')
    for index, (name, values) in enumerate(rows_by_sheet.items(), 1):
        path = f'xl/worksheets/sheet{index}.xml'
        sheet = ET.fromstring(parts[path])
        body = sheet.find(tag('sheetData'))
        prototype = body.find(f'{tag("row")}[@r="5"]')
        body.remove(prototype)
        banner = f'{origin} Unidad: {result["producto"]["unidad"]}.'
        if name == 'Metricas':
            banner += ' MAE/RMSE: menor es mejor. R² vacío: no definido.'
        if name == 'Historico':
            banner += ' Últimos 30 días observados, no todo el histórico.'
        cell = body.find(f'{tag("row")}[@r="2"]/{tag("c")}[@r="A2"]')
        escribir(cell, banner, date_style, number_style)
        body.find(f'{tag("row")}[@r="2"]').set('ht', '64')
        widths = [float(c.get('width')) for c in sheet.find(tag('cols'))]
        for row_number, values_row in enumerate(values, 5):
            row = deepcopy(prototype); row.set('r', str(row_number))
            lines = max(sum(max(1, math.ceil(len(line) / max(10, width - 5))) for line in str(v).split('\n')) for v, width in zip(values_row, widths))
            row.set('ht', str(min(409, max(28, lines * 17 + 8))))
            for col_index, (cell, value) in enumerate(zip(row, values_row)):
                cell.set('r', f'{chr(65 + col_index)}{row_number}')
                escribir(cell, value, date_style, integer_style if isinstance(value, int) else number_style)
            body.append(row)
        last = 4 + len(values)
        if name == 'Pronostico':
            total = deepcopy(prototype); total.set('r', str(last + 1))
            for c, value, col in zip(total, ['Total calculado', sum(v[1] for v in values)], ['A', 'B']):
                c.set('r', f'{col}{last + 1}'); escribir(c, value, date_style, number_style)
            # Única fórmula del reporte; su caché sirve también en lectores sin recálculo.
            c = total[1]; c.insert(0, ET.Element(tag('f'))); c[0].text = f'SUM(B5:B{last})'
            body.append(total)
        view = sheet.find(f'{tag("sheetViews")}/{tag("sheetView")}')
        ET.SubElement(view, tag('pane'), {'ySplit':'4', 'topLeftCell':'A5', 'activePane':'bottomLeft', 'state':'frozen'})
        filter_node = ET.Element(tag('autoFilter'), {'ref':f'A4:{chr(64+len(values[0]))}{last}'})
        sheet.insert(list(sheet).index(body)+1, filter_node)
        parts[path] = ET.tostring(sheet, encoding='utf-8', xml_declaration=True)
    output = BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as book:
        for name, content in parts.items():
            book.writestr(name, content)
    return output.getvalue()
