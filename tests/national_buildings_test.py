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
if __name__=='__main__':unittest.main()
