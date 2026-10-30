import * as THREE from 'three';

// 선택한 표면을 화면 중심으로 옮기고 카메라 거리와 방향은 보존합니다.
// Center a selected surface while preserving the camera's distance and direction.
export function focusOrbitAt({ camera, controls, model, clientX, clientY, rect }) {
    if (!model || !rect.width || !rect.height) return false;
    const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(model, true)[0];
    if (!hit) return false;

    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    camera.position.add(hit.point.clone().sub(controls.target));
    controls.target.copy(hit.point);
    controls.update();
    controls.enableDamping = damping;
    return true;
}
