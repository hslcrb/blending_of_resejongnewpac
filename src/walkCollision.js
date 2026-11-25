import { isCampusPlanting } from './campusLayout.js';

// GLB의 광장과 출입구에 맞춘 보행 범위입니다. / Walkable plaza and entrances from the GLB.
const WALK_LIMITS = { minX: -75, maxX: 80.6, minZ: -166, maxZ: 78 };
// The expanded north paving and history watercourse extend to x=240.
const SURROUNDINGS_LIMITS = { minX: -160, maxX: 239, minZ: -166, maxZ: 160 };
// Expanded model: collision dimensions approximate its rendered walls and rails.
const SURROUNDINGS_BLOCKS = [
    // 항공사진으로 늘린 별관 후반부 / Deeper annex body from the aerial-reference correction.
    { minX: -72, maxX: -34, minZ: -53.6, maxZ: 4.25 },
    // Covered upper stair passage (photo 145); leave the spaces between columns open.
    ...[-28, -22.1, -16.2, -10.3].map((x) =>
        ({ minX: x - 0.675, maxX: x + 0.675, minZ: -1.875, maxZ: -0.525 })),
    { minX: -29.3, maxX: -5.7, minZ: -9.64, maxZ: -9.04 },
    // Photo 005/006/071 terrace: preserve paths between tables and umbrella poles.
    ...[-65, -59.6, -54.2, -48.8, -43.4].flatMap((x) => [22.5, 27.8].map((z) =>
        ({ minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.65, maxZ: z + 0.65 }))),
    ...[[-66, 28.2], [-55.1, 28.2], [-68.5, 30.3], [-57, 30.3], [-46, 30.3]].map(([x, z]) =>
        ({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 })),
    // Pavilion walls, leaving the garden-side opening clear.
    { minX: 29.05, maxX: 29.75, minZ: -122.85, maxZ: -120.53 },
    { minX: 29.05, maxX: 29.75, minZ: -119.57, maxZ: -110.73 },
    { minX: 33.65, maxX: 34.35, minZ: -122.85, maxZ: -110.73 },
    { minX: 29.05, maxX: 34.35, minZ: -122.85, maxZ: -122.15 },
    { minX: 29.05, maxX: 34.35, minZ: -111.43, maxZ: -110.73 },
    // Haechi sunken court perimeter and stair sides. The stair opens at z=94.
    { minX: -55.3, maxX: -54.88, minZ: 93.7, maxZ: 108.3 },
    { minX: -50.45, maxX: -47, minZ: 93.7, maxZ: 94.3 },
    { minX: -43, maxX: -1.7, minZ: 93.7, maxZ: 94.3 },
    { minX: -50.7, maxX: -50.15, minZ: 94.3, maxZ: 103.04 },
    { minX: -47.3, maxX: -46.7, minZ: 94.3, maxZ: 98 },
    { minX: -43.3, maxX: -42.7, minZ: 94.3, maxZ: 98 },
    { minX: -45.3, maxX: -44.95, minZ: 98, maxZ: 101 },
    { minX: -42.7, maxX: -5, minZ: 97.7, maxZ: 98.3 },
    { minX: -45, maxX: -5, minZ: 100.7, maxZ: 101.3 },
    { minX: -55.3, maxX: -1.7, minZ: 107.7, maxZ: 108.3 },
    { minX: -2.3, maxX: -1.7, minZ: 94, maxZ: 108 },
    // Freedom Hall railings and the closed glass portal at the foot of the steps.
    { minX: 109.7, maxX: 110.3, minZ: 56.7, maxZ: 61.7 },
    { minX: 109.7, maxX: 110.3, minZ: 65.3, maxZ: 67.3 },
    { minX: 110, maxX: 122.3, minZ: 56.7, maxZ: 57.3 },
    { minX: 110, maxX: 122.3, minZ: 66.7, maxZ: 67.3 },
    { minX: 121.4, maxX: 122.3, minZ: 57, maxZ: 67 },
    { minX: 110.3, maxX: 120, minZ: 61.4, maxZ: 61.9 },
    { minX: 110.3, maxX: 120, minZ: 65.1, maxZ: 65.6 },
    // Separate memorial columns keep the spaces between them passable.
    ...Array.from({ length: 23 }, (_, i) => ({ minX: 62.65 + 2 * i, maxX: 63.35 + 2 * i, minZ: 69.5, maxZ: 76.3 })),
    // The southern cafe shell (photo 048); the recessed entrance remains open.
    { minX: -118.3, maxX: -117.7, minZ: -7.3, maxZ: 10.95 },
    { minX: -118.3, maxX: -117.7, minZ: 13.25, maxZ: 15.3 },
    { minX: -128.3, maxX: -127.7, minZ: -7.3, maxZ: 15.3 },
    { minX: -128.3, maxX: -117.7, minZ: -7.3, maxZ: -6.7 },
    { minX: -128.3, maxX: -117.7, minZ: 14.7, maxZ: 15.3 },
    // Ordering counter and tables inside the connected ground-floor cafe.
    { minX: -126.63, maxX: -124.36, minZ: 6.45, maxZ: 13.46 },
    ...[-123.46, -124.88].flatMap((x) => [-3.33, 0.33, 4.0, 7.67].map((z) =>
        ({ minX: x - 0.71, maxX: x + 0.71, minZ: z - 0.71, maxZ: z + 0.71 }))),
    // Photo 075: preserve the marked doorway and the neighboring entry frame.
    { minX: -94.3, maxX: -93.7, minZ: -22.3, maxZ: -15 },
    { minX: -94.3, maxX: -93.7, minZ: -13.78, maxZ: -10.7 },
    { minX: -104.3, maxX: -103.7, minZ: -22.3, maxZ: -10.7 },
    { minX: -104.3, maxX: -93.7, minZ: -22.3, maxZ: -21.7 },
    { minX: -104.3, maxX: -93.7, minZ: -11.3, maxZ: -10.7 },
    { minX: -94.3, maxX: -93.7, minZ: -26.6, maxZ: -22.3 },
    { minX: -94.3, maxX: -93.7, minZ: -34.5, maxZ: -33 },
    { minX: -94.3, maxX: -93.7, minZ: -28.4, maxZ: -26.6 },
    { minX: -103.3, maxX: -102.7, minZ: -34.5, maxZ: -22.3 },
    { minX: -103.3, maxX: -93.7, minZ: -34.5, maxZ: -33.9 },
];
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
    // 새 파빌리온과 정원 벤치의 외곽에 보행자 여유를 둡니다.
    { minX: -51.45, maxX: -48.55, minZ: -139.83, maxZ: -138.44 },
    { minX: -11.45, maxX: -8.55, minZ: -141.13, maxZ: -139.74 },
    { minX: 24.55, maxX: 27.45, minZ: -142.13, maxZ: -140.74 },
    // 새 계단 난간과 상부 착지의 낙차를 막되 양 끝의 동선은 유지합니다.
    { minX: 11.8, maxX: 21.9, minZ: -114.4, maxZ: -113.5 },
    { minX: 11.8, maxX: 21.9, minZ: -110.55, maxZ: -109.95 },
    { minX: 10.85, maxX: 11.35, minZ: -114.08, maxZ: -110.25 },
    { minX: 3.15, maxX: 3.75, minZ: -110.25, maxZ: -103.21 },
    { minX: 21.1, maxX: 21.7, minZ: -110.25, maxZ: -103.21 },
    { minX: 3.75, maxX: 11.15, minZ: -110.55, maxZ: -109.95 },
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
    { minX: 1.15, maxX: 26.85, minZ: 16.15, maxZ: 34.85 },
    { minX: 43.15, maxX: 72.85, minZ: 16.15, maxZ: 34.85 },
    { minX: 4.15, maxX: 11.85, minZ: 11.65, maxZ: 16.35 },
    { minX: 56.15, maxX: 63.85, minZ: 11.65, maxZ: 16.35 },
    { minX: 73.15, maxX: 78.85, minZ: -83.35, maxZ: -6.65 },
];

