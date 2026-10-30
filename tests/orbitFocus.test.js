import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { focusOrbitAt } from '../src/orbitFocus.js';

function setup() {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const model = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    box.position.set(2, 0, 0);
    model.add(box);
    model.updateMatrixWorld(true);
    const controls = { target: new THREE.Vector3(), enableDamping: true, update() { camera.lookAt(this.target); camera.updateMatrixWorld(); } };
    const rect = { left: 30, top: 20, width: 600, height: 600 };
    const point = box.position.clone().project(camera);
    return { camera, controls, model, rect, x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
}

test('selecting a surface centers it without changing the view direction or distance', () => {
    const { camera, controls, model, rect, x, y } = setup();
    const offset = camera.position.clone().sub(controls.target);
    assert.equal(focusOrbitAt({ camera, controls, model, clientX: x, clientY: y, rect }), true);
    assert.ok(controls.target.x > 1.5);
    assert.ok(camera.position.clone().sub(controls.target).distanceTo(offset) < 1e-8);
    assert.equal(controls.enableDamping, true);
});

test('selecting empty sky keeps the camera unchanged', () => {
    const { camera, controls, model, rect } = setup();
    const before = camera.position.clone();
    assert.equal(focusOrbitAt({ camera, controls, model, clientX: rect.left + 10, clientY: rect.top + 10, rect }), false);
    assert.deepEqual(camera.position.toArray(), before.toArray());
    assert.deepEqual(controls.target.toArray(), [0, 0, 0]);
});
