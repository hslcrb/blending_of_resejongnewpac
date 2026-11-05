import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('integrated',ROOT/'scripts'/'append_campus_interior.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Placement(unittest.TestCase):
 def test_front_entrance_and_internal_stage_are_physically_inside_same_envelope(self):
  self.assertEqual(m.to_campus((0,0,60)),(33.1,1.07,3.0999999999999943))
  self.assertEqual(m.to_campus((0,0,0)),(33.1,1.07,-71.9))
  b=m.campus_bounds((-17.5,-.355,-21),(17.5,18.25,60))
  self.assertGreater(b[0][0],-5);self.assertLess(b[1][0],71)
  self.assertGreater(b[0][2],-111);self.assertLess(b[1][1],35.06)
 def test_existing_seat_eye_and_projection_keep_uniform_scale(self):
  p=m.to_campus((-1.42,.935+1.4,14.1));self.assertAlmostEqual(p[1],3.98875)
  a=m.to_campus((-8,6.75,-1.12));b=m.to_campus((8,6.75,-1.12));self.assertAlmostEqual(b[0]-a[0],20)
 def test_invalid_coordinates_are_rejected(self):
  with self.assertRaises(ValueError):m.to_campus((0,float('nan'),1))
 def test_backstage_fits_tall_rear_shell_without_collapsing_its_wall_thickness(self):
  self.assertEqual(m.fit_backstage((-15.2,14,-12)),(-7.2,14,-12))
  self.assertEqual(m.fit_backstage((15.2,14,-12)),(15.0,14,-12))
  self.assertEqual(m.fit_backstage((-15.2,14,-8)),(-15.2,14,-8))
  a=m.fit_backstage((-14.76,14,-12));b=m.fit_backstage((-14.64,14,-12));self.assertGreater(b[0]-a[0],.08)

if __name__=='__main__':unittest.main()
