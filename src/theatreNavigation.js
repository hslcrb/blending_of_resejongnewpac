// 1층 로비와 객석의 단순 보행 경계입니다. / Walk boundaries for the first-floor lobby and auditorium.
const columns = [-10,10].flatMap(x => [34,39].map(z => ({x,z})));
export function canEnterTheatre(x,z,nextX,nextZ) {
 if (![x,z,nextX,nextZ].every(Number.isFinite)) return false;
 if (Math.abs(nextX)>15.4 || nextZ < -20 || nextZ > 43) return false;
 if (((z<30 && nextZ>=30)||(z>=30 && nextZ<30)) && Math.abs((x+nextX)/2)>3.5) return false;
 return !columns.some(c => Math.abs(nextX-c.x)<0.8 && Math.abs(nextZ-c.z)<0.8);
}
export function stepInside(position,next,seats=[]) {
 const blocked=seats.some(s=>s.level===1 && Math.abs(s.position[0]-next.x)<.32 && Math.abs(s.position[2]-next.z)<.35);
 return !blocked && canEnterTheatre(position.x,position.z,next.x,next.z) ? {x:next.x,z:next.z} : {x:position.x,z:position.z};
}
export function nearestSeat(seats,x,z,maximum=2) {
 let result=null,best=maximum*maximum;
 for(const seat of seats) { const [sx,,sz]=seat.position; const distance=(sx-x)**2+(sz-z)**2; if(distance<=best){best=distance;result=seat;} }
 return result;
}
export function seatEyePosition(seat) {
 const [x,y,z]=seat.position;return {x,y:y+(seat.eyeHeight ?? 1.08),z};
}
export function theatreFloorHeight(z) {
 return z>=3.3 && z<=29 ? Math.min(1.96,Math.max(0,(z-3.3)*0.085/0.98)) : z>29 && z<38 ? (38-z)*1.96/9 : 0;
}
