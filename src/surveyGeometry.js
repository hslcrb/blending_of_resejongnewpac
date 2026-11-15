import { Group } from 'three';

// Exact source names, not spatial heuristics: preserve unrelated interiors and walls.
export function extractSurveyGeometry(gltf, manifest) {
    const names = manifest?.meshNames;
    if (!Array.isArray(names) || names.length !== 4 || new Set(names).size !== 4 || !names.includes('stone')) throw new Error('Invalid survey replacement manifest');
    const found = new Map();
    const scenes = gltf.scenes || [gltf.scene];
    if (scenes.length !== 1) throw new Error('Unexpected survey scenes');
    for (const scene of scenes) {
        scene.updateWorldMatrix(true, true);
        scene.traverse(object => {
            const name = object.userData.name || object.name;
            if (!names.includes(name)) {
                if (object.isMesh && !names.includes(object.parent?.userData.name || object.parent?.name)) throw new Error('Unexpected survey mesh');
                return;
            }
            if (found.has(name) && found.get(name) !== object) throw new Error(`Duplicate replacement: ${name}`);
            let meshes = 0;
            object.traverse(child => { if (child.isMesh && child.geometry?.attributes.position) meshes++; });
            if (meshes) found.set(name, object);
        });
    }
    if (found.size !== names.length) throw new Error('Incomplete survey replacement');
    const root = new Group();
    root.name = 'Photo verified colonnade replacements';
    for (const object of found.values()) root.attach(object);
    // No other scenes are exported by the survey exporter. Fail before moving
    // nodes if an unexpected mesh appears (validated above).
    return { root, names: new Set(names) };
}

export function hideReplacedSurveyGeometry(root, patch) {
    let count = 0;
    root.traverse(object => {
        if (patch.names.has(object.userData.name || object.name)) {
            object.visible = false;
            count++;
        }
    });
    return count;
}
