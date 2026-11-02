// Height overrides for the expanded model; null leaves the original terrain unchanged.
export function surroundingsGroundHeight(x, z) {
    if (x >= -69 && x <= -49.5 && z >= 19.4 && z <= 30.8) return 0.195;
    if (x > -49.5 && x <= -48.6 && z >= 19.4 && z <= 30.8) {
        return 0.195 - (x + 49.5) * (0.185 / 0.9);
    }
    if (x >= 29.4 && x <= 34 && z >= -122.5 && z <= -111.08) return 0.23;
    if (x >= -55 && x <= -2 && z >= 94 && z <= 108) {
        if (x >= -47 && x <= -43 && z < 98) return 0;
        if (x >= -54.88 && x <= -50.45 && z >= 94.04 && z < 103.04) {
            return -Math.min(20, Math.floor((z - 94.04) / 0.45) + 1) * 0.1625;
        }
        if (x >= -45 && x <= -5 && z >= 98 && z <= 101) {
            return -(x + 45) * 3.25 / 40;
        }
        return -3.25;
    }
    if (x >= 110 && x <= 122 && z >= 57 && z <= 67) {
        if (x < 120 && z >= 61.7 && z <= 65.3) {
            return -Math.min(20, Math.floor((x - 110) / 0.5) + 1) * 0.1625;
        }
        return -3.25;
    }
    return null;
}
