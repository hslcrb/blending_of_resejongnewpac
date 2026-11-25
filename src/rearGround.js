// 후면 계단과 착지의 높이 / Rear stair tread and landing height.
export function rearGroundHeight(x, z) {
    const landingHeight = 3.65;
    if (x >= 3.47 && x <= 21.4 && z >= -110.25 && z <= -103.21) return landingHeight;
    if (x >= 11.15 && x <= 12.03 && z >= -113.78 && z <= -110.12) return landingHeight;

    if (x < 12 || x > 21.64 || z < -113.78 || z > -110.38) return null;
    const rise = landingHeight / 24;
    if (x >= 17.46) {
        const step = Math.max(0, Math.min(10, Math.floor((21.64 - x) / 0.38)));
        return (step + 1) * rise;
    }
    if (x >= 16.56) return 12 * rise;
    const step = Math.max(0, Math.min(11, Math.floor((16.56 - x) / 0.38)));
    return (step + 13) * rise;
}
