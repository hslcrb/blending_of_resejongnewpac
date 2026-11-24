"""Photo 092/095: soften the damp-looking stone foot in the existing four-mesh patch.

Usage: blender -b --factory-startup --python-exit-code 1 \
  -P scripts/refine_colonnade_base_20261124.py -- PATH_TO_ORIGINAL_GLTF
Writes distinct native component and web outputs; input must be the preserved
20261115 four-mesh asset. It never opens or overwrites the campus master.
"""

from hashlib import sha256
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT / "blender_work/20261124-survey/sejong_colonnade_stone_component.blend"
WEB = ROOT / "public/model/survey-20261115/colonnade-geometry.glb"
EXPECTED = {
    "stone",
    "Rear columns - beveled stone joints and foot",
    "Rear columns - vertical stone panel joints",
    "Rear colonnade - linear ceiling and access panels",
}
CENTRES = [-27.4434261322 + i * 8.3280639648 for i in range(7)]
CENTRE_Y = 108.6733322144
SHA_BASE = "dc66bb2086d8f196ca375b785d59da2e19d9ff806bdc485beedad43ab1cfd6cf"
FADES = (0.86, 0.70, 1.05, 0.88, 0.73, 1.02, 0.87)


def load_asset(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    mesh_objects = {obj.name for obj in bpy.context.scene.objects if obj.type == "MESH"}
    assert mesh_objects == EXPECTED, mesh_objects


def column(point):
    """Bounded to the existing seven chamfered footprints, in Blender space."""
    for index, cx in enumerate(CENTRES):
        x, y = abs(point.x - cx), abs(point.y - CENTRE_Y)
        if x <= 0.721 and y <= 0.966 and x + y <= 1.306:
            return index
    return None


def graded_color(point, index):
    # Distance and amplitude are visual estimates, not moisture readings.
    t = min(1.0, max(0.0, point.z / FADES[index]))
    smooth = t * t * (3.0 - 2.0 * t)
    side = 0.033 * math.sin(point.x * 11 + point.y * 8 + index * 2)
    darkness = (0.64 + side) + (0.36 - side) * smooth
    return (darkness, darkness * (0.976 + 0.024 * smooth),
            darkness * (0.945 + 0.055 * smooth), 1.0)


def weather_material(material, name):
    tree = material.node_tree
    principal = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
    socket = principal.inputs["Base Color"]
    color = tree.nodes.new("ShaderNodeVertexColor")
    color.layer_name = name
    if socket.is_linked:
        # This explicit Multiply node is interpreted by the glTF exporter as
        # baseColorTexture * COLOR_0, with no new image or runtime shader.
        prev = socket.links[0].from_socket
        combine = tree.nodes.new("ShaderNodeMixRGB")
        combine.blend_type = "MULTIPLY"
        combine.inputs[0].default_value = 1.0
        tree.links.new(prev, combine.inputs[1])
        tree.links.new(color.outputs["Color"], combine.inputs[2])
        tree.links.new(combine.outputs[0], socket)
    else:
        tree.links.new(color.outputs["Color"], socket)


def apply_weathering():
    stone = bpy.data.objects["stone"]
    matrix = stone.matrix_world
    bm = bmesh.new()
    bm.from_mesh(stone.data)
    shafts = []
    for face in bm.faces:
        pts = [matrix @ v.co for v in face.verts]
        ids = {column(p) for p in pts}
        if len(ids) == 1 and None not in ids and min(p.z for p in pts) < 0.01 and max(p.z for p in pts) > 6.93:
            shafts.append(face)
    assert len(shafts) == 112, f"Expected 16 shaft faces on 7 columns, observed {len(shafts)}"
    # Keep the material and original UVs by splitting only the audited shaft
    # triangles. Never cut the other wall/stone geometry in this joined object.
    boundary = set(shafts)
    for z in (0.33, 0.74, 1.08):
        geom = boundary | {edge for face in boundary for edge in face.edges} | {
            v for face in boundary for v in face.verts
        }
        bmesh.ops.bisect_plane(
            bm, geom=list(geom), dist=0.00001,
            plane_co=matrix.inverted() @ Vector((0.0, 0.0, z)),
            plane_no=matrix.to_3x3().transposed() @ Vector((0.0, 0.0, 1.0)),
        )
        boundary = set(_shaft_faces(bm, matrix))
    bm.normal_update()
    bm.to_mesh(stone.data)
    bm.free()
    stone.data.update()
    attr = stone.data.color_attributes.new(name="ColonnadeStoneTone", type="FLOAT_COLOR", domain="CORNER")
    count = 0
    per_column = set()
    for poly in stone.data.polygons:
        points = [matrix @ stone.data.vertices[stone.data.loops[idx].vertex_index].co for idx in poly.loop_indices]
        ids = {column(p) for p in points}
        idx = next(iter(ids)) if len(ids) == 1 else None
        # The verts in this footprint with existing misc seams at mid-height
        # are all above 1.08m, so they remain white/unmodified.
        for loop, point in zip(poly.loop_indices, points):
            if idx is not None and -0.001 <= point.z <= 1.08:
                attr.data[loop].color = graded_color(point, idx)
                count += 1
                per_column.add(idx)
            else:
                attr.data[loop].color = (1, 1, 1, 1)
    assert per_column == set(range(7)) and count > 300, (per_column, count)
    stone.data.color_attributes.active_color = attr
    weather_material(stone.data.materials[0], attr.name)
    trim = bpy.data.objects["Rear columns - beveled stone joints and foot"]
    mat = next(m for m in trim.data.materials if "weathered foot" in m.name)
    node = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    node.inputs["Base Color"].default_value = (0.356, 0.343, 0.316, 1)
    node.inputs["Roughness"].default_value = 0.83
    print("COLONNADE_WEATHER", count, "face corners across", len(per_column), "columns")


def _shaft_faces(bm, matrix):
    for face in bm.faces:
        if not face.is_valid:
            continue
        pts = [matrix @ v.co for v in face.verts]
        ids = {column(p) for p in pts}
        heights = [p.z for p in pts]
        # Original shaft vertices sit only at the bottom/top; the only new
        # vertices in this height region are the inserted horizontal cuts.
        if len(ids) == 1 and None not in ids and any(
            abs(h - z) < 0.0002 for h in heights for z in (0.0, 0.33, 0.74, 1.08, 6.94)
        ) and all(min(abs(h-z) for z in (0.0, 0.33, 0.74, 1.08, 6.942)) < 0.012 for h in heights):
            yield face


def run(source):
    if sha256(source.read_bytes()).hexdigest() != SHA_BASE:
        raise ValueError("Use the preserved 20261115 colonnade GLB, not an already modified derivative")
    if NATIVE.exists() or WEB.resolve() == source.resolve():
        raise ValueError("Use a scratch worktree and keep the source in a distinct path")
    load_asset(source)
    apply_weathering()
    bpy.context.scene.name = "Sejong photographed colonnade stone component"
    bpy.context.scene["source_glb_sha256"] = SHA_BASE
    bpy.context.scene["source_scope"] = "Four-mesh assembly only; not a replacement for the full campus master"
    NATIVE.parent.mkdir(parents=True, exist_ok=True)
    WEB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(NATIVE), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(WEB), export_format="GLB",
        use_active_scene=True, export_cameras=False, export_lights=False,
        export_animations=False, export_vertex_color="NAME",
        export_vertex_color_name="ColonnadeStoneTone", export_all_vertex_colors=False)


if __name__ == "__main__":
    run(Path(sys.argv[sys.argv.index("--") + 1]).resolve())
