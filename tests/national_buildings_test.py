import unittest
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('national_buildings',ROOT/'scripts'/'build_national_buildings.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class NationalBuildingTests(unittest.TestCase):
 def test_only_active_change_records(self):
  self.assertTrue(module.include_change({'A29':'I'}));self.assertTrue(module.include_change({'A29':'U'}));self.assertFalse(module.include_change({'A29':'D'}));self.assertFalse(module.include_change({'A29':None}))
 def test_tile_index_and_coordinates_preserve_sign(self):
  self.assertEqual(module.tile_index(197897,552531),(19,55));self.assertEqual(module.tile_index(-1,-1),(-1,-1))

class PrecisionTests(unittest.TestCase):
 def test_tiny_valid_ring_retains_precision(self):
  from osgeo import ogr
  g=ogr.CreateGeometryFromWkt('POLYGON ((0.001 0.001, 0.009 0.001, 0.009 0.009, 0.001 0.009, 0.001 0.001))')
  compact=module.polygon_data(g,0,0)
  self.assertTrue(module.needs_precision(g,compact))
  exact=module.precise_polygon_data(g,0,0)
  self.assertGreater(len(set(zip(exact[0][0][::2],exact[0][0][1::2]))),2)
 def test_ordinary_polygon_keeps_compact_encoding(self):
  from osgeo import ogr
  g=ogr.CreateGeometryFromWkt('POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))')
  self.assertFalse(module.needs_precision(g,module.polygon_data(g,0,0)))

class IndependentValidationTests(unittest.TestCase):
 def test_rejects_collapsed_and_accepts_exact_ring(self):
  from osgeo import ogr
  spec=importlib.util.spec_from_file_location('independent_validator',ROOT/'scripts'/'validate_national_buildings.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
  g=ogr.CreateGeometryFromWkt('POLYGON ((0.001 0.001, 0.009 0.001, 0.009 0.009, 0.001 0.009, 0.001 0.001))');compact=module.polygon_data(g,0,0);row=[1,0,0,compact,[None]*31]
  with self.assertRaisesRegex(ValueError,'unique vertices lost'):v.check_geometry(g,0,0,row)
  row.append({'precision':'source','polygons':module.precise_polygon_data(g,0,0)})
  self.assertTrue(v.check_geometry(g,0,0,row)[0])
  row[5]['polygons'][0][0][0]+=1
  with self.assertRaisesRegex(ValueError,'coordinate mismatch'):v.check_geometry(g,0,0,row)

if __name__=='__main__':unittest.main()
