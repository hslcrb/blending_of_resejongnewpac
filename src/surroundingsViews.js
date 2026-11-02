// Keep the same view direction while backing away on narrow screens.
const PRESETS = {
    perspective: { position: [170, 235, 155], target: [0, 4, 5] },
    front: { position: [0, 55, 112], target: [0, 8, -35] },
    rear: { position: [-100, 115, -170], target: [0, 6, -45] },
};

export function surroundingsView(name, aspect) {
    const preset = PRESETS[name] || PRESETS.perspective;
    const scale = Math.max(1, 1.5 / Math.max(aspect, 0.01));
    return {
        position: preset.position.map((value, index) => preset.target[index] + (value - preset.target[index]) * scale),
        target: preset.target,
    };
}
