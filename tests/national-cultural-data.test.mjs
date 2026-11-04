import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

const base = new URL("../public/data/", import.meta.url);
const bytes = await readFile(new URL("national-cultural-changes.geojson", base));
const data = JSON.parse(bytes);
const manifest = JSON.parse(await readFile(new URL("national-cultural-manifest.json", base), "utf8"));

test("change candidates retain source fields and exclude deletions", () => {
  assert.equal(data.type, "FeatureCollection");
  assert.equal(data.features.length, manifest.candidateCount);
  assert.equal(data.features.length, 347);
  assert.equal(new Set(data.features.map(f => f.id)).size, data.features.length);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.output.sha256);
  for (const feature of data.features) {
    const fields = feature.properties.fields;
    assert.deepEqual(Object.keys(fields), Array.from({length: 31}, (_, i) => `A${i}`));
    assert.ok(["I", "U"].includes(fields.A29));
    assert.ok(Object.values(fields).every(value => value === null || typeof value === "string"));
    if (feature.geometry) {
      assert.equal(feature.geometry.type, "Point");
      assert.equal(feature.geometry.coordinates.length, 2);
      assert.ok(feature.geometry.coordinates.every(Number.isFinite));
    }
  }
});
