import json,struct,hashlib,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class UnifiedShellContract(unittest.TestCase):
 def test_core_has_real_structure_and_transparent_front_glazing(self):
  manifest=json.loads((ROOT/'public/model/streaming-manifest.json').read_text());path=ROOT/'public'/manifest['core']['url'].lstrip('/');data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);names={x.get('name')for x in g['nodes']}
  self.assertIn('Unified shell - east structural wall',names);self.assertIn('Unified shell - left clear door',names);self.assertNotIn('Surface bake calibration plane',names)
  self.assertEqual(len(data),manifest['core']['bytes']);self.assertEqual(hashlib.sha256(data).hexdigest(),manifest['core']['sha256']);self.assertLess(len(data),25*1024*1024)
  glass=[m for m in g['materials']if m.get('name','').startswith('Unified clear')];self.assertGreaterEqual(len(glass),2)
  for mat in glass:self.assertEqual(mat.get('alphaMode'),'BLEND');self.assertLess(mat['pbrMetallicRoughness']['baseColorFactor'][3],.5)
 def test_forward_planting_remains_visible_in_the_initial_wider_view(self):
  manifest=json.loads((ROOT/'public/model/streaming-manifest.json').read_text());front=[c for c in manifest['chunks']if 'campus' in c['id'] and 'front'in c['id']];self.assertEqual(len(front),3)
  for chunk in front:self.assertGreaterEqual(chunk['maxViewDistance'],350)
if __name__=='__main__':unittest.main()
