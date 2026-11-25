import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { surroundingsView } from '../src/surroundingsViews.js';

test('narrow viewports retain the horizontal framing of each surroundings preset', () => {
    for (const name of ['perspective', 'front', 'rear']) {
        const cameraFor = (aspect) => {
            const preset = surroundingsView(name, aspect);
            const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 2000);
            camera.position.fromArray(preset.position);
            camera.lookAt(new THREE.Vector3().fromArray(preset.target));
            camera.updateMatrixWorld();
            return camera;
        };
        const wide = cameraFor(1.5);
        const narrow = cameraFor(0.6);
        // A point 25 metres to the right of the target is on the target plane.
        const point = new THREE.Vector3().fromArray(surroundingsView(name, 1.5).target)
            .add(new THREE.Vector3(25, 0, 0).applyQuaternion(wide.quaternion));
        const wideX = point.clone().project(wide).x;
        const narrowX = point.clone().project(narrow).x;
        assert.ok(Math.abs(wideX - narrowX) < 1e-9, `${name} framing changed`);
    }
});
