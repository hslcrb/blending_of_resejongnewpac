"""Export the same 50m overview as a portable QGIS GeoPackage and project."""
from pathlib import Path
import gzip,json,os
from osgeo import ogr,osr
os.environ.setdefault('QT_QPA_PLATFORM','offscreen')
from qgis.core import QgsApplication,QgsProject,QgsVectorLayer,QgsCoordinateReferenceSystem,QgsRectangle,QgsFillSymbol,QgsReferencedRectangle

root=Path(__file__).resolve().parent
with gzip.open(root/'seoul-grid-50m.json.gz','rt',encoding='utf8') as f: data=json.load(f)
out=root/'seoul-grid-50m.gpkg'
if out.exists(): raise RuntimeError('Output already exists; refusing to overwrite it')
driver=ogr.GetDriverByName('GPKG'); ds=driver.CreateDataSource(str(out)); srs=osr.SpatialReference();srs.ImportFromEPSG(5186)
layer=ds.CreateLayer('seoul_building_grid',srs,ogr.wkbPolygon)
for name,kind in [('district',ogr.OFTString),('buildings',ogr.OFTInteger),('mean_m',ogr.OFTReal),('unknown',ogr.OFTInteger),('estimated',ogr.OFTInteger),('reported',ogr.OFTInteger),('district_parts',ogr.OFTString)]: layer.CreateField(ogr.FieldDefn(name,kind))
layer.StartTransaction()
mixed = {(e,n): parts for e,n,parts in data['mixed_district_cells']}
for code,e,n,count,height,unknown,estimated,reported in data['cells']:
 x=e*50;y=n*50;ring=ogr.Geometry(ogr.wkbLinearRing)
 for dx,dy in ((0,0),(50,0),(50,50),(0,50),(0,0)):ring.AddPoint_2D(x+dx,y+dy)
 polygon=ogr.Geometry(ogr.wkbPolygon);polygon.AddGeometry(ring)
 feature=ogr.Feature(layer.GetLayerDefn())
 for name,value in zip(('district','buildings','mean_m','unknown','estimated','reported'),(code,count,height,unknown,estimated,reported)):feature.SetField(name,value)
 parts=mixed.get((e,n), [(code,count)])
 feature.SetField('district_parts', ','.join(f'{district}:{number}' for district,number in parts))
 feature.SetGeometry(polygon)
 if layer.CreateFeature(feature)!=0:raise RuntimeError('Feature write failed')
layer.CommitTransaction(); ds=None
app=QgsApplication([],False);app.initQgis()
project=QgsProject.instance();project.setCrs(QgsCoordinateReferenceSystem('EPSG:5186'))
vector=QgsVectorLayer(str(out)+'|layername=seoul_building_grid','서울 건물 밀도 50m 격자 (개략)','ogr')
if not vector.isValid():raise RuntimeError('QGIS layer invalid')
symbol=QgsFillSymbol.createSimple({'color':'81,111,121,255','outline_style':'no'})
vector.renderer().setSymbol(symbol)
project.addMapLayer(vector)
project.viewSettings().setDefaultViewExtent(QgsReferencedRectangle(QgsRectangle(176000,534000,223000,569000), project.crs()))
project.setFileName(str(root/'seoul_overview.qgz'))
if not project.write():raise RuntimeError('QGIS project write failed')
print('QGIS project saved, cells:',vector.featureCount())
