let beds = [];

// Blender에서 내보낸 곡선 화단의 경계를 그대로 씁니다. / Use the curved bed outlines exported by Blender.
export function setCampusLayout(layout) {
    if (!layout) { beds = []; return; }
    if (layout.version !== 1 || !Array.isArray(layout.westGarden?.beds)) throw new Error('Unsupported campus layout');
    beds = layout.westGarden.beds.map(({ points }) => {
        if (!Array.isArray(points) || points.length < 3 || points.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) {
            throw new Error('Invalid campus planting outline');
        }
        return { points, minX: Math.min(...points.map((p) => p[0])), maxX: Math.max(...points.map((p) => p[0])),
            minZ: Math.min(...points.map((p) => p[1])), maxZ: Math.max(...points.map((p) => p[1])) };
    });
}

export function isCampusPlanting(x, z, clearance = 0.26) {
    for (const bed of beds) {
        if (x < bed.minX - clearance || x > bed.maxX + clearance || z < bed.minZ - clearance || z > bed.maxZ + clearance) continue;
        let inside = false;
        for (let i = 0, j = bed.points.length - 1; i < bed.points.length; j = i++) {
            const [ax, az] = bed.points[j]; const [bx, bz] = bed.points[i];
            const dx = bx - ax; const dz = bz - az;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
            if ((x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2 <= clearance ** 2) return true;
            if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
        }
        if (inside) return true;
    }
    return false;
}
