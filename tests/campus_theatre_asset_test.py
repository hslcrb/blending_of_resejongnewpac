"""Check the fitted campus asset while retaining the original theatre URL asset."""
import json,struct,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def glb(path):
 raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);cursor=20+size
 while cursor<len(raw):
  length,kind=struct.unpack_from('<II',raw,cursor)
  if kind==0x004e4942:return doc,raw[cursor+8:cursor+8+length]
  cursor+=8+length
 raise ValueError('No binary chunk')
def positions(doc,binary,node):
 for primitive in doc['meshes'][node['mesh']]['primitives']:
  accessor=doc['accessors'][primitive['attributes']['POSITION']];view=doc['bufferViews'][accessor['bufferView']];start=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',12)
  assert accessor['componentType']==5126
  for i in range(accessor['count']):yield struct.unpack_from('<3f',binary,start+i*stride)
class CampusAsset(unittest.TestCase):
 def test_rear_stage_fits_the_available_tall_shell(self):
  doc,binary=glb(ROOT/'public/model/grand-theatre/grand-theatre-campus.glb');count=0
  for node in doc['nodes']:
   if 'mesh' not in node:continue
   for x,y,z in positions(doc,binary,node):
    if z < -10.24001:
     count+=1;self.assertGreaterEqual(x,-7.20001);self.assertLessEqual(x,15.00001);self.assertLessEqual(y,15.50001)
  self.assertGreater(count,0)
 def test_all_existing_seats_and_stage_components_are_preserved(self):
  old,old_bin=glb(ROOT/'public/model/grand-theatre/grand-theatre.glb');new,new_bin=glb(ROOT/'public/model/grand-theatre/grand-theatre-campus.glb')
  olds={n['name']:n for n in old['nodes'] if 'mesh' in n};news={n['name']:n for n in new['nodes'] if 'mesh' in n}
  self.assertEqual(set(olds),set(news));self.assertEqual(len(news),16)
  for name in ('Grand_seat','Grand_seat_side','GrandCurtain','GrandAcousticShell','GrandProjectionScreen','Grand_pipe','Grand_cream'):
   self.assertEqual(list(positions(old,old_bin,olds[name])),list(positions(new,new_bin,news[name])),name)
if __name__=='__main__':unittest.main()
