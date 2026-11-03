# Spatial Model Streaming Implementation Plan

> **For agentic workers:** Execute the focused tasks below with the test-driven-development and verification-before-completion skills. No Blender, Git publication, or deployment changes belong to this frontend subtask.

**Goal:** Download the central building first, then load detailed district GLBs only where the viewer approaches, and release distant GPU resources.

**Architecture:** A versioned spatial manifest keeps core geometry permanent and exports optional chunks at the same world origin. A bounded queue uses focus-to-footprint distance and real camera-to-bounds distance, hysteresis, cancellation, retry delay, and delayed eviction. The existing viewer owns rendering, walking, presets and model disposal.

**Tech Stack:** Existing React, Three.js GLTFLoader/MeshoptDecoder, browser fetch/AbortController, Node test runner.

**Spec:** Current user request and manifest contract coordinated with the root Blender/export task; `/model/streaming-manifest.json`, version 1, Three.js Y-up bounds.

## Global Constraints

- Keep both building exterior shells and broad base ground in core; optional files retain world transforms.
- One optional download at a time; core reaching ready must not wait for optional assets.
- Orbit uses the chosen controls target; walking uses camera position.
- Camera distance suppresses detail too small to see in overview.
- Preserve existing walk collision, keyboard/touch controls, framing, presets, legacy fallback and original files.
- Resource release must include textures in every material slot and instancing buffers.

## Review Focus

- A far optional chunk must generate no HTTP request until approaching.
- Fast teleport/unmount during a request must abort or dispose its late result.
- Threshold jitter must not repeatedly download the same model.
- Failed optional assets must not block ready state or create a request storm.
- Hidden, retained chunks must not capture double-click focus.

## Task 1: Spatial scheduler and resource ownership

- [x] Write failing tests for actual request timing, queue concurrency, cancellation, hysteresis, retry, cleanup and bounds validation in `tests/modelStreaming.test.js`.
- [x] Implement `src/modelStreaming.js` with manifest validation, distance checks and a cancellable spatial queue; implement focused disposal helpers in `src/modelResources.js`.
- [x] Run the narrow tests and inspect all results.

## Task 2: Viewer integration

- [x] Replace initial whole-district download in `src/main.jsx` with manifest/core boot and optional chunks.
- [x] Keep model root, core framing, shadow budget and input behavior stable; update streaming at 250ms intervals and stop it when hidden/unmounted.
- [x] Add a hidden-object focus regression test before adjusting `src/orbitFocus.js`.
- [x] Run relevant tests, production build, and available browser download verification once real exports exist. Final full suite/build are owned and recorded by root; IAB verification of the shared manifest is recorded in `docs/sitevisit-lazy-loading-20261103.md`.

Root owns final commit/push and live deployment verification.
