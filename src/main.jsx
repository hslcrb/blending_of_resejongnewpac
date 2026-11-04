import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { instanceTreeMeshes } from './treeInstances.js';
import { canWalk } from './walkCollision.js';
import { walkKeyForEvent } from './walkKeys.js';
import { focusOrbitAt } from './orbitFocus.js';
import { rearGroundHeight } from './rearGround.js';
import { surroundingsGroundHeight } from './surroundingsGround.js';
import { surroundingsView } from './surroundingsViews.js';
import { createSpatialModelStreamer, validateStreamManifest } from './modelStreaming.js';
import { disposeModelResources, shouldCastModelShadow } from './modelResources.js';
import { createSlowFrameDetector } from './framePerformance.js';
import { setCampusLayout } from './campusLayout.js';
import { cameraNearPlane } from './cameraClipping.js';
import { seoulSolarPosition, sunDirection, cloudFractionFromMetar } from './skyState.js';
import { createCityLayer, disposeCityLayer } from './cityLayer.js';
import { SEJONG_IN_SEOUL } from './area/coordinates.ts';
import { createBuildingExplorer } from './area/building-explorer.ts';
import { useBuildingInformation, BuildingInformationPanel } from './area/BuildingInformation.jsx';
import NationalCulturalExplorer from './NationalCulturalExplorer.jsx';
import { createBasemapLayer } from './basemapLayer.js';
import { createEmbedBridge } from './embedBridge.js';
import { latLonTo5186, geoToWorld } from './mapProjection.js';
import './style.css';

// GLB의 광장, 정문과 로비에 맞춘 보행 범위입니다. / Walkable plaza, entrance and lobby from the GLB.
const WALK_START = new THREE.Vector3(33.1, 1.7, 27);
const WALK_SPEED = 2;
const WALK_FAST_SPEED = 5;
// Show the surrounding district by default; retain the original model as a fallback.
const SHOW_SURROUNDINGS = new URLSearchParams(window.location.search).get('environment') !== 'legacy';
function groundHeight(x, z) {
    if (SHOW_SURROUNDINGS) {
        const height = surroundingsGroundHeight(x, z);
        if (height !== null) return height;
    }
    const rearHeight = rearGroundHeight(x, z);
    if (rearHeight !== null) return rearHeight;
    // 목재 무대 세 단은 각각 독립된 면 높이를 가집니다. / Walk on the three nested wooden platforms.
    if (x >= -28.5 && x <= -9.5 && z >= 21.8 && z <= 26.2) return 0.66;
    if (x >= -29.5 && x <= -8.5 && z >= 21.1 && z <= 26.9) return 0.44;
    if (x >= -30.5 && x <= -7.5 && z >= 20.4 && z <= 27.6) return 0.22;
    if (x >= -70.6 && x <= -35.35 && z >= 4.25 && z <= 11.95) return 0.107;
    if (x >= -30.54 && x <= -2.32 && z <= 15.19 && z >= 1.86) {
        const step = THREE.MathUtils.clamp(Math.floor((15.19 - z) / 0.37), 0, 35);
        return 0.1404375 + (3.3505658 - 0.1404375) * step / 35;
    }
    if (x >= -30.54 && x <= -2.32 && z < 1.86 && z >= -9.6) return 3.4423;
    if (x >= -5 && x <= 71 && z <= 10.235 && z >= 6.545) {
        const step = THREE.MathUtils.clamp(Math.floor((10.235 - z) / 0.46), 0, 7);
        return 1.3375 * (0.17 + 0.09 * step);
    }
    if (x >= -5 && x <= 71 && z < 6.545 && z >= -11.4) return 1.07;
    return 0;
}

function MoveButton({ direction, label, symbol, setHeld }) {
    const release = () => setHeld(direction, false);
    return (
        <button
            type="button"
            className="move-btn"
            aria-label={label}
            onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setHeld(direction, true);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    setHeld(direction, true);
                }
            }}
            onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') release();
            }}
            onBlur={release}
        >
            <span aria-hidden="true">{symbol}</span>
        </button>
    );
}

