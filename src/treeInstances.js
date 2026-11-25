import * as THREE from 'three';

// 나무의 원본 이름만 묶습니다. / Batch only the exported tree nodes.
const TREE_NAME = /^Tree (?:trunk \d+|foliage \d+ shade \d+)$/i;

/**
 * Batch static tree meshes sharing the same geometry and material.
 *
 * Call after the caller has assigned shadow flags and computed any per-mesh
 * framing samples. Pass the GLTF animations array if present: animated models
 * are left unchanged because their node transforms must stay individually
 * addressable. Only static, visible, single-material leaf meshes are eligible.
 *
 * The caller owns the original shared geometry, material and textures. This
 * function never disposes them. At teardown call result.disposeInstances()
 * once before the caller's normal geometry/material/texture cleanup.
 */
export function instanceTreeMeshes(root, { animations = [] } = {}) {
    const result = {
        batches: [],
        sourceCount: 0,
        instanceCount: 0,
        disposeInstances() {
            for (const batch of this.batches) batch.dispose();
        },
    };
    if (!root?.isObject3D || animations.length) return result;

    root.updateWorldMatrix(true, true);
    if (Math.abs(root.matrixWorld.determinant()) < 1e-12) return result;
    const rootInverse = root.matrixWorld.clone().invert();
    const groups = new Map();
    const relative = new THREE.Matrix4();

    root.traverse((mesh) => {
        const name = mesh.userData?.name || mesh.name.replaceAll('_', ' ');
        if (!TREE_NAME.test(name) || !mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh
            || mesh.children.length || !mesh.geometry || !mesh.material || Array.isArray(mesh.material)
            || mesh.morphTargetInfluences?.length || !mesh.visible) return;

        // 보이지 않는 상위 노드를 임의로 다시 보이게 하지 않습니다. / Preserve inherited visibility.
        for (let parent = mesh.parent; parent && parent !== root; parent = parent.parent) {
            if (!parent.visible) return;
        }
        relative.multiplyMatrices(rootInverse, mesh.matrixWorld);
        // Three.js InstancedMesh does not support negative instance matrices.
        if (relative.determinant() <= 1e-12) return;

        const key = [mesh.geometry.uuid, mesh.material.uuid, mesh.castShadow, mesh.receiveShadow,
            mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ mesh, matrix: relative.clone() });
    });

    for (const members of groups.values()) {
        if (members.length < 2) continue;
        const source = members[0].mesh;
        const batch = new THREE.InstancedMesh(source.geometry, source.material, members.length);
        batch.name = source.name;
        batch.userData = { ...source.userData, treeInstances: true };
        batch.castShadow = source.castShadow;
        batch.receiveShadow = source.receiveShadow;
        batch.renderOrder = source.renderOrder;
        batch.layers.mask = source.layers.mask;
        batch.frustumCulled = source.frustumCulled;
        members.forEach(({ matrix }, index) => batch.setMatrixAt(index, matrix));
        batch.instanceMatrix.needsUpdate = true;
        batch.computeBoundingBox();
        batch.computeBoundingSphere();
        root.add(batch);
        for (const { mesh } of members) mesh.removeFromParent();
        result.batches.push(batch);
        result.sourceCount += members.length;
        result.instanceCount += members.length;
    }
    return result;
}
