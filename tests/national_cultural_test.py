import importlib.util
from pathlib import Path
import unittest
import tempfile

path = Path(__file__).resolve().parents[1] / "scripts" / "build_national_cultural.py"
spec = importlib.util.spec_from_file_location("national_cultural", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SourceValueTests(unittest.TestCase):
    def test_preserves_null_zero_overflow_and_euc_kr(self):
        schema = [dict(name="A0", type="N", width=4, offset=1),
                  dict(name="A1", type="C", width=10, offset=5),
                  dict(name="A2", type="C", width=4, offset=15),
                  dict(name="A3", type="N", width=6, offset=19)]
        record = b" " + b"   0" + "문화".encode("euc-kr").ljust(10) + b" \x00  " + b"******"
        values, fallback = module.decode_record(record, schema)
        self.assertEqual(values, {"A0": "0", "A1": "문화", "A2": None, "A3": "******"})
        self.assertEqual(fallback, [])

    def test_cp949_fallback_is_reported_and_bad_encoding_fails(self):
        value, fallback = module.decode_field("똠".encode("cp949"))
        self.assertEqual((value, fallback), ("똠", True))
        with self.assertRaises(UnicodeDecodeError):
            module.decode_field(b"\xff")

    def test_json_bytes_are_utf8_and_lf_on_any_platform(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "value.json"
            module.write_json_bytes(target, {"건물": "서울"})
            self.assertEqual(target.read_bytes(), '{"건물":"서울"}\n'.encode("utf-8"))
            module.write_json_bytes(target, {"건물": "서울"}, indent=2)
            actual = target.read_bytes()
            self.assertTrue(actual.endswith(b"}\n"))
            self.assertNotIn(b"\r", actual)

    def test_candidate_excludes_deletions_and_unknown_actions(self):
        fields = {"A8": "05000", "A9": "문화및집회시설", "A29": "U"}
        self.assertTrue(module.is_candidate(fields))
        self.assertTrue(module.is_candidate({**fields, "A29": "I"}))
        self.assertFalse(module.is_candidate({**fields, "A29": "D"}))
        self.assertFalse(module.is_candidate({**fields, "A29": None}))
        self.assertTrue(module.is_candidate({"A8": "other", "A9": "집회시설", "A29": "U"}))
        self.assertFalse(module.is_candidate({"A8": "other", "A9": "사무실", "A29": "U"}))

if __name__ == "__main__":
    unittest.main()