function BuildingViewer({ mode, view, viewerRef, onStatusChange, onWeatherChange, area, sight, magnifier, onAreaStatus, onStart, onInspection, onInspectionState, onProjection, mapProvider, onMapStatus, locationRequest }) {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const requestedTools = useRef({ area, sight, magnifier, mapProvider, locationRequest });
    requestedTools.current = { area, sight, magnifier, mapProvider, locationRequest };

    useEffect(() => {
        const container = containerRef.current;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
            onStatusChange('error');
            return undefined;
        }
        let pixelRatio = Math.min(window.devicePixelRatio, 1);
        renderer.setPixelRatio(pixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = false;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.maxPolarAngle = Math.PI * 0.49;
        controls.enablePan = true;
        controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
        controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

        // 절차적 하늘을 시점 중심에 두어 회전과 이동에 공간감을 더합니다. / Camera-centered sky with soft procedural clouds.
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(500, 32, 20),
            new THREE.ShaderMaterial({
                side: THREE.BackSide,
                depthWrite: false,
                uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, daylight: { value: 1 }, cloudAmount: { value: 0.15 } },
                vertexShader: `varying vec3 vDirection;
                    void main() {
                        vDirection = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: `varying vec3 vDirection;
                    uniform vec3 sunDir;
                    uniform float daylight;
                    uniform float cloudAmount;
                    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                    float noise(vec2 p) {
                        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
                        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
                    }
                    float fbm(vec2 p) {
                        float value = 0.0; float weight = 0.5;
                        for (int i = 0; i < 3; i++) { value += noise(p) * weight; p = p * 2.03 + 7.4; weight *= 0.5; }
                        return value;
                    }
                    void main() {
                        vec3 d = normalize(vDirection);
                        float elevation = clamp(d.y * 0.65 + 0.45, 0.05, 1.0);
                        vec3 dayColor = mix(vec3(0.46, 0.72, 0.90), vec3(0.10, 0.37, 0.72), pow(elevation, 0.65));
                        vec3 nightColor = mix(vec3(0.025, 0.045, 0.085), vec3(0.008, 0.018, 0.05), pow(elevation, 0.65));
                        vec3 color = mix(nightColor, dayColor, daylight);
                        vec2 clouds = d.xz / (max(d.y + 0.45, 0.05) + 0.32) * 1.65;
                        float cloud = smoothstep(0.48, 0.69, fbm(clouds + vec2(3.5, 1.8)));
                        cloud *= smoothstep(-0.55, -0.15, d.y) * cloudAmount;
                        color = mix(color, mix(vec3(0.07, 0.09, 0.13), vec3(1.0, 0.99, 0.97), daylight), cloud);
                        float sunlight = pow(max(dot(d, normalize(sunDir)), 0.0), 128.0);
                        color += vec3(0.45, 0.36, 0.23) * sunlight * daylight;
                        gl_FragColor = vec4(color, 1.0);
                        #include <tonemapping_fragment>
                        #include <colorspace_fragment>
                    }`,
            }),
        );
        sky.frustumCulled = false; sky.renderOrder = -10;
        scene.add(sky);
        const ambient = new THREE.HemisphereLight(0xffffff, 0xb3c2bd, 1.3);
        scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xfff7e9, 1.8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.bias = -0.00025;
        sun.shadow.normalBias = 0.04;
        scene.add(sun, sun.target);
        const fill = new THREE.DirectionalLight(0xdcefff, 0.7);
        fill.position.set(-15, 8, -10);
        scene.add(fill);

        let disposed = false;
        let areaNow = 'local';
        let basemap = null;
        const skyAbort = new AbortController();
        const solarVector = new THREE.Vector3(0, 1, 0);
        let observedCloud = null, weatherSequence = 0;
        // [서울 시각과 관측 하늘 / Seoul time and observed sky]
        // 현장과 다른 김포공항 관측임을 화면에 밝히고, 실패 시 임의 구름으로 대체합니다.
        // Identify the nearby airport observation and fall back visibly when it is unavailable.
        const refreshSky = () => {
            const solar = seoulSolarPosition(new Date());
            const direction = sunDirection(solar, areaNow);
            solarVector.set(direction.x, direction.y, direction.z);
            const day = THREE.MathUtils.smoothstep(solar.elevation, -0.12, 0.2);
            sky.material.uniforms.sunDir.value.copy(solarVector);
            sky.material.uniforms.daylight.value = day;
            sky.material.uniforms.cloudAmount.value = observedCloud ?? 0.15;
            basemap?.setBrightness(0.35 + 0.65 * day);
            ambient.intensity = 0.32 + 0.98 * day;
            sun.intensity = Math.max(0, Math.sin(solar.elevation)) * 2.3 * (1 - 0.55 * (observedCloud ?? 0));
            fill.intensity = 0.24 + 0.46 * day;
            sun.position.copy(sun.target.position).addScaledVector(solarVector, 140);
            renderer.shadowMap.needsUpdate = true;
        };
        const refreshWeather = async () => {
            const serial = ++weatherSequence;
            try {
                const response = await fetch('/api/weather', { signal: skyAbort.signal });
                if (!response.ok) throw new Error('weather unavailable');
                const report = await response.json();
                const amount = cloudFractionFromMetar(report);
                if (amount === null || !Number.isFinite(Date.parse(report.observedAt))) throw new Error('unknown clouds');
                if (disposed || serial !== weatherSequence) return;
                observedCloud = amount;
                onWeatherChange({ observedAt: report.observedAt, temperature: report.temperature });
            } catch {
                if (disposed || serial !== weatherSequence) return;
                observedCloud = null;
                onWeatherChange(null);
            }
            refreshSky();
        };
        refreshSky();
        void refreshWeather();
        const skyTimer = window.setInterval(refreshSky, 60000);
        const weatherTimer = window.setInterval(refreshWeather, 600000);
        let frameId;
        let model;
        const detail = new THREE.Group();
        scene.add(detail);
        let city = null, cityPromise = null, areaSequence = 0, focusSequence = 0, explorer = null;
        let locationMarker = null;
        const mapCredit = document.createElement('div');
        mapCredit.className = 'map-attribution'; container.appendChild(mapCredit);
        basemap = createBasemapLayer({ scene, attributionElement: mapCredit, height: -0.4, onStatus: onMapStatus });
        basemap.setProvider(requestedTools.current.mapProvider);
        refreshSky();
        let coreAsset;
        let streamer;
        let viewerVisible = false;
        let lastSpatialUpdate = -Infinity;
        let startedLoading = false;
        const bootRequest = new AbortController();
        const shadowFocus = new THREE.Vector3(Infinity, Infinity, Infinity);
        let modeNow = 'orbit';
        let activePreset = 'perspective';
        let userAdjusted = false;
        let gestureActive = false;
        let savedOrbit = null;
        let yaw = 0;
        let pitch = 0.1;
        let lastTime = 0;
        const slowFrames = createSlowFrameDetector();
        let dragging = null;
        const held = new Set();
        const touchHeld = new Set();

        controls.addEventListener('start', () => { gestureActive = true; });
        controls.addEventListener('end', () => { gestureActive = false; });
        controls.addEventListener('change', () => {
            if (gestureActive) userAdjusted = true;
        });

        const resize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (!width || !height) return;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            if (modeNow === 'orbit' && sceneRef.current?.size && !userAdjusted && !gestureActive) {
                sceneRef.current.fitView(activePreset);
            }
        };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();

        const fitView = (name) => {
            if (!sceneRef.current?.size || modeNow !== 'orbit') return;
            if (areaNow === 'seoul') { resetArea(); return; }
            activePreset = name;
            userAdjusted = false;
            if (SHOW_SURROUNDINGS) {
                // The distant street buildings should not hide the center at startup.
                const preset = surroundingsView(name, camera.aspect);
                const damping = controls.enableDamping;
                controls.enableDamping = false;
                controls.update();
                camera.position.fromArray(preset.position);
                controls.target.fromArray(preset.target);
                controls.update();
                controls.enableDamping = damping;
                return;
            }
            const { framePoints, center } = sceneRef.current;
            const direction = (name === 'front'
                ? new THREE.Vector3(0, 0.08, 1)
                : name === 'rear'
                    ? new THREE.Vector3(-0.38, 0.30, -1)
                    : new THREE.Vector3(0.38, 0.24, 1)).normalize();
            const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
            const up = new THREE.Vector3().crossVectors(direction, right).normalize();
            const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
            const tanHorizontal = tanVertical * camera.aspect;
            let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
            for (const point of framePoints) {
                const x = point.dot(right);
                const y = point.dot(up);
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
            // 실제 건축물의 투영 중심을 맞춰 빈 공간을 줄입니다. / Center the projected model, not the enclosing box.
            const target = center.clone()
                .addScaledVector(right, (minX + maxX) / 2 - center.dot(right))
                .addScaledVector(up, (minY + maxY) / 2 - center.dot(up));
            let distance = 0;
            for (const point of framePoints) {
                const depth = point.dot(direction) - target.dot(direction);
                const x = point.dot(right) - target.dot(right);
                const y = point.dot(up) - target.dot(up);
                distance = Math.max(distance, depth + Math.abs(x) / tanHorizontal, depth + Math.abs(y) / tanVertical);
            }
            const damping = controls.enableDamping;
            controls.enableDamping = false;
            controls.update();
            camera.position.copy(target).add(direction.multiplyScalar(distance * 1.1));
            controls.target.copy(target);
            controls.update();
            controls.enableDamping = damping;
        };

        const resetWalk = () => {
            camera.position.copy(WALK_START);
            yaw = 0;
            pitch = 0.1;
            camera.rotation.set(pitch, yaw, 0, 'YXZ');
            held.clear();
            touchHeld.clear();
            container.focus({ preventScroll: true });
        };

        const setMode = (next) => {
            if (next === modeNow || !sceneRef.current?.size) return;
            held.clear();
            touchHeld.clear();
            dragging = null;
            if (next === 'walk') {
                savedOrbit = { position: camera.position.clone(), target: controls.target.clone(), preset: activePreset, adjusted: userAdjusted };
                modeNow = 'walk';
                controls.enabled = false;
                camera.fov = 58;
                camera.updateProjectionMatrix();
                resetWalk();
                container.focus({ preventScroll: true });
            } else {
                modeNow = 'orbit';
                controls.enabled = true;
                camera.fov = 35;
                camera.updateProjectionMatrix();
                if (savedOrbit) {
                    camera.position.copy(savedOrbit.position);
                    controls.target.copy(savedOrbit.target);
                    activePreset = savedOrbit.preset;
                    userAdjusted = savedOrbit.adjusted;
                    controls.update();
                } else {
                    fitView('perspective');
                }
            }
        };

        const handleKeyDown = (event) => {
            if (!sceneRef.current?.size) return;
            if (modeNow === 'walk') {
                const key = walkKeyForEvent(event);
                if (key === 'shift') {
                    held.add(key);
                } else if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                    if (event.shiftKey) held.add('shift');
                    held.add(key);
                    event.preventDefault();
                }
                return;
            }
            if (event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                userAdjusted = true;
                const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
                const vertical = event.key === 'ArrowDown' ? -1 : event.key === 'ArrowUp' ? 1 : 0;
                const offset = new THREE.Vector3(horizontal, vertical, 0)
                    .applyQuaternion(camera.quaternion)
                    .multiplyScalar(controls.getDistance() * 0.045);
                camera.position.add(offset);
                controls.target.add(offset);
                controls.update();
                event.preventDefault();
                return;
            }
            const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
            if (event.key === 'ArrowLeft') orbit.theta -= 0.12;
            else if (event.key === 'ArrowRight') orbit.theta += 0.12;
            else if (event.key === 'ArrowUp') orbit.phi -= 0.12;
            else if (event.key === 'ArrowDown') orbit.phi += 0.12;
            else if (event.key === '+' || event.key === '=') orbit.radius *= 0.9;
            else if (event.key === '-') orbit.radius *= 1.1;
            else return;
            userAdjusted = true;
            event.preventDefault();
            orbit.phi = THREE.MathUtils.clamp(orbit.phi, 0.05, controls.maxPolarAngle);
            orbit.radius = THREE.MathUtils.clamp(orbit.radius, controls.minDistance, controls.maxDistance);
            camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(orbit));
            controls.update();
        };
        const handleKeyUp = (event) => held.delete(walkKeyForEvent(event));
        const clearInput = () => { held.clear(); touchHeld.clear(); dragging = null; };
        const setHeld = (direction, down) => {
            if (down) touchHeld.add(direction);
            else touchHeld.delete(direction);
        };
        const pointerDown = (event) => {
            if (modeNow !== 'walk' || dragging || (event.pointerType === 'mouse' && event.button !== 0)) return;
            dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
            renderer.domElement.setPointerCapture(event.pointerId);
            container.focus({ preventScroll: true });
        };
        const pointerMove = (event) => {
            if (modeNow !== 'walk' || dragging?.id !== event.pointerId) return;
            yaw -= (event.clientX - dragging.x) * 0.0035;
            pitch = THREE.MathUtils.clamp(pitch - (event.clientY - dragging.y) * 0.0035, -1.2, 1.2);
            dragging.x = event.clientX;
            dragging.y = event.clientY;
            camera.rotation.set(pitch, yaw, 0, 'YXZ');
        };
        const pointerEnd = (event) => {
            if (dragging?.id === event.pointerId) dragging = null;
        };
        const focusOnDoubleClick = (event) => {
            if (modeNow !== 'orbit' || !model) return;
            if (focusOrbitAt({
                camera, controls, model, clientX: event.clientX, clientY: event.clientY,
                rect: renderer.domElement.getBoundingClientRect(),
            })) {
                userAdjusted = true;
            }
        };
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointermove', pointerMove);
        renderer.domElement.addEventListener('pointerup', pointerEnd);
        renderer.domElement.addEventListener('pointercancel', pointerEnd);
        renderer.domElement.addEventListener('dblclick', focusOnDoubleClick);
        window.addEventListener('blur', clearInput);
        const onPageVisibility = () => {
            clearInput();
            slowFrames.sample(performance.now(), false);
            streamer?.setPaused(document.hidden || !viewerVisible);
            if (!document.hidden) { refreshSky(); void refreshWeather(); }
        };
        document.addEventListener('visibilitychange', onPageVisibility);

        const onContextLost = (event) => {
            event.preventDefault();
            onStatusChange('error');
        };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost);

        // [광화문과 서울 전환 / Switch between campus and Seoul]
        // 같은 상세 모형의 좌표를 변환하고 서울 격자는 처음 선택할 때만 불러옵니다.
        // Transform the same detailed campus and lazily load the Seoul grid.
        const resetArea = () => {
            if (areaNow === 'seoul') {
                controls.target.set(-450, 0, -1700);
                camera.near = 30; camera.far = 180000;
                camera.position.set(18000, 42000, 25000);
                camera.position.sub(controls.target).multiplyScalar(Math.max(1, 1.05 / camera.aspect)).add(controls.target);
                controls.minDistance = 400; controls.maxDistance = 140000;
                camera.updateProjectionMatrix(); controls.update();
            } else {
                camera.far = 2000; controls.minDistance = 2.5; controls.maxDistance = 1000;
                camera.updateProjectionMatrix(); fitView('perspective');
            }
        };
        const setAreaView = async (next, preserveFocus = false) => {
            if (!model) return;
            if (!preserveFocus) focusSequence++;
            const serial = ++areaSequence;
            areaNow = next;
            if (modeNow === 'walk') setMode('orbit');
            if (city) city.visible = next === 'seoul';
            if (locationMarker) locationMarker.visible = next === 'seoul';
            detail.rotation.y = next === 'seoul' ? SEJONG_IN_SEOUL.rotationY : 0;
            detail.position.set(next === 'seoul' ? SEJONG_IN_SEOUL.x : 0, 0, next === 'seoul' ? SEJONG_IN_SEOUL.z : 0);
            detail.updateMatrixWorld(true);
            refreshSky(); resetArea(); explorer?.modeChanged();
            if (next === 'local') { onAreaStatus('세종문화회관과 광화문 주변'); return true; }
            onAreaStatus('서울 전역을 불러오고 있습니다.');
            try {
                if (!cityPromise) cityPromise = fetch('/area/seoul-grid.json', {signal:bootRequest.signal}).then(async response => {
                    if (!response.ok) throw new Error('grid request failed');
                    const data = await response.json();
                    if (data.cells?.length !== 123626) throw new Error('invalid grid count');
                    return createCityLayer(data);
                }).catch(error => { cityPromise = null; throw error; });
                const loaded = await cityPromise;
                if (disposed) { disposeCityLayer(loaded); return; }
                if (!city) { city = loaded; scene.add(city); }
                city.visible = areaNow === 'seoul';
                if (serial === areaSequence && areaNow === 'seoul') { onAreaStatus('서울 전역과 광화문 주변'); return true; }
                return false;
            } catch (error) {
                if (!disposed && serial === areaSequence && error.name !== 'AbortError') onAreaStatus('서울 격자를 불러오지 못했습니다. 다시 불러와 주세요.');
                return false;
            }
        };
        const setTools = (show, inspect) => explorer?.configure(show, inspect);
        const focusLocation = async (coordinates) => {
            if (!model || !Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) return;
            const serial = ++focusSequence;
            const gridReady = await setAreaView('seoul', true);
            if (disposed || areaNow !== 'seoul' || serial !== focusSequence) return;
            const {easting, northing} = latLonTo5186(coordinates[0], coordinates[1]);
            const position = geoToWorld('seoul', easting, northing);
            controls.target.set(position.x, 0, position.z);
            camera.position.set(position.x + 600, 1100, position.z + 800);
            controls.minDistance = 40; controls.update();
            userAdjusted = true;
            if (!locationMarker) {
                locationMarker = new THREE.Mesh(new THREE.SphereGeometry(35, 16, 12), new THREE.MeshBasicMaterial({color:0xe24527}));
                scene.add(locationMarker);
            }
            locationMarker.position.set(position.x, 40, position.z);
            onAreaStatus(gridReady ? '문화시설 변경 후보의 대표 위치 · 실제 출입구와 다를 수 있습니다.' : '서울 격자를 불러오지 못했습니다. 후보 위치는 지도에 표시합니다.');
            basemap?.update(camera, {width:container.clientWidth,height:container.clientHeight,mode:areaNow});
        };
        sceneRef.current = { fitView, setMode, resetWalk, handleKeyDown, handleKeyUp, clearInput, setHeld, setAreaView, setTools, focusLocation, setMapProvider: value => basemap?.setProvider(value), retryMap: () => basemap?.retry(), inspectCenter: () => explorer?.center() };
        viewerRef.current = sceneRef.current;

        // 주 건물은 먼저, 주변 세부는 공간별로 내려받습니다. / Load core first and stream spatial detail separately.
        let loaderPromise;
        const getLoader = () => {
            loaderPromise ??= Promise.all([
                import('three/addons/loaders/GLTFLoader.js'),
                import('three/addons/libs/meshopt_decoder.module.js'),
            ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
            return loaderPromise;
        };
        const loadGltf = async (url, { signal }) => {
            const [bytes, loader] = await Promise.all([
                fetch(url, { signal }).then((response) => {
                    if (!response.ok) throw new Error(`Model request failed (${response.status})`);
                    return response.arrayBuffer();
                }),
                getLoader(),
            ]);
            signal.throwIfAborted();
            const gltf = await loader.parseAsync(bytes, new URL('.', new URL(url, window.location.href)).href);
            if (signal.aborted) { disposeModelResources(gltf.scene); signal.throwIfAborted(); }
            return gltf;
        };
        const prepareAsset = (gltf) => {
            const root = gltf.scene;
            const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
            const sampledTextures = new Set();
            root.traverse((object) => {
                if (!object.isMesh) return;
                object.receiveShadow = true;
                object.castShadow = false;
                object.frustumCulled = true;
                for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                    if (!material) continue;
                    for (const texture of Object.values(material)) {
                        if (!texture?.isTexture || sampledTextures.has(texture)) continue;
                        sampledTextures.add(texture);
                        texture.anisotropy = anisotropy;
                        texture.needsUpdate = true;
                    }
                }
            });
            instanceTreeMeshes(root, { animations: gltf.animations });
            root.updateWorldMatrix(true, true);
            const casters = [];
            root.traverse((mesh) => {
                if (!mesh.isMesh) return;
                const bounds = new THREE.Box3().setFromObject(mesh);
                if (shouldCastModelShadow(mesh, bounds)) casters.push({ mesh, bounds });
            });
            return {
                root,
                setShadows(enabled) { for (const { mesh } of casters) mesh.castShadow = enabled; },
                updateCoreShadows(point) {
                    let changed = false;
                    for (const { mesh, bounds } of casters) {
                        const enabled = bounds.distanceToPoint(point) <= 75;
                        if (mesh.castShadow !== enabled) { mesh.castShadow = enabled; changed = true; }
                    }
                    return changed;
                },
                dispose() { disposeModelResources(root); },
            };
        };
        const installCore = (asset, focusBounds = null) => {
            coreAsset = asset;
            model = new THREE.Group();
            model.name = 'Sejong spatial district';
            model.userData.inspectionModel = true;
            model.add(asset.root);
            detail.add(model);
            explorer = createBuildingExplorer({host:container,element:renderer.domElement,camera,controls,detail,city:() => city,mode:() => areaNow,draw:() => {},onStart,onInspection,onState:onInspectionState,onProjection});
            explorer.configure(requestedTools.current.sight, requestedTools.current.magnifier);
            const bounds = new THREE.Box3();
            const framePoints = [];
            const sample = new THREE.Vector3();
            if (!focusBounds) asset.root.traverse((object) => {
                if (!object.isMesh || /^(ground|line)$/i.test(object.name)) return;
                const objectBounds = new THREE.Box3().setFromObject(object);
                bounds.union(objectBounds);
                if (SHOW_SURROUNDINGS) {
                    for (const x of [objectBounds.min.x, objectBounds.max.x]) {
                        for (const y of [objectBounds.min.y, objectBounds.max.y]) {
                            for (const z of [objectBounds.min.z, objectBounds.max.z]) framePoints.push(new THREE.Vector3(x, y, z));
                        }
                    }
                    return;
                }
                const positions = object.geometry.attributes.position;
                if (!positions) return;
                const stride = Math.max(1, Math.floor(positions.count / 20000));
                for (let i = 0; i < positions.count; i += stride) {
                    sample.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                    framePoints.push(sample.clone());
                }
            });
            if (focusBounds) {
                bounds.min.fromArray(focusBounds.min);
                bounds.max.fromArray(focusBounds.max);
                for (const x of [bounds.min.x, bounds.max.x]) {
                    for (const y of [bounds.min.y, bounds.max.y]) {
                        for (const z of [bounds.min.z, bounds.max.z]) framePoints.push(new THREE.Vector3(x, y, z));
                    }
                }
            }
            if (bounds.isEmpty()) bounds.setFromObject(model);
            const size = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            const radius = Math.max(size.x, size.y, size.z, 1);
            sun.target.position.copy(center);
            sun.position.copy(center).addScaledVector(solarVector, 140);
            const shadowCamera = sun.shadow.camera;
            shadowCamera.left = -75;
            shadowCamera.right = 75;
            shadowCamera.top = 75;
            shadowCamera.bottom = -75;
            shadowCamera.near = 1;
            shadowCamera.far = 280;
            shadowCamera.updateProjectionMatrix();
            renderer.shadowMap.needsUpdate = true;
            camera.near = SHOW_SURROUNDINGS ? 0.1 : radius / 1000;
            camera.far = SHOW_SURROUNDINGS ? 2000 : radius * 100;
            camera.updateProjectionMatrix();
            controls.minDistance = SHOW_SURROUNDINGS ? 2.5 : radius * 0.06;
            controls.maxDistance = SHOW_SURROUNDINGS ? 1000 : radius * 6;
            Object.assign(sceneRef.current, { bounds, framePoints, size, center, radius });
            fitView('perspective');
            if (requestedTools.current.area === 'seoul' && requestedTools.current.locationRequest) void focusLocation(requestedTools.current.locationRequest.coordinates);
            else if (requestedTools.current.area !== 'local') void setAreaView(requestedTools.current.area);
            else onAreaStatus('세종문화회관과 광화문 주변');
            onStatusChange('ready');
        };
        const bootModels = async () => {
            if (startedLoading || disposed) return;
            startedLoading = true;
            try {
                let manifest = null;
                if (SHOW_SURROUNDINGS) {
                    try {
                        const [response] = await Promise.all([
                            fetch('/model/streaming-manifest.json', { signal: bootRequest.signal }),
                            fetch('/model/campus-layout.json', { signal: bootRequest.signal }).then(async (layoutResponse) => {
                                if (layoutResponse.ok) setCampusLayout(await layoutResponse.json());
                            }).catch(() => {}),
                        ]);
                        if (response.ok) manifest = validateStreamManifest(await response.json());
                    } catch (error) { if (error.name === 'AbortError') throw error; }
                }
                const coreUrl = manifest?.core.url || (SHOW_SURROUNDINGS ? '/model/sejong_surroundings_latest.glb' : '/model/sejong_sitevisit_refined.glb');
                const gltf = await loadGltf(coreUrl, { signal: bootRequest.signal });
                if (disposed) { disposeModelResources(gltf.scene); return; }
                installCore(prepareAsset(gltf), manifest?.focusBounds);
                if (manifest) {
                    streamer = createSpatialModelStreamer({
                        chunks: manifest.chunks,
                        load: async (url, options) => prepareAsset(await loadGltf(url, options)),
                        attach: (asset) => { model.add(asset.root); asset.root.updateWorldMatrix(true, true); },
                        onChange: () => { renderer.shadowMap.needsUpdate = true; },
                    });
                    streamer.setPaused(document.hidden || !viewerVisible);
                    sceneRef.current.getStreamingStats = () => streamer.snapshot();
                }
            } catch (error) {
                if (!disposed && error.name !== 'AbortError') onStatusChange('error');
            }
        };
        // 화면 밖에서는 다운로드와 GPU 렌더링을 쉬게 합니다. / Defer offscreen downloads and pause GPU rendering.
        const visibilityObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
            viewerVisible = entry.isIntersecting;
            streamer?.setPaused(document.hidden || !viewerVisible);
            if (viewerVisible) bootModels();
            else { clearInput(); slowFrames.sample(performance.now(), false); }
        }, { rootMargin: '320px' }) : null;
        if (visibilityObserver) visibilityObserver.observe(container);
        else { viewerVisible = true; bootModels(); }

        const animate = (time) => {
            const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.2) : 0;
            lastTime = time;
            if (!viewerVisible || document.hidden) {
                slowFrames.sample(time, false);
                frameId = requestAnimationFrame(animate);
                return;
            }
            // 낮은 프레임이 지속되는 기기에서만 해상도를 줄입니다. / Reduce pixel load only when slow frames persist.
            if (pixelRatio > 0.75 && slowFrames.sample(time)) {
                pixelRatio = 0.75;
                renderer.setPixelRatio(pixelRatio);
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
            if (modeNow === 'walk') {
                const turn = (held.has('arrowleft') ? 1 : 0) - (held.has('arrowright') ? 1 : 0);
                yaw += turn * dt * 1.55;
                const forward = (held.has('w') || held.has('arrowup') || touchHeld.has('forward') ? 1 : 0)
                    - (held.has('s') || held.has('arrowdown') || touchHeld.has('back') ? 1 : 0);
                const side = (held.has('d') || touchHeld.has('right') ? 1 : 0)
                    - (held.has('a') || touchHeld.has('left') ? 1 : 0);
                if (forward || side) {
                    const direction = new THREE.Vector3(-Math.sin(yaw) * forward + Math.cos(yaw) * side, 0, -Math.cos(yaw) * forward - Math.sin(yaw) * side).normalize();
                    // 걷기와 빠른 이동 모두 작은 단위로 나눠 충돌을 확인합니다. / Substep both walking speeds for collision checks.
                    const speed = held.has('shift') ? WALK_FAST_SPEED : WALK_SPEED;
                    const steps = Math.max(1, Math.ceil(dt * speed / 0.25));
                    const dx = direction.x * dt * speed / steps;
                    const dz = direction.z * dt * speed / steps;
                    for (let i = 0; i < steps; i += 1) {
                        if (canWalk(camera.position.x + dx, camera.position.z, SHOW_SURROUNDINGS)) camera.position.x += dx;
                        if (canWalk(camera.position.x, camera.position.z + dz, SHOW_SURROUNDINGS)) camera.position.z += dz;
                    }
                }
                camera.position.y = groundHeight(camera.position.x, camera.position.z) + 1.7;
                camera.rotation.set(pitch, yaw, 0, 'YXZ');
            } else {
                controls.update();
            }
            if (SHOW_SURROUNDINGS) {
                const near = areaNow === 'seoul' ? Math.max(30, controls.getDistance() / 4000) : cameraNearPlane(modeNow, controls.getDistance());
                if (Math.abs(camera.near - near) > near * 0.05) {
                    camera.near = near;
                    camera.updateProjectionMatrix();
                }
            }
            if (model && time - lastSpatialUpdate >= 250) {
                lastSpatialUpdate = time;
                const focus = modeNow === 'walk' ? camera.position : controls.target;
                const localFocus = detail.worldToLocal(focus.clone());
                const localCamera = detail.worldToLocal(camera.position.clone());
                streamer?.update(localFocus, { cameraPosition: localCamera, now: time });
                basemap?.update(camera, {width:container.clientWidth,height:container.clientHeight,mode:areaNow});
                if (coreAsset.updateCoreShadows(localCamera)) renderer.shadowMap.needsUpdate = true;
                if (focus.distanceToSquared(shadowFocus) > 36) {
                    shadowFocus.copy(focus);
                    sun.target.position.copy(focus);
                    sun.position.copy(focus).addScaledVector(solarVector, 140);
                    renderer.shadowMap.needsUpdate = true;
                }
            }
            sky.position.copy(camera.position);
            renderer.render(scene, camera);
            explorer?.paint();
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);

        return () => {
            disposed = true;
            bootRequest.abort();
            skyAbort.abort();
            window.clearInterval(skyTimer);
            window.clearInterval(weatherTimer);
            streamer?.dispose();
            explorer?.dispose();
            basemap?.dispose(); mapCredit.remove();
            if (locationMarker) { locationMarker.geometry.dispose(); locationMarker.material.dispose(); locationMarker.removeFromParent(); }
            if (city) disposeCityLayer(city);
            setCampusLayout(null);
            cancelAnimationFrame(frameId);
            observer.disconnect();
            visibilityObserver?.disconnect();
            controls.dispose();
            sky.geometry.dispose();
            sky.material.dispose();
            renderer.domElement.removeEventListener('pointerdown', pointerDown);
            renderer.domElement.removeEventListener('pointermove', pointerMove);
            renderer.domElement.removeEventListener('pointerup', pointerEnd);
            renderer.domElement.removeEventListener('pointercancel', pointerEnd);
            renderer.domElement.removeEventListener('dblclick', focusOnDoubleClick);
            renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
            window.removeEventListener('blur', clearInput);
            document.removeEventListener('visibilitychange', onPageVisibility);
            coreAsset?.dispose();
            model?.removeFromParent();
            sun.shadow.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            viewerRef.current = null;
        };
    }, [onStatusChange, onWeatherChange, onAreaStatus, onStart, onInspection, onInspectionState, onProjection, onMapStatus, viewerRef]);

    useEffect(() => { sceneRef.current?.setAreaView(area); }, [area]);
    useEffect(() => { sceneRef.current?.setMapProvider(mapProvider); }, [mapProvider]);
    useEffect(() => { if (locationRequest) void sceneRef.current?.focusLocation(locationRequest.coordinates); }, [locationRequest]);
    useEffect(() => { sceneRef.current?.setTools(sight, magnifier); }, [sight, magnifier]);
    useEffect(() => { sceneRef.current?.setMode(mode); }, [mode]);
    useEffect(() => { sceneRef.current?.fitView(view.name); }, [view]);

    return (
        <>
            <div
                className="viewer-canvas"
                ref={containerRef}
                tabIndex={0}
                role="group"
                onKeyDown={(event) => sceneRef.current?.handleKeyDown(event)}
                onKeyUp={(event) => sceneRef.current?.handleKeyUp(event)}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) sceneRef.current?.clearInput(); }}
                aria-label={mode === 'walk' ? '광장과 로비 걷기. WASD로 이동하고 방향키로 전진과 회전, Shift를 함께 누르면 빠르게 이동합니다. 화면을 드래그해 둘러봅니다.' : '건축 모형. 드래그 또는 방향키로 회전하고 스크롤로 확대합니다.'}
            />
            {mode === 'walk' && (
                <div className="walk-pad" aria-label="걷기 이동 조작">
                    <span className="pad-spacer" />
                    <MoveButton direction="forward" label="앞으로 이동" symbol="↑" setHeld={(key, down) => sceneRef.current?.setHeld(key, down)} />
                    <span className="pad-spacer" />
                    <MoveButton direction="left" label="왼쪽으로 이동" symbol="←" setHeld={(key, down) => sceneRef.current?.setHeld(key, down)} />
                    <MoveButton direction="back" label="뒤로 이동" symbol="↓" setHeld={(key, down) => sceneRef.current?.setHeld(key, down)} />
                    <MoveButton direction="right" label="오른쪽으로 이동" symbol="→" setHeld={(key, down) => sceneRef.current?.setHeld(key, down)} />
                </div>
            )}
        </>
    );
}

function App() {
    const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
    useEffect(() => {
        if (!embedded || window.parent === window) return undefined;
        const root = document.querySelector('.app-shell.embedded');
        return root ? createEmbedBridge({ root, parent: window.parent }) : undefined;
    }, [embedded]);
    const [status, setStatus] = useState('loading');
    const [area, setArea] = useState('local');
    const [areaStatus, setAreaStatus] = useState('');
    const [sight, setSight] = useState(false);
    const [magnifier, setMagnifier] = useState(false);
    const info = useBuildingInformation();
    const [projection, setProjection] = useState('');
    const [mapProvider, setMapProvider] = useState('ground');
    const [mapStatus, setMapStatus] = useState({failed:0});
    const [locationRequest, setLocationRequest] = useState(null);
    const onMapStatus = useCallback(value => setMapStatus(value), []);
    const selectNational = useCallback(value => { setMode('orbit'); setArea('seoul'); setMapProvider('ground'); setLocationRequest({coordinates:value.coordinates}); experienceRef.current?.scrollIntoView({behavior:'smooth',block:'start'}); }, []);
    const [weather, setWeather] = useState(null);
    const [clock, setClock] = useState(() => new Date());
    useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 60000); return () => window.clearInterval(timer); }, []);
    const seoulTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(clock);
    const observedTime = weather ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(weather.observedAt)) : null;
    const [mode, setMode] = useState('orbit');
    const [view, setView] = useState({ name: 'perspective' });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenError, setFullscreenError] = useState('');
    const experienceRef = useRef(null);
    const viewerRef = useRef(null);
    const ready = status === 'ready';
    const fullscreenAvailable = document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';

    // 브라우저의 Escape 종료도 상태에 반영합니다. / Sync browser-driven fullscreen exits.
    useEffect(() => {
        const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === experienceRef.current);
        const exitOnEscape = (event) => {
            if (event.key !== 'Escape' || document.fullscreenElement !== experienceRef.current) return;
            document.exitFullscreen().catch(() => {
                if (document.fullscreenElement === experienceRef.current) {
                    setFullscreenError('전체 화면을 닫을 수 없습니다. 브라우저의 종료 기능을 사용해 주세요.');
                }
            });
        };
        document.addEventListener('fullscreenchange', syncFullscreen);
        document.addEventListener('keydown', exitOnEscape);
        return () => {
            document.removeEventListener('fullscreenchange', syncFullscreen);
            document.removeEventListener('keydown', exitOnEscape);
        };
    }, []);

    const toggleFullscreen = async () => {
        setFullscreenError('');
        try {
            if (document.fullscreenElement === experienceRef.current) {
                await document.exitFullscreen();
            } else {
                await experienceRef.current?.requestFullscreen();
            }
        } catch {
            setFullscreenError('전체 화면을 열 수 없습니다. 브라우저 설정을 확인해 주세요.');
        }
    };

    return (
        <div className={`app-shell${embedded ? ' embedded' : ''}`}>
            <header className="site-header">
                <a className="brand" href="#top" aria-label="세종문화회관 건축 산책 처음으로">
                    <span className="brand-mark" aria-hidden="true"><span /></span>
                    <span><strong>세종문화회관</strong><small>ARCHITECTURE WALK</small></span>
                </a>
                <span className="header-location"><span /> SEOUL · GWANGHWAMUN</span>
            </header>

            <main id="top" className="main-content">
                <section className="intro" aria-labelledby="page-title">
                    <div className="intro-main">
                        <p className="eyebrow"><span /> SEJONG CENTER FOR THE PERFORMING ARTS</p>
                        <h1 id="page-title">도시의 중심에서,<br /><em>건축을 걷다.</em></h1>
                        <p className="intro-copy">익숙한 광장의 풍경을 새로운 시선으로.<br />세종문화회관의 외관을 가까이에서 둘러보세요.</p>
                    </div>
                    <div className="intro-aside">
                        <span className="aside-number">건축 산책</span>
                        <span className="aside-line" />
                        <p>지붕의 선과 열주,<br />광장에서 만나는 건축</p>
                    </div>
                </section>

                <section className="experience" ref={experienceRef} aria-labelledby="viewer-title">
                    <div className="experience-top">
                        <div className="experience-title">
                            <span className="status-dot" />
                            <div><small>EXPLORE IN 3D</small><h2 id="viewer-title">세종문화회관 둘러보기</h2></div>
                        </div>
                        <div className="experience-controls">
                            <div className="mode-switch" role="group" aria-label="둘러보기 방식">
                                <button type="button" aria-pressed={mode === 'orbit'} disabled={!ready} onClick={() => setMode('orbit')}><span aria-hidden="true">◉</span> 모형 보기</button>
                                <button type="button" aria-pressed={mode === 'walk'} disabled={!ready || area === 'seoul'} onClick={() => { setMagnifier(false); setMode('walk'); }}><span aria-hidden="true">↟</span> 직접 걷기</button>
                            </div>
                            {fullscreenAvailable && (
                                <button
                                    type="button"
                                    className="fullscreen-btn"
                                    disabled={!ready}
                                    onClick={toggleFullscreen}
                                >
                                    <span aria-hidden="true">{isFullscreen ? '⊟' : '⛶'}</span>
                                    {isFullscreen ? '전체 화면 닫기' : '전체 화면'}
                                </button>
                            )}
                        </div>
                    </div>
                    {fullscreenError && <p className="fullscreen-error" role="alert">{fullscreenError}</p>}
                    <div className="area-toolbox" role="group" aria-label="지도와 건물 정보">
                        <button type="button" aria-pressed={area === 'local'} disabled={!ready} onClick={() => setArea('local')}>광화문 주변</button>
                        <button type="button" aria-pressed={area === 'seoul'} disabled={!ready} onClick={() => { setMode('orbit'); setArea('seoul'); }}>서울 전역</button>
                        <button type="button" aria-pressed={magnifier} disabled={!ready} onClick={() => { setMode('orbit'); setMagnifier(value => !value); }}>돋보기</button>
                        <button type="button" aria-pressed={sight} disabled={!ready} onClick={() => setSight(value => !value)}>전시천리안 (全視千里眼)</button>
                        <button type="button" disabled={!ready} onClick={() => { info.resetSelection(); viewerRef.current?.inspectCenter(); }}>현재 중심 건물 조회</button>
                        <button type="button" aria-pressed={mapProvider === 'ground'} onClick={() => setMapProvider('ground')}>지면지도</button>
                        <button type="button" aria-pressed={mapProvider === 'satellite'} onClick={() => setMapProvider('satellite')}>위성지도</button>
                        <button type="button" aria-pressed={mapProvider === null} onClick={() => setMapProvider(null)}>지도 끄기</button>
                    </div>
                    <p className="area-tool-state" role="status" aria-live="polite">{areaStatus}</p>
                    {areaStatus.includes('서울 격자를 불러오지 못했습니다') && <button type="button" onClick={() => viewerRef.current?.setAreaView('seoul')}>서울 격자 다시 불러오기</button>}
                    <p className="area-tool-state" role="status" aria-live="polite">{info.inspectionState.message}</p>
                    <p className="area-tool-state" role="status" aria-live="polite">{projection}</p>
                    {mapStatus.failed > 0 && <p className="area-tool-state" role="status">지도 일부를 불러오지 못했습니다. <button type="button" onClick={() => viewerRef.current?.retryMap()}>지도 다시 불러오기</button></p>}
                    <div className="view-frame">
                        <BuildingViewer mode={mode} view={view} viewerRef={viewerRef} onStatusChange={setStatus} onWeatherChange={setWeather} area={area} sight={sight} magnifier={magnifier} onAreaStatus={setAreaStatus} onStart={info.onStart} onInspection={info.onInspection} onInspectionState={info.onState} onProjection={setProjection} mapProvider={mapProvider} onMapStatus={onMapStatus} locationRequest={locationRequest} />
                        {status !== 'ready' && (
                            <div className="viewer-status" role="status">
                                <span>{status === 'loading' ? '건축 모델을 불러오는 중입니다.' : '모델을 불러오지 못했습니다.'}</span>
                                {status === 'error' && <button type="button" onClick={() => window.location.reload()}>다시 불러오기</button>}
                            </div>
                        )}
                        <div className="viewer-label" aria-hidden="true"><span>{mode === 'walk' ? 'GROUND WALK' : 'ARCHITECTURE MODEL'}</span><strong>{mode === 'walk' ? '광장을 걷는 시선' : '세종문화회관'}</strong></div>
                        <div className="view-actions">
                            {mode === 'orbit' && area === 'local' && <>
                                <button type="button" disabled={!ready} onClick={() => setView({ name: 'front' })}>정면 보기</button>
                                <button type="button" disabled={!ready} onClick={() => setView({ name: 'rear' })}>뒷면 보기</button>
                            </>}
                            <button type="button" disabled={!ready} onClick={() => mode === 'walk' ? viewerRef.current?.resetWalk() : setView({ name: 'perspective' })}>{mode === 'walk' ? '시작 위치' : '처음 시점'}</button>
                        </div>
                        <p className="viewer-hint">
                            <span className="hint-pointer">{mode === 'walk' ? '화면 드래그로 둘러보기 · WASD / 방향키로 이동 · Shift 빠르게' : '드래그 회전 · 더블클릭 중심 선택 · 오른쪽 드래그 이동 · 스크롤 확대'}</span>
                            <span className="hint-touch">{mode === 'walk' ? '화면을 밀어 둘러보기 · 방향 버튼으로 이동' : '한 손가락으로 회전 · 두 손가락으로 이동과 확대'}</span>
                        </p>
                    </div>
                    {(sight || info.inspection) && <BuildingInformationPanel sight={sight} inspection={info.inspection} onSelectBuilding={info.onSelectBuilding} />}
                    <div className="experience-bottom">
                        <div className="guidance"><span className="guidance-icon" aria-hidden="true">✳</span><p>{mode === 'walk' ? '광장에서 대극장 로비와 별관 점포까지 걸을 수 있습니다.' : '모형을 회전하고 확대해 입면의 디테일을 살펴보세요.'}</p></div>
                        <p className="model-note">서울 시간 {seoulTime} · {weather ? `김포공항 구름 관측 ${observedTime}` : '기상 관측을 가져오지 못해 구름은 임의로 표시합니다.'}<br />김포공항은 광화문과 기상이 다를 수 있습니다. <a href="https://aviationweather.gov/data/api/">NOAA 항공기상 관측</a></p>
                    </div>
                </section>
                <NationalCulturalExplorer onSelectLocation={selectNational} />
            </main>
            <footer className="site-footer"><span>SEJONG CENTER</span><span>건축을 바라보는 새로운 시선</span></footer>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App />);
