// 멀리서 보는 동안 밀리미터 마감 간격의 깊이 정밀도를 확보합니다.
// Preserve depth precision for millimetre finish gaps in distant orbit views.
export function cameraNearPlane(mode, distance) {
    if (mode === 'walk') return 0.1;
    return Math.max(0.1, Math.min(6, distance / 40));
}