export function canWalk(x, z, surroundings = false) {
    const limits = surroundings ? SURROUNDINGS_LIMITS : WALK_LIMITS;
    if (x < limits.minX || x > limits.maxX || z < limits.minZ || z > limits.maxZ) return false;
    if (surroundings && isCampusPlanting(x, z)) return false;
    if (!surroundings && x > 29.05 && x < 34.35 && z > -122.89 && z < -110.69) return false;
    if (surroundings && z > 125 && z < 151 && !((x >= -137.5 && x <= -132.5) || (x >= 152.5 && x <= 157.5))) return false;
    // Channel edges match the exported mesh; the modeled bridge is at x=151.5..158.5.
    if (surroundings && x > 24.7 && x < 237.3 && z > 115.1 && z < 117.3 && !(x >= 151.5 && x <= 158.5)) return false;
    if (surroundings && SURROUNDINGS_BLOCKS.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ)) return false;
    // The expanded scene paves a portion of the first planted bed for the terrace.
    const inFirstBed = x > -73.05 && x < -49.15 && z > 16.65 && z < 36.35;
    const onTerrace = x >= -69 && z >= 19.4 && z <= 30.8;
    if (inFirstBed && (!surroundings || !onTerrace)) return false;
    return !WALK_BLOCKS.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ);
}
