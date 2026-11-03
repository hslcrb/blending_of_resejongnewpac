// 넓은 지면은 그림자를 받되 스스로 투사하지 않습니다. / Broad ground receives shadows without casting onto itself.
export function shouldCastModelShadow(mesh, bounds) {
    const name = mesh.userData?.name || mesh.name.replaceAll('_', ' ');
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (/^(ground|line)$/i.test(name) || materials.every((material) => !material || (material.transparent && !material.alphaTest))) return false;
    const height = bounds.max.y - bounds.min.y;
    const spread = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    return !(bounds.max.y <= .5 && bounds.min.y <= .15 && height < .6 && spread > 8);
}

// 청크를 내릴 때 공유 자원과 모든 텍스처 슬롯을 한 번만 해제합니다.
// Release shared resources and every texture slot once when a chunk is evicted.
export function disposeModelResources(root) {
    const geometries = new Set(); const materials = new Set(); const textures = new Set(); const images = new Set();
    root.traverse((object) => {
        if (object.isInstancedMesh) object.dispose();
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (!material) continue;
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
        if (object.skeleton) object.skeleton.dispose();
    });
    for (const texture of textures) { if (texture.image?.close) images.add(texture.image); texture.dispose(); }
    for (const image of images) image.close();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    root.removeFromParent();
}
