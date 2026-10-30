import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { instanceTreeMeshes } from './treeInstances.js';
import { canWalk } from './walkCollision.js';
import { walkKeyForEvent } from './walkKeys.js';
import { focusOrbitAt } from './orbitFocus.js';
import './style.css';

// GLB의 광장, 정문과 로비에 맞춘 보행 범위입니다. / Walkable plaza, entrance and lobby from the GLB.
const WALK_START = new THREE.Vector3(33.1, 1.7, 27);
const WALK_SPEED = 2;
const WALK_FAST_SPEED = 5;
function groundHeight(x, z) {
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

function BuildingViewer({ mode, view, viewerRef, onStatusChange }) {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);

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
                vertexShader: `varying vec3 vDirection;
                    void main() {
                        vDirection = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: `varying vec3 vDirection;
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
                        vec3 color = mix(vec3(0.46, 0.72, 0.90), vec3(0.10, 0.37, 0.72), pow(elevation, 0.65));
                        vec2 clouds = d.xz / (max(d.y + 0.45, 0.05) + 0.32) * 1.65;
                        float cloud = smoothstep(0.48, 0.69, fbm(clouds + vec2(3.5, 1.8)));
                        cloud *= smoothstep(-0.55, -0.15, d.y) * 0.62;
                        color = mix(color, vec3(1.0, 0.99, 0.97), cloud);
                        float sunlight = pow(max(dot(d, normalize(vec3(0.45, 0.65, 0.6))), 0.0), 16.0);
                        color += vec3(0.13, 0.11, 0.075) * sunlight;
                        gl_FragColor = vec4(color, 1.0);
                        #include <tonemapping_fragment>
                        #include <colorspace_fragment>
                    }`,
            }),
        );
        sky.frustumCulled = false;
        scene.add(sky);
        scene.add(new THREE.HemisphereLight(0xffffff, 0xb3c2bd, 1.3));
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
        let frameId;
        let model;
        let treeBatch;
        let modeNow = 'orbit';
        let activePreset = 'perspective';
        let userAdjusted = false;
        let gestureActive = false;
        let savedOrbit = null;
        let yaw = 0;
        let pitch = 0.1;
        let lastTime = 0;
        let performanceStart = 0;
        let performanceFrames = 0;
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
            activePreset = name;
            userAdjusted = false;
            const { framePoints, center } = sceneRef.current;
            const direction = (name === 'front'
                ? new THREE.Vector3(0, 0.08, 1)
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
        document.addEventListener('visibilitychange', clearInput);

        const onContextLost = (event) => {
            event.preventDefault();
            onStatusChange('error');
        };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost);

        sceneRef.current = { fitView, setMode, resetWalk, handleKeyDown, handleKeyUp, clearInput, setHeld };
        viewerRef.current = sceneRef.current;

        new GLTFLoader().load('/model/sejong.glb', (gltf) => {
            if (disposed) return;
            model = gltf.scene;
            scene.add(model);
            model.updateWorldMatrix(true, true);
            const bounds = new THREE.Box3();
            const framePoints = [];
            const sample = new THREE.Vector3();
            model.traverse((object) => {
                if (!object.isMesh || /^(ground|line)$/i.test(object.name)) return;
                bounds.union(new THREE.Box3().setFromObject(object));
                const positions = object.geometry.attributes.position;
                if (!positions) return;
                const stride = Math.max(1, Math.floor(positions.count / 20000));
                for (let i = 0; i < positions.count; i += stride) {
                    sample.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                    framePoints.push(sample.clone());
                }
            });
            if (bounds.isEmpty()) bounds.setFromObject(model);
            const size = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            const radius = Math.max(size.x, size.y, size.z, 1);
            sun.target.position.copy(center);
            sun.position.copy(center).add(new THREE.Vector3(radius * 0.55, radius, radius * 0.7));
            const shadowCamera = sun.shadow.camera;
            shadowCamera.left = -radius * 0.8;
            shadowCamera.right = radius * 0.8;
            shadowCamera.top = radius * 0.8;
            shadowCamera.bottom = -radius * 0.8;
            shadowCamera.near = radius * 0.1;
            shadowCamera.far = radius * 3;
            shadowCamera.updateProjectionMatrix();
            model.traverse((object) => {
                if (!object.isMesh) return;
                const sourceName = object.userData.name || object.name.replaceAll('_', ' ');
                object.receiveShadow = true;
                object.castShadow = /^(stone|terrace_stone|terrace stone|roof|roofedge|copper|white|Individual tree trunks and branching|Deciduous foliage \d+|Tree trunk \d+|Tree foliage \d+ shade \d+|Plaza shrub stems|Plaza shrub foliage \d+)$/i.test(sourceName);
            });
            // 공유 수목 형상을 묶어 드로 호출을 줄입니다. / Batch shared trees after framing and shadow setup.
            treeBatch = instanceTreeMeshes(model, { animations: gltf.animations });
            renderer.shadowMap.needsUpdate = true;
            camera.near = radius / 1000;
            camera.far = radius * 100;
            camera.updateProjectionMatrix();
            controls.minDistance = radius * 0.06;
            controls.maxDistance = radius * 6;
            Object.assign(sceneRef.current, { bounds, framePoints, size, center, radius });
            fitView('perspective');
            onStatusChange('ready');
        }, undefined, () => {
            if (!disposed) onStatusChange('error');
        });

        const animate = (time) => {
            const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.2) : 0;
            lastTime = time;
            // 낮은 프레임이 지속되는 기기에서만 해상도를 줄입니다. / Reduce pixel load only when slow frames persist.
            if (!performanceStart) performanceStart = time;
            else if (pixelRatio > 0.75 && time - performanceStart > 4000) {
                performanceFrames += 1;
                const elapsed = time - performanceStart - 4000;
                if (elapsed >= 3000) {
                    if (performanceFrames * 1000 / elapsed < 25) {
                        pixelRatio = 0.75;
                        renderer.setPixelRatio(pixelRatio);
                        renderer.setSize(container.clientWidth, container.clientHeight);
                    }
                    performanceStart = time;
                    performanceFrames = 0;
                }
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
                        if (canWalk(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
                        if (canWalk(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
                    }
                }
                camera.position.y = groundHeight(camera.position.x, camera.position.z) + 1.7;
                camera.rotation.set(pitch, yaw, 0, 'YXZ');
            } else {
                controls.update();
            }
            sky.position.copy(camera.position);
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);

        return () => {
            disposed = true;
            cancelAnimationFrame(frameId);
            observer.disconnect();
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
            document.removeEventListener('visibilitychange', clearInput);
            if (model) {
                treeBatch?.disposeInstances();
                model.traverse((object) => {
                    object.geometry?.dispose();
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach((material) => {
                        material?.map?.dispose();
                        material?.dispose();
                    });
                });
            }
            renderer.dispose();
            renderer.domElement.remove();
            viewerRef.current = null;
        };
    }, [onStatusChange, viewerRef]);

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
    const [status, setStatus] = useState('loading');
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
        <div className="app-shell">
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
                                <button type="button" aria-pressed={mode === 'walk'} disabled={!ready} onClick={() => setMode('walk')}><span aria-hidden="true">↟</span> 직접 걷기</button>
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
                    <div className="view-frame">
                        <BuildingViewer mode={mode} view={view} viewerRef={viewerRef} onStatusChange={setStatus} />
                        {status !== 'ready' && (
                            <div className="viewer-status" role="status">
                                <span>{status === 'loading' ? '건축 모델을 불러오는 중입니다.' : '모델을 불러오지 못했습니다.'}</span>
                                {status === 'error' && <button type="button" onClick={() => window.location.reload()}>다시 불러오기</button>}
                            </div>
                        )}
                        <div className="viewer-label" aria-hidden="true"><span>{mode === 'walk' ? 'GROUND WALK' : 'ARCHITECTURE MODEL'}</span><strong>{mode === 'walk' ? '광장을 걷는 시선' : '세종문화회관'}</strong></div>
                        <div className="view-actions">
                            {mode === 'orbit' && <button type="button" disabled={!ready} onClick={() => setView({ name: 'front' })}>정면 보기</button>}
                            <button type="button" disabled={!ready} onClick={() => mode === 'walk' ? viewerRef.current?.resetWalk() : setView({ name: 'perspective' })}>{mode === 'walk' ? '시작 위치' : '처음 시점'}</button>
                        </div>
                        <p className="viewer-hint">
                            <span className="hint-pointer">{mode === 'walk' ? '화면 드래그로 둘러보기 · WASD / 방향키로 이동 · Shift 빠르게' : '드래그 회전 · 더블클릭 중심 선택 · 오른쪽 드래그 이동 · 스크롤 확대'}</span>
                            <span className="hint-touch">{mode === 'walk' ? '화면을 밀어 둘러보기 · 방향 버튼으로 이동' : '한 손가락으로 회전 · 두 손가락으로 이동과 확대'}</span>
                        </p>
                    </div>
                    <div className="experience-bottom">
                        <div className="guidance"><span className="guidance-icon" aria-hidden="true">✳</span><p>{mode === 'walk' ? '광장에서 대극장 로비와 별관 점포까지 걸을 수 있습니다.' : '모형을 회전하고 확대해 입면의 디테일을 살펴보세요.'}</p></div>
                        <p className="model-note">사진과 대극장 단면을 참고한 모델입니다.<br />일부 비례와 세부는 추정입니다.</p>
                    </div>
                </section>
            </main>
            <footer className="site-footer"><span>SEJONG CENTER</span><span>건축을 바라보는 새로운 시선</span></footer>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App />);
