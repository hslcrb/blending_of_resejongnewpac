"""Export the same 50m overview as a portable QGIS GeoPackage and project."""
from pathlib import Path
import argparse,gzip,json,os,sys
from osgeo import ogr,osr
root=Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0,str(root.parent))
from gis_paths import new_directory,qgis_environment
qgis_environment()
from qgis.core import Qgis,QgsApplication,QgsProject,QgsVectorLayer,QgsCoordinateReferenceSystem,QgsRectangle,QgsFillSymbol,QgsReferencedRectangle

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,default=root/'seoul-grid-50m.json.gz')
parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args(); output_dir=new_directory(args.output_dir)
with gzip.open(args.source,'rt',encoding='utf8') as f: data=json.load(f)
output_dir.mkdir(exist_ok=False)
out=output_dir/'seoul-grid-50m.gpkg'
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
project=QgsProject.instance();project.setFilePathStorage(Qgis.FilePathType.Relative);project.setCrs(QgsCoordinateReferenceSystem('EPSG:5186'))
vector=QgsVectorLayer(str(out)+'|layername=seoul_building_grid','서울 건물 밀도 50m 격자 (개략)','ogr')
if not vector.isValid():raise RuntimeError('QGIS layer invalid')
symbol=QgsFillSymbol.createSimple({'color':'81,111,121,255','outline_style':'no'})
vector.renderer().setSymbol(symbol)
project.addMapLayer(vector)
project.viewSettings().setDefaultViewExtent(QgsReferencedRectangle(QgsRectangle(176000,534000,223000,569000), project.crs()))
project.setFileName(str(output_dir/'seoul_overview.qgz'))
if not project.write():raise RuntimeError('QGIS project write failed')
print('QGIS project saved, cells:',vector.featureCount())
