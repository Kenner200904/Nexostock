import unittest
from datetime import date, timedelta
from cobertura import analizar


def scenario(quantities, stock, lead=2):
    result = {
        'ejecucion_id': 'test', 'historico_hasta': '2026-08-31',
        'horizonte_dias': len(quantities), 'datos_sinteticos': False,
        'producto': {'empresa_id': 'E1', 'sku': 'S1', 'unidad': 'unidad'},
        'pronostico': [{'fecha': (date(2026, 9, 1) + timedelta(days=i)).isoformat(), 'cantidad': q} for i, q in enumerate(quantities)],
    }
    inventory = {'fecha_corte': '2026-08-31', 'stock_actual': stock,
                 'plazo_entrega_dias': lead, 'unidad': 'unidad',
                 'origen': 'REAL', 'origen_producto': 'REAL'}
    return result, inventory


class CoverageTests(unittest.TestCase):
    def test_exact_stock_covers_day(self):
        r = analizar(*scenario([5, 5, 1], 10))
        self.assertEqual(r['primer_faltante'], '2026-09-03')
        self.assertEqual(r['dias_completos_cubiertos'], 2)
        self.assertFalse(r['riesgo_en_plazo'])
        self.assertEqual(r['faltante_total'], 1)

    def test_fractional_values_do_not_create_false_shortage(self):
        r = analizar(*scenario([0.1, 0.2], 0.3))
        self.assertIsNone(r['primer_faltante'])
        self.assertEqual(r['stock_final'], 0)

    def test_shortage_on_final_day_of_lead(self):
        r = analizar(*scenario([3, 4, 1], 6))
        self.assertTrue(r['riesgo_en_plazo'])
        self.assertEqual(r['estado'], 'faltante_en_plazo')
        self.assertEqual(r['demanda_en_plazo'], 7)

    def test_zero_demand_and_stock(self):
        r = analizar(*scenario([0, 0, 0], 0))
        self.assertEqual(r['dias_completos_cubiertos'], 3)
        self.assertIsNone(r['primer_faltante'])

    def test_empty_stock_positive_demand(self):
        r = analizar(*scenario([1, 2], 0))
        self.assertEqual(r['dias_completos_cubiertos'], 0)
        self.assertEqual(r['primer_faltante'], '2026-09-01')

    def test_lead_beyond_horizon_is_not_assumed_safe(self):
        r = analizar(*scenario([1, 2], 10, lead=5))
        self.assertIsNone(r['riesgo_en_plazo'])
        self.assertIsNone(r['demanda_en_plazo'])
        r = analizar(*scenario([1, 2], 2, lead=5))
        self.assertTrue(r['riesgo_en_plazo'])
        self.assertIsNone(r['demanda_en_plazo'])

    def test_mismatched_cutoff_and_unit(self):
        for field, value in [('fecha_corte', '2026-09-01'), ('unidad', 'caja')]:
            result, inventory = scenario([1, 2], 10)
            inventory[field] = value
            with self.assertRaises(ValueError): analizar(result, inventory)

    def test_invalid_predictions(self):
        for values in ([], [1, -1], [float('nan')], [float('inf')]):
            with self.assertRaises(ValueError): analizar(*scenario(values, 10))
        result, inventory = scenario([1, 2], 10)
        result['pronostico'][1]['fecha'] = '2026-09-03'
        with self.assertRaises(ValueError): analizar(result, inventory)

    def test_synthetic_inventory_marks_result(self):
        result, inventory = scenario([1, 2], 10)
        inventory['origen'] = 'SINTETICO'
        self.assertTrue(analizar(result, inventory)['datos_sinteticos'])

    def test_conservation_per_day(self):
        r = analizar(*scenario([2.5, 1.25, 3, 0, 2], 5))
        for row in r['serie']:
            self.assertGreaterEqual(row['stock_restante'], 0)
            self.assertGreaterEqual(row['faltante_acumulado'], 0)
            self.assertEqual(row['stock_restante'] - row['faltante_acumulado'], 5 - row['demanda_acumulada'])


if __name__ == '__main__':
    unittest.main()
