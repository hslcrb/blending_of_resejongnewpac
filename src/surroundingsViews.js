// Keep the same view direction while backing away on narrow screens.
const PRESETS = {
    perspective: { position: [170, 235, 155], target: [0, 4, 5] },
    front: { position: [0, 55, 112], target: [0, 8, -35] },
    's-theatre': { position: [49, 4.7, -127], target: [32, 2.3, -116] },
    'gratitude-garden': { position: [51.8, 3.8, 79.2], target: [79, 2.45, 70.2] },
    'north-axis': { position: [358, 6.4, 82], target: [411, 9.6, 73] },
    rear: { position: [-100, 115, -170], target: [0, 6, -45] },
};

export function surroundingsView(name, aspect) {
    // On phones, the generic retreat would put the garden camera behind a tree.
    // Back along the clear stone row instead; no mesh or foliage is hidden.
    if (name === 'gratitude-garden' && aspect < 1) {
        return { position: [45, 6.3, 77.4], target: [77.8, 2.15, 72.3] };
    }
    // Keep the facade centered here rather than applying the generic portrait retreat.
    if (name === 'north-axis' && aspect < 1) {
        return { position: [314, 13.6, 86], target: [411, 9.4, 73] };
    }
    const preset = PRESETS[name] || PRESETS.perspective;
    const scale = Math.max(1, 1.5 / Math.max(aspect, 0.01));
    return {
        position: preset.position.map((value, index) => preset.target[index] + (value - preset.target[index]) * scale),
        target: preset.target,
    };
}
