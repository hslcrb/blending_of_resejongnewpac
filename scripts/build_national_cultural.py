"""Extract cultural-use building candidates from a CH_D010 change shapefile.

DBF fields are retained as strings, not lossy GDAL numeric conversions. The SHP
and DBF must remain together in their original record order. Run with the QGIS
Python environment; no source file is modified.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct

# Metadata from the user's source; A29/A30 are change type/administrative code.
EXPECTED_FIELDS = [f"A{i}" for i in range(31)]
CULTURE = "\ubb38\ud654"
ASSEMBLY = "\uc9d1\ud68c"


def read_dbf_schema(stream):
    header = stream.read(32)
    if len(header) != 32:
        raise ValueError("Incomplete DBF header")
    count, header_length, record_length = struct.unpack_from("<IHH", header, 4)
    fields = []
    offset = 1
    while stream.tell() < header_length - 1:
        descriptor = stream.read(32)
        if len(descriptor) != 32 or descriptor[0] == 0x0D:
            raise ValueError("Malformed DBF field descriptors")
        name = descriptor[:11].split(b"\0", 1)[0].decode("ascii")
        width = descriptor[16]
        fields.append({"name": name, "type": chr(descriptor[11]), "width": width,
                       "decimals": descriptor[17], "offset": offset})
        offset += width
    if [field["name"] for field in fields] != EXPECTED_FIELDS:
        raise ValueError("Expected the 31 source fields A0 through A30")
    if offset != record_length:
        raise ValueError("DBF record length does not match its fields")
    stream.seek(header_length - 1)
    if stream.read(1) != b"\r":
        raise ValueError("Missing DBF field terminator")
    return count, header_length, record_length, fields


def decode_field(raw):
    # Padding, terminal NULs, and an entirely blank field are not data values.
    # Embedded NULs and number/date spelling are retained in the JSON string.
    raw = raw.strip(b" \x00")
    if not raw:
        return None, False
    try:
        return raw.decode("euc-kr", errors="strict"), False
    except UnicodeDecodeError:
        # Common Windows extension, recorded in the manifest rather than hidden.
        return raw.decode("cp949", errors="strict"), True


def decode_record(record, fields):
    if not record or record[0] not in (0x20, 0x2A):
        raise ValueError("Invalid or truncated DBF record")
    values, fallback = {}, []
    for field in fields:
        start = field["offset"]
        value, used_fallback = decode_field(record[start:start + field["width"]])
        values[field["name"]] = value
        if used_fallback:
            fallback.append(field["name"])
    return values, fallback


def is_candidate(fields):
    name = fields.get("A9") or ""
    return (fields.get("A29") in {"I", "U"}
            and (fields.get("A8") in {"05000", "Z5000"} or CULTURE in name or ASSEMBLY in name))


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def convert(source, output):
    from osgeo import gdal, ogr, osr
    ogr.UseExceptions()
    gdal.SetConfigOption("SHAPE_ENCODING", "CP949")
    source = source.resolve()
    if source.suffix.lower() != ".shp":
        raise ValueError("--source must point to a .shp file")
    dbf = source.with_suffix(".dbf")
    dataset = ogr.Open(str(source), 0)
    if dataset is None:
        raise ValueError("Could not open source shapefile")
    layer = dataset.GetLayer(0)
    spatial_ref = layer.GetSpatialRef()
    if spatial_ref is None or spatial_ref.GetAuthorityCode(None) != "5186":
        raise ValueError("Expected source EPSG:5186")
    spatial_ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target_ref = osr.SpatialReference()
    target_ref.ImportFromEPSG(4326)
    target_ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(spatial_ref, target_ref)
    features = []
    actions, candidates_by_action, decode_fallbacks = Counter(), Counter(), Counter()
    null_geometries, invalid_geometries, outside_bounds = [], [], []
    numeric_overflow = Counter()
    skipped_dbf_deleted = 0
    with dbf.open("rb") as stream:
        count, header_length, record_length, schema = read_dbf_schema(stream)
        stream.seek(header_length)
        for fid in range(count):
            raw = stream.read(record_length)
            if len(raw) != record_length:
                raise ValueError(f"Truncated source DBF record {fid}")
            fields, fallbacks = decode_record(raw, schema)
            if raw[0] == 0x2A:
                skipped_dbf_deleted += 1
                continue
            actions[fields["A29"] or "(blank)"] += 1
            if not is_candidate(fields):
                continue
            decode_fallbacks.update(fallbacks)
            numeric_overflow.update(field["name"] for field in schema
                                    if field["type"] in ("N", "F")
                                    and fields[field["name"]] is not None
                                    and "*" in fields[field["name"]])
            candidates_by_action[fields["A29"]] += 1
            source_feature = layer.GetFeature(fid)
            geometry = source_feature.GetGeometryRef() if source_feature else None
            wgs = None
            if geometry is not None and not geometry.IsEmpty():
                if not geometry.IsValid():
                    invalid_geometries.append(fid)
                try:
                    point = geometry.PointOnSurface()
                    if point is not None and not point.IsEmpty():
                        point.Transform(transform)
                        x, y = point.GetX(), point.GetY()
                        if math.isfinite(x) and math.isfinite(y):
                            wgs = [round(x, 7), round(y, 7)]
                            if not (124 <= x <= 132 and 32 <= y <= 44):
                                outside_bounds.append(fid)
                except RuntimeError:
                    pass
            if wgs is None:
                null_geometries.append(fid)
            features.append({"type": "Feature", "id": fid,
                             "geometry": {"type": "Point", "coordinates": wgs} if wgs else None,
                             "properties": {"sourceFid": fid, "fields": fields}})
    output.mkdir(parents=True, exist_ok=True)
    data_path = output / "national-cultural-changes.geojson"
    data = {"type": "FeatureCollection", "features": features}
    data_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    inputs = {}
    for suffix in (".shp", ".shx", ".dbf", ".prj", ".cst"):
        path = source.with_suffix(suffix)
        if path.is_file():
            inputs[suffix] = {"name": path.name, "bytes": path.stat().st_size, "sha256": sha256(path)}
    manifest = {
        "version": 1, "source": "CH_D010_00_20261103", "encoding": "EUC-KR with strict CP949 fallback",
        "sourceCrs": "EPSG:5186", "outputCrs": "EPSG:4326", "sourceRecords": count,
        "sourceActions": dict(actions), "sourceDbfDeleted": skipped_dbf_deleted,
        "candidateCount": len(features), "candidateActions": dict(candidates_by_action),
        "filter": "A29 I/U AND (A8 05000/Z5000 OR A9 contains 문화/집회)",
        "fieldSchema": [{k: v for k, v in field.items() if k != "offset"} for field in schema],
        "candidateCp949FallbackFields": dict(decode_fallbacks), "candidateNumericOverflowFields": dict(numeric_overflow),
        "nullGeometryFids": null_geometries, "invalidGeometryFids": invalid_geometries,
        "outsideCoarseKoreaBoundsFids": outside_bounds, "inputs": inputs,
        "output": {"file": data_path.name, "bytes": data_path.stat().st_size, "sha256": sha256(data_path)},
        "note": "Change records only; candidates are not a verified inventory of operating cultural venues."
    }
    (output / "national-cultural-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"candidates": len(features), "actions": dict(actions),
                      "nullGeometry": len(null_geometries), "invalidGeometry": len(invalid_geometries),
                      "outsideCoarseBounds": len(outside_bounds), "outputBytes": data_path.stat().st_size}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="CH_D010_00_20261103.shp")
    parser.add_argument("--output", type=Path, required=True, help="Output directory for GeoJSON and manifest")
    args = parser.parse_args()
    convert(args.source, args.output)


if __name__ == "__main__":
    main()
