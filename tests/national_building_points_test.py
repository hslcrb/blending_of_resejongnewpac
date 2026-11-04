import gzip,json,struct,tempfile,unittest,subprocess,sys,hashlib
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[1]/'scripts'/'build_national_building_points.py'
class PointIndexTest(unittest.TestCase):
 def test_deterministic_and_full_data(self):
  with tempfile.TemporaryDirectory() as temp:
   p=Path(temp); rows=[[3,99999,50,[],[]],[8,3,99999,[],[]]]; payload=json.dumps({'tile':[19,55],'records':rows}).encode(); compressed=gzip.compress(payload,mtime=0);(p/'19_55.json.gz').write_bytes(compressed)
   manifest={'version':1,'sourceCrs':'EPSG:5186','tileSize':10000,'precision':.1,'totalRecords':2,'tiles':[[19,55,2,len(compressed),hashlib.sha256(compressed).hexdigest()]]};(p/'manifest.json').write_text(json.dumps(manifest));out=p/'points.bin.gz';cmd=[sys.executable,str(SCRIPT),'--input',str(p),'--output',str(out)];subprocess.run(cmd,check=True);first=out.read_bytes();subprocess.run(cmd,check=True);self.assertEqual(first,out.read_bytes());raw=gzip.decompress(first);self.assertEqual(raw[:4],b'NBP1');self.assertEqual(struct.unpack('<I',raw[4:8])[0],2);self.assertEqual(struct.unpack('<IiiIii',raw[8:]),(3,1999999,5500050,8,1900003,5599999))
 def test_hash_mismatch_fails(self):
  with tempfile.TemporaryDirectory() as temp:
   p=Path(temp);(p/'0_0.json.gz').write_bytes(gzip.compress(b'{}'));(p/'manifest.json').write_text(json.dumps({'version':1,'sourceCrs':'EPSG:5186','tileSize':10000,'precision':.1,'totalRecords':1,'tiles':[[0,0,1,1,'bad']]}));r=subprocess.run([sys.executable,str(SCRIPT),'--input',str(p),'--output',str(p/'out.gz')],capture_output=True);self.assertNotEqual(r.returncode,0);self.assertFalse((p/'out.gz').exists())
if __name__=='__main__':unittest.main()
