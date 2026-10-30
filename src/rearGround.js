// 후면 계단과 착지의 높이 / Rear stair tread and landing height.
export function rearGroundHeight(x, z) {
    if (x < 3.47 || x > 21.4) return null;
    const y = -z;
    if (y >= 103.21 && y <= 110.25) return 3.6525;
    if (y >= 110.25 && y <= 119.6) {
        const step = Math.max(0, Math.min(23, Math.floor((119.6 - y) / 0.39)));
        return (step + 1) * 3.6525 / 24;
    }
    return null;
}
