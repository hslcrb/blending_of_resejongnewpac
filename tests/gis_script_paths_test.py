import importlib.util
from pathlib import Path
import unittest
import hashlib
import subprocess
import sys

module_path = Path(__file__).resolve().parents[1] / 'blender_work' / '20261104-gis-import' / 'gis_paths.py'
spec = importlib.util.spec_from_file_location('gis_paths', module_path)
gis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gis)

class OutputSafety(unittest.TestCase):
    def test_rejects_tracked_and_external_paths(self):
        with self.assertRaises(ValueError): gis.new_file(gis.REPO / 'public' / 'area' / 'seoul-grid.json')
        with self.assertRaises(ValueError): gis.new_file(gis.REPO.parent / 'user-output.json')
        with self.assertRaises(ValueError): gis.new_directory(gis.REPO / 'blender_work')
    def test_rejects_existing_file_and_source_as_target(self):
        target = gis.RUN_ROOT / 'safety-tests' / 'existing.txt'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('keep', encoding='utf8')
        with self.assertRaises(FileExistsError): gis.new_file(target)
        self.assertEqual(target.read_text(encoding='utf8'), 'keep')
    def test_exporter_rejects_a_published_asset_before_writing(self):
        target = gis.REPO / 'public' / 'area' / 'seoul-grid.json'
        before = hashlib.sha256(target.read_bytes()).digest()
        script = gis.REPO / 'blender_work' / '20261104-gis-import' / 'web' / 'export_city.py'
        result = subprocess.run([sys.executable, '-B', str(script), '--output', str(target)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'.gis-runs', result.stderr)
        self.assertEqual(hashlib.sha256(target.read_bytes()).digest(), before)

    def test_accepts_new_paths_only_inside_run_root(self):
        target = gis.RUN_ROOT / 'safety-tests' / 'not-created-yet.json'
        self.assertEqual(gis.new_file(target), target.resolve())
        self.assertFalse(target.exists())
        self.assertTrue(gis.is_scratch(target))
        self.assertFalse(gis.is_scratch(gis.REPO / 'public' / 'area'))

if __name__ == '__main__': unittest.main()
