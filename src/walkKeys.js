// 한글 자판에서도 같은 물리 키로 걷습니다. / Keep walking controls stable across keyboard layouts.
const PHYSICAL_WALK_KEYS = {
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
    ArrowUp: 'arrowup', ArrowDown: 'arrowdown',
    ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
    ShiftLeft: 'shift', ShiftRight: 'shift',
};
const FALLBACK_WALK_KEYS = new Set(Object.values(PHYSICAL_WALK_KEYS));

export function walkKeyForEvent(event) {
    if (event.code && event.code !== 'Unidentified') return PHYSICAL_WALK_KEYS[event.code] || '';
    const key = event.key?.toLowerCase() || '';
    return FALLBACK_WALK_KEYS.has(key) ? key : '';
}
