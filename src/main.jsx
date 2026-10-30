import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

function BuildingViewer({ view, onStatusChange }) {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);

    // 모델 크기에 맞춰 카메라와 상호작용 범위를 설정합니다. / Fit the camera and controls to the model.
    useEffect(() => {
        const container = containerRef.current;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#e8e8e4');
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.maxPolarAngle = Math.PI * 0.49;
        controls.enablePan = false;

        scene.add(new THREE.HemisphereLight(0xffffff, 0xa5a39d, 1.3));
        const sun = new THREE.DirectionalLight(0xffffff, 1.8);
        sun.position.set(10, 20, 15);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0xffffff, 0.7);
        fill.position.set(-15, 8, -10);
        scene.add(fill);

        let disposed = false;
        let frameId;
        let model;
        const resize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (!width || !height) return;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();

        const setView = (name) => {
            if (!sceneRef.current?.size) return;
            const { center, distance } = sceneRef.current;
            const direction = name === 'front'
                ? new THREE.Vector3(0, 0.16, 1)
                : new THREE.Vector3(0.85, 0.55, 1);
            camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));
            controls.target.copy(center);
            controls.update();
        };
        const handleKey = (event) => {
            if (!sceneRef.current?.size) return;
            const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
            if (event.key === 'ArrowLeft') orbit.theta -= 0.12;
            else if (event.key === 'ArrowRight') orbit.theta += 0.12;
            else if (event.key === 'ArrowUp') orbit.phi -= 0.12;
            else if (event.key === 'ArrowDown') orbit.phi += 0.12;
            else if (event.key === '+' || event.key === '=') orbit.radius *= 0.9;
            else if (event.key === '-') orbit.radius *= 1.1;
            else return;
            event.preventDefault();
            orbit.phi = THREE.MathUtils.clamp(orbit.phi, 0.05, controls.maxPolarAngle);
            orbit.radius = THREE.MathUtils.clamp(orbit.radius, controls.minDistance, controls.maxDistance);
            camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(orbit));
            controls.update();
        };
        sceneRef.current = { setView, handleKey };

        new GLTFLoader().load('/model/sejong.glb', (gltf) => {
            if (disposed) return;
            model = gltf.scene;
            scene.add(model);
            const bounds = new THREE.Box3().setFromObject(model);
            const size = bounds.getSize(new THREE.Vector3());
            const center = bounds.getCenter(new THREE.Vector3());
            const radius = Math.max(size.x, size.y, size.z, 1);
            const distance = radius / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1)) * (camera.aspect < 1 ? 1.35 : 1.1);
            camera.near = radius / 1000;
            camera.far = radius * 100;
            camera.updateProjectionMatrix();
            controls.minDistance = radius * 0.3;
            controls.maxDistance = radius * 6;
            sceneRef.current = { setView, handleKey, size, center, distance };
            setView('perspective');
            onStatusChange('ready');
        }, undefined, () => {
            if (!disposed) onStatusChange('error');
        });

        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            disposed = true;
            cancelAnimationFrame(frameId);
            observer.disconnect();
            controls.dispose();
            if (model) {
                model.traverse((object) => {
                    object.geometry?.dispose();
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach((material) => material?.dispose());
                });
            }
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [onStatusChange]);

    useEffect(() => {
        sceneRef.current?.setView(view.name);
    }, [view]);

    return <div className="viewer-canvas" ref={containerRef} tabIndex={0} role="group" onKeyDown={(event) => sceneRef.current?.handleKey(event)} aria-label="세종문화회관 외관 3D 모델. 드래그 또는 방향키로 회전하고 스크롤 또는 더하기와 빼기 키로 확대하거나 축소할 수 있습니다." />;
}

function App() {
    const [status, setStatus] = useState('loading');
    const [view, setView] = useState({ name: 'perspective' });

    return (
        <div className="app-shell">
            <header className="site-header">
                <a className="wordmark" href="#top" aria-label="세종문화회관 건축 둘러보기 처음으로">세종문화회관</a>
                <span className="header-label">건축 둘러보기</span>
            </header>

            <main id="top" className="main-content">
                <section className="intro" aria-labelledby="page-title">
                    <div>
                        <p className="eyebrow">세종문화회관 건축</p>
                        <h1 id="page-title">익숙한 풍경을<br />새로운 시선으로</h1>
                    </div>
                    <p className="intro-copy">세종문화회관의 외관을 직접 돌려보며<br className="desktop-break" /> 건축의 형태와 디테일을 살펴보세요.</p>
                </section>

                <section className="model-section" aria-label="세종문화회관 3D 모델">
                    <BuildingViewer view={view} onStatusChange={setStatus} />
                    {status !== 'ready' && (
                        <div className="viewer-status" role="status">
                            {status === 'loading' ? '건축 모델을 불러오는 중입니다.' : '모델을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
                        </div>
                    )}
                    <div className="viewer-heading">
                        <span>3D 모델</span>
                        <strong>세종문화회관</strong>
                    </div>
                    <div className="viewer-controls" aria-label="모델 보기 설정">
                        <button type="button" onClick={() => setView({ name: 'front' })} disabled={status !== 'ready'}>정면 보기</button>
                        <button type="button" onClick={() => setView({ name: 'perspective' })} disabled={status !== 'ready'}>처음 시점</button>
                    </div>
                    <p className="viewer-hint">드래그 또는 방향키로 회전 <span aria-hidden="true">·</span> 스크롤 또는 + / −로 확대 / 축소</p>
                </section>
                <div className="model-note">
                    <p>사진을 바탕으로 비례를 추정한 외관 모델입니다.</p>
                    <p>터치 화면에서는 한 손가락으로 회전하고 두 손가락으로 확대할 수 있습니다.</p>
                </div>
            </main>
            <footer className="site-footer"><span>세종문화회관</span><span>건축 외관 3D 모델</span></footer>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App />);




