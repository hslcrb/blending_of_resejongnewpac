"""Open an input scene in background and reserve a fresh scratch output path."""
import argparse
import sys
from pathlib import Path
import bpy
from gis_paths import new_file


def open_scene_job(description):
    if not bpy.app.background:
        raise RuntimeError('Use background Blender; the live session is not changed')
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    source = args.source.resolve(strict=True)
    target = new_file(args.output)
    if source.suffix.lower() != '.blend': raise ValueError('Source must be a Blender file')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    return source, target


def save_new_scene(target):
    if target.exists() or target.is_symlink(): raise FileExistsError(f'Refusing to overwrite {target}')
    if target.suffix.lower() != '.blend': raise ValueError('Output must be a Blender file')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
