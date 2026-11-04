import unittest, importlib.util
from types import SimpleNamespace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('viewport',ROOT/'scripts'/'blender_viewport_lighting.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class PreviewTest(unittest.TestCase):
 def test_uses_scene_lights_and_world_in_3d_views(self):
  shading=SimpleNamespace(type='SOLID',use_scene_lights=False,use_scene_world=False)
  area=SimpleNamespace(type='VIEW_3D',spaces=SimpleNamespace(active=SimpleNamespace(shading=shading)))
  other=SimpleNamespace(type='TEXT_EDITOR')
  self.assertEqual(mod.use_scene_preview([SimpleNamespace(areas=[area,other])]),1)
  self.assertEqual((shading.type,shading.use_scene_lights,shading.use_scene_world),('MATERIAL',True,True))
if __name__=='__main__':unittest.main()
