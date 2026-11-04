import json
import struct
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class GrandTheatreContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.layout = json.loads((ROOT / 'public/model/grand-theatre/layout.json').read_text(encoding='utf-8'))

    def test_seats_have_distinct_ids_and_accessible_positions(self):
        seats = self.layout['seats']
        self.assertGreater(len(seats), 600)
        self.assertEqual(len({seat['id'] for seat in seats}), len(seats))
        self.assertEqual({seat['level'] for seat in seats}, {1, 2, 3})
        for seat in seats:
            self.assertEqual(len(seat['position']), 3)
            self.assertGreaterEqual(seat['position'][1], 0)
            self.assertGreater(seat['position'][2], 0)

    def test_transition_and_interactive_nodes_have_contract(self):
        self.assertEqual(self.layout['coordinates'], 'three-y-up-meters')
        self.assertEqual(self.layout['nodes'], {'curtain': 'GrandCurtain', 'shell': 'GrandAcousticShell', 'screen': 'GrandProjectionScreen'})
        self.assertTrue((ROOT / 'public/model/grand-theatre/grand-theatre.glb').is_file())
        self.assertGreaterEqual(self.layout['entrance']['z'], 27)
        self.assertLessEqual(abs(self.layout['entrance']['x']), 1)

    def test_export_contains_only_interior_and_embedded_textures(self):
        glb = (ROOT / 'public/model/grand-theatre/grand-theatre.glb').read_bytes()
        magic, version, length = struct.unpack_from('<4sII', glb)
        self.assertEqual((magic, version, length), (b'glTF', 2, len(glb)))
        chunk_size, chunk_type = struct.unpack_from('<II', glb, 12)
        self.assertEqual(chunk_type, 0x4e4f534a)
        contents = json.loads(glb[20:20+chunk_size])
        names = {node.get('name', '') for node in contents['nodes']}
        self.assertTrue(set(self.layout['nodes'].values()) <= names)
        self.assertTrue(all('mesh' in node for node in contents['nodes'] if node.get('name') in self.layout['nodes'].values()))
        self.assertTrue(all(name.startswith('Grand') for name in names))
        self.assertGreaterEqual(len(contents.get('images', [])), 5)
        self.assertTrue(all('bufferView' in image and 'uri' not in image for image in contents['images']))

    def test_screen_uv_covers_entire_video_once(self):
        glb = (ROOT / 'public/model/grand-theatre/grand-theatre.glb').read_bytes()
        chunk_size = struct.unpack_from('<I', glb, 12)[0]
        model = json.loads(glb[20:20+chunk_size]); binary_start = 20+chunk_size+8
        node = next(node for node in model['nodes'] if node.get('name') == 'GrandProjectionScreen')
        primitive = model['meshes'][node['mesh']]['primitives'][0]
        uv = model['accessors'][primitive['attributes']['TEXCOORD_0']]
        view = model['bufferViews'][uv['bufferView']]
        self.assertEqual((uv['componentType'], uv['type']), (5126, 'VEC2'))
        offset = binary_start+view.get('byteOffset', 0)+uv.get('byteOffset', 0)
        stride = view.get('byteStride', 8)
        coords = [struct.unpack_from('<ff', glb, offset+i*stride) for i in range(uv['count'])]
        for axis in (0, 1):
            self.assertAlmostEqual(min(pair[axis] for pair in coords), 0, places=6)
            self.assertAlmostEqual(max(pair[axis] for pair in coords), 1, places=6)

if __name__ == '__main__': unittest.main()
