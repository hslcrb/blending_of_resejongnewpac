import sys,json
from osgeo import ogr,osr
ogr.UseExceptions(); ds=ogr.Open(sys.argv[1],0);data=[]
for i in range(ds.GetLayerCount()):
 l=ds.GetLayerByIndex(i);defn=l.GetLayerDefn();s=l.GetSpatialRef();extent=l.GetExtent();
 data.append({'layer':l.GetName(),'count':l.GetFeatureCount(),'geometry':ogr.GeometryTypeToName(defn.GetGeomType()),'srs':s.GetAuthorityCode(None) if s else None,'bounds':extent,'fields':[defn.GetFieldDefn(k).GetName() for k in range(defn.GetFieldCount())]})
print(json.dumps(data,ensure_ascii=False,indent=2))
