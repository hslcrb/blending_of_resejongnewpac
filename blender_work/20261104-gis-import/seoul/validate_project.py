import os
from pathlib import Path
os.environ['QT_QPA_PLATFORM'] = 'offscreen'
from qgis.core import QgsApplication, QgsProject
app = QgsApplication([], False)
app.initQgis()
project = QgsProject.instance()
assert project.read(str(Path(__file__).resolve().parent / 'seoul_overview.qgz'))
layers = list(project.mapLayers().values())
assert len(layers) == 1
layer = layers[0]
assert layer.isValid() and layer.featureCount() == 123626 and layer.crs().authid() == 'EPSG:5186'
print('QGIS project: valid, 123626 cells, EPSG:5186')
