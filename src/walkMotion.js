// 느린 렌더 프레임에서도 걷기 시간을 잃지 않고 작은 충돌 단위로 나눕니다.
// Retain elapsed walking time on slow frames and preserve small collision steps.
export function walkMotionDelta(previous,current){return previous>0&&Number.isFinite(current)?Math.min(5,Math.max(0,(current-previous)/1000)):0;}
export function walkSubsteps(seconds,speed){return Math.max(1,Math.ceil(seconds*speed/.25));}
