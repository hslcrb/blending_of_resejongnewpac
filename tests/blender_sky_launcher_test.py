import unittest
from pathlib import Path
import importlib.util
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('open_blender_sky',ROOT/'scripts'/'open_blender_sky.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class LauncherTests(unittest.TestCase):
 def test_default_is_latest_connected_tree_copy(self):
  p=module.resolve_copy(None);self.assertTrue(p.is_file());self.assertEqual(p.name,'sejong_trees_connected_20261104.blend')
 def test_rejects_originals_and_non_blend_files(self):
  with self.assertRaises(ValueError):module.resolve_copy(ROOT/'public'/'model'/'sejong.blend')
  with self.assertRaises(ValueError):module.resolve_copy(ROOT/'README.md')
 def test_launch_passes_copy_and_start_script_without_shell(self):
  with patch.object(module.subprocess,'Popen') as popen:
   module.launch(Path('C:/Blender/blender.exe'),module.resolve_copy(None))
  args,kwargs=popen.call_args;self.assertIn('--python',args[0]);self.assertEqual(kwargs.get('shell',False),False)
if __name__=='__main__':unittest.main()
