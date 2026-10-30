// GLB의 광장과 출입구에 맞춘 보행 범위입니다. / Walkable plaza and entrances from the GLB.
const WALK_LIMITS = { minX: -75, maxX: 80.6, minZ: -166, maxZ: 78 };
const WALK_BLOCKS = [
    // 후면 정원의 식재 구역 / Planted islands in the rear garden.
    ...[
        [-70, -34, 122, 139], [-27, 5, 122, 139],
        [12, 40, 123, 141], [48, 75, 124, 143],
        [-70, -33, 146, 164], [-23, 15, 146, 164],
        [24, 74, 147, 164],
    ].map(([minX, maxX, minY, maxY]) => ({ minX, maxX, minZ: -maxY, maxZ: -minY })),
    // 로비 뒤 벽에서 카메라가 잘리지 않도록 여유를 둡니다. / Leave room before the auditorium wall for the camera near plane.
    { minX: -7, maxX: 73, minZ: -103.2, maxZ: -11.1 },
    { minX: 23, maxX: 73, minZ: -111, maxZ: -103.2 },
    // 후면 별동의 유리벽과 아래 열린 열주 / Rear wing wall and open colonnade.
    { minX: -30, maxX: -7, minZ: -103.2, maxZ: -84 },
    ...[-27.44, -19.12, -10.79, -2.46, 5.87, 14.20, 22.53].map((x) =>
        ({ minX: x - 1.1, maxX: x + 1.1, minZ: -110, maxZ: -107.3 })),
    // 계단 측면 옹벽을 통해 높이 차를 뛰어넘지 않도록 합니다. / Keep walkers from stepping through stair side walls.
    { minX: 3.15, maxX: 3.75, minZ: -119.6, maxZ: -103.21 },
    { minX: 21.1, maxX: 21.7, minZ: -119.6, maxZ: -103.21 },
    { minX: -7, maxX: -3, minZ: -11.4, maxZ: 3.5 },
    { minX: 69, maxX: 73, minZ: -11.4, maxZ: 3.5 },
    // 본관 입면 사이의 다섯 출입구 / Five openings in the main facade.
    { minX: -3, maxX: 11.233, minZ: 2.7, maxZ: 3.5 },
    { minX: 14.338, maxX: 21.396, minZ: 2.7, maxZ: 3.5 },
    { minX: 24.501, maxX: 31.559, minZ: 2.7, maxZ: 3.5 },
    { minX: 34.664, maxX: 41.722, minZ: 2.7, maxZ: 3.5 },
    { minX: 44.827, maxX: 51.885, minZ: 2.7, maxZ: 3.5 },
    { minX: 54.990, maxX: 69, minZ: 2.7, maxZ: 3.5 },
    // 로비의 카운터와 벤치: 가구 바깥쪽에 보행자 반경을 둡니다. / Keep a walker-radius clearance around lobby furniture.
    ...[17, 48].map((x) => ({ minX: x - 3.4, maxX: x + 3.4, minZ: -8.75, maxZ: -6.65 })),
    ...[7, 57].map((x) => ({ minX: x - 2.55, maxX: x + 2.55, minZ: -4.45, maxZ: -2.75 })),
    // 본관의 돌출 기둥 / Projecting columns at the main entrance.
    ...[7.70, 17.87, 28.03, 38.19, 48.36, 58.52].map((x) => ({ minX: x - 1.445, maxX: x + 1.445, minZ: 2.85, maxZ: 5.15 })),
    // 별관 점포 벽과 세 출입구 / Annex shop walls and three openings.
    { minX: -72, maxX: -34, minZ: -25, maxZ: 4.25 },
    { minX: -72, maxX: -70.6, minZ: 4.25, maxZ: 12.25 },
    { minX: -35.35, maxX: -34, minZ: 4.25, maxZ: 12.25 },
    { minX: -70.6, maxX: -62.869, minZ: 10.98, maxZ: 12.25 },
    { minX: -60.611, maxX: -54.119, minZ: 10.98, maxZ: 12.25 },
    { minX: -51.861, maxX: -45.359, minZ: 10.98, maxZ: 12.25 },
    { minX: -43.101, maxX: -35.35, minZ: 10.98, maxZ: 12.25 },
    { minX: -60.819, maxX: -58.469, minZ: 4.825, maxZ: 6.075 },
    { minX: -52.067, maxX: -49.717, minZ: 4.825, maxZ: 6.075 },
    { minX: -43.316, maxX: -40.966, minZ: 4.825, maxZ: 6.075 },
    { minX: -34, maxX: -2, minZ: -24, maxZ: -9.6 },
    { minX: -34, maxX: -30.54, minZ: -9.6, maxZ: 15.19 },
    { minX: -2.32, maxX: -2, minZ: -9.6, maxZ: 15.19 },
    // 잔디 화단과 테두리를 사람의 폭만큼 여유 두고 피합니다. / Keep the walker clear of planted beds and edging.
    { minX: -73.05, maxX: -49.15, minZ: 16.65, maxZ: 29.35 },
    { minX: 1.15, maxX: 26.85, minZ: 16.15, maxZ: 27.85 },
    { minX: 43.15, maxX: 72.85, minZ: 16.15, maxZ: 27.85 },
    { minX: 4.15, maxX: 11.85, minZ: 11.65, maxZ: 16.35 },
    { minX: 56.15, maxX: 63.85, minZ: 11.65, maxZ: 16.35 },
    { minX: 73.15, maxX: 78.85, minZ: -83.35, maxZ: -6.65 },
];

export function canWalk(x, z) {
    if (x < WALK_LIMITS.minX || x > WALK_LIMITS.maxX || z < WALK_LIMITS.minZ || z > WALK_LIMITS.maxZ) return false;
    return !WALK_BLOCKS.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ);
}
