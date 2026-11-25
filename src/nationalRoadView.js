// [전국 도로 가시 범위 / Nationwide road view bounds]
// 먼 축척의 전국 요청을 막고 걷기에서는 현재 위치 주변만 요청합니다.
// Refuse country-scale downloads and limit walking to the current vicinity.
export function roadViewportBounds(bounds,{walking=false,position}={}) {
 if(walking){
  if(!Array.isArray(position)||position.length!==2||!position.every(Number.isFinite))return null;
  return [position[0]-5000,position[1]-5000,position[0]+5000,position[1]+5000];
 }
 if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>bounds[2]||bounds[1]>bounds[3]||bounds[2]-bounds[0]>50000||bounds[3]-bounds[1]>50000)return null;
 return bounds;
}
export function roadAutoAllowed(bounds) {
 return Boolean(bounds&&bounds[2]-bounds[0]<=10000&&bounds[3]-bounds[1]<=10000);
}
