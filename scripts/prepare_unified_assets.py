"""Keep terrace detail while excluding the superseded, overlapping simple lobby."""
import json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def prepare():
 source=ROOT/'public/model/stream/20261103-front-terrace-detail.glb';b=source.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);removed={i for i,x in enumerate(g['nodes'])if x.get('name','').startswith('Lobby')}
 if len(removed)!=6:raise ValueError('Unexpected original lobby contract')
 for sc in g['scenes']:sc['nodes']=[i for i in sc.get('nodes',[])if i not in removed]
 for node in g['nodes']:
  if 'children'in node:node['children']=[i for i in node['children']if i not in removed]
 raw=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();raw+=b' '*((-len(raw))%4);tail=b[20+n:];out=struct.pack('<4sII',b'glTF',2,20+len(raw)+len(tail))+struct.pack('<I4s',len(raw),b'JSON')+raw+tail
 p=ROOT/'public/model/stream/20261105-front-terrace-detail.glb';p.write_bytes(out);return len(out)
if __name__=='__main__':print(prepare())
