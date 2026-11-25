import argparse, os, sys
from pathlib import Path
root=Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0,str(root.parent))
from gis_paths import qgis_environment
qgis_environment()
from qgis.core import QgsApplication, QgsProject
parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parent / 'seoul_overview.qgz')
parser.add_argument('--expected-cells', type=int, default=123626)
args = parser.parse_args()
app = QgsApplication([], False)
app.initQgis()
project = QgsProject.instance()
assert project.read(str(args.project))
layers = list(project.mapLayers().values())
assert len(layers) == 1
layer = layers[0]
assert layer.isValid() and layer.featureCount() == args.expected_cells and layer.crs().authid() == 'EPSG:5186'
print(f'QGIS project: valid, {args.expected_cells} cells, EPSG:5186')
