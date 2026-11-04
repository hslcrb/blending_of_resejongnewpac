"""Read-only inputs and safe outputs for imported GIS regeneration tools."""
from pathlib import Path
import os
import tempfile

REPO = Path(__file__).resolve().parents[2]
RUN_ROOT = REPO / '.gis-runs'


def is_scratch(path):
    # The run root itself cannot be a symbolic link to another location.
    if RUN_ROOT.is_symlink():
        return False
    candidate = Path(path).resolve()
    root = RUN_ROOT.resolve()
    return candidate != root and root in candidate.parents


def new_file(path):
    candidate = Path(path)
    if not is_scratch(candidate):
        raise ValueError('Output must be inside this repository’s .gis-runs directory')
    if candidate.exists() or candidate.is_symlink():
        raise FileExistsError(f'Refusing to overwrite {candidate}')
    candidate.parent.mkdir(parents=True, exist_ok=True)
    return candidate.resolve()


def new_directory(path):
    candidate = Path(path)
    if not is_scratch(candidate):
        raise ValueError('Output directory must be inside this repository’s .gis-runs directory')
    if candidate.exists() or candidate.is_symlink():
        raise FileExistsError(f'Refusing to overwrite {candidate}')
    candidate.parent.mkdir(parents=True, exist_ok=True)
    return candidate.resolve()


def qgis_environment():
    # QGIS writes style/authentication caches; isolate them in a new run folder.
    if RUN_ROOT.is_symlink(): raise ValueError('Scratch root may not be a symlink')
    RUN_ROOT.mkdir(parents=True, exist_ok=True)
    profile = Path(tempfile.mkdtemp(prefix='qgis-profile-', dir=RUN_ROOT)).resolve()
    if not is_scratch(profile) or profile.parent != RUN_ROOT.resolve():
        raise ValueError('Unexpected QGIS profile location')
    os.environ['QGIS_CUSTOM_CONFIG_PATH'] = str(profile)
    os.environ['QGIS_AUTH_DB_DIR_PATH'] = str(profile)
    os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
    return profile
