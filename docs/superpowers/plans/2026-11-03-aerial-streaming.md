# Aerial proportion and model streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Correct the smaller hall's front-to-back length against the user aerial reference, publish the current Blender details to GLB, and load nearby scene groups progressively.

**Architecture:** Preserve the previous Blender copy and work in `blender_work/20261103/sejong_aerial_streaming_20261103.blend` through live Blender MCP. Export a fixed-origin core and disjoint spatial GLB chunks with a Three.js Y-up bounds manifest. The React viewer loads core first and schedules optional chunks by target and camera distance with hysteresis and delayed disposal.

**Tech Stack:** Blender 5.2 MCP, glTF/Meshopt, React 19, Three.js, Vite, Cloudflare Pages Git integration.

**Spec:** Current exact user request and aerial image archived under `docs/references/`; photo observations in `docs/sitevisit-review/20261103-observations-*.md`.

## Global Constraints

- Preserve the previous `.blend`; never regenerate the whole scene with the old scene scripts.
- New geometry and exports use live Blender MCP. Preserve custom graphics and original photo references; do not crop photo pixels into model textures.
- Interpret 50% as front-to-back depth: main roof envelope Y=-7.0..110.42 =117.42m; annex target depth58.71m, front Y=-5.5 stays fixed and rear becomes53.21m. Model metres are working approximations, not survey measurements.
- Export all GLBs at the same origin, converting Blender `[x,y,z]` to glTF `[x,z,-y]`. Each public asset must stay below Cloudflare Pages' 25MiB limit.
- Keep the existing URLs, Git-connected deployment and no GitHub workflows.

## Review Focus

- Preserve annex front doors, shop banners and central stair alignment while extending its rear depth.
- Resample repeated eaves details instead of leaving visibly stretched gaps; document approximate garden placement.
- No chunk may overlap the core or another chunk; no visible campus object may silently vanish from export.
- Optional loads must not block UI readiness, repeat requests, leak GPU resources, or move the camera when a chunk arrives.
- Check switching views, first-person collision bounds, rapid navigation, failed requests and low-memory unloading.

### Task 1: Preserve references and revise the Blender copy

- [x] Archive the aerial original and verbatim prompt, audit all25 explicitly supplied attachments.
- [x] Capture the current top view; modify only the copied scene's smaller hall envelope and associated details.
- [x] Add a photo-informed garden behind the extended smaller hall, inspect top/oblique renders and the web view, and save geometric measurements.

### Task 2: Export disjoint web assets

- [x] Partition visible `Scene` geometry into building/ground core plus spatial garden, surroundings, interior and fine-detail chunks.
- [x] Export Meshopt GLBs via Blender MCP, preserving origin/materials and high-precision positions.
- [x] Write `public/model/streaming-manifest.json`: `{version:1,core:{url,bounds:{min,max}},chunks:[{id,url,bounds,loadDistance,unloadDistance,shadowDistance,maxViewDistance}]}`.
- [x] Verify node coverage, per-asset sizes and decoded bounds against Blender.
- [x] Share repeated vegetation binary views without changing decoded geometry; verify request cost and byte equality before selecting the optimized manifest.

### Task 3: React distance loading

- [x] Write targeted scheduler tests for concurrent/duplicate loading, near/far hysteresis, delayed unloading, errors and disposal.
- [x] Implement a bounded queue, core-first readiness and periodic spatial evaluation; avoid whole-scene traversal per frame.
- [x] Connect the current GLB manifest, preserve tree instancing, existing views and walking behavior; update changed annex/garden collision bounds.

### Task 4: Verify and publish

- [x] Run the narrow scheduler/navigation tests, then the full existing suite once and production build.
- [x] Inspect browser network requests and visuals at overview, garden and cafe views; confirm new details and far-chunk suppression.
- [ ] Save Blender, record changes/limitations, commit all scoped files and push `main`.
- [ ] Confirm Cloudflare Git deployment and the existing custom domain serve the new manifest and core/chunks.
