import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cameraNearPlane } from '../src/cameraClipping.js';

test('millimetre-separated finishes at 80m span several 24-bit depth values in orbit', () => {
    const camera = new THREE.PerspectiveCamera(35, 1.5, cameraNearPlane('orbit', 80), 2000);
    const front = new THREE.Vector3(0, 0, -80).project(camera).z;
    const back = new THREE.Vector3(0, 0, -80.001).project(camera).z;
    const depthSteps = Math.abs(back - front) * 0.5 * (2 ** 24 - 1);
    assert.ok(depthSteps >= 4, `only ${depthSteps} depth values between the finishes`);
});

test('walking and the closest orbit keep the 10cm near plane and focused geometry visible', () => {
    assert.equal(cameraNearPlane('walk', 500), 0.1);
    assert.equal(cameraNearPlane('orbit', 2.5), 0.1);
    const camera = new THREE.PerspectiveCamera(35, 1.5, cameraNearPlane('orbit', 2.5), 2000);
    camera.position.set(0, 0, 2.5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const clip = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    assert.equal(clip.intersectsBox(new THREE.Box3(new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5))), true);
});
