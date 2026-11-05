import {canEnterTheatre,theatreFloorHeight} from './theatreNavigation.js';
// 기존 실내를 본관 외피 안의 미터 좌표에 놓습니다. / Place the existing interior inside the main exterior shell.
export const THEATRE_PLACEMENT=Object.freeze({scale:1.25,position:[33.1,1.07,-71.9]});
export function theatreToCampus(p){const {scale:s,position:t}=THEATRE_PLACEMENT;return {x:p.x*s+t[0],y:(p.y||0)*s+t[1],z:p.z*s+t[2]};}
export function campusToTheatre(p){const {scale:s,position:t}=THEATRE_PLACEMENT;return {x:(p.x-t[0])/s,y:((p.y||0)-t[1])/s,z:(p.z-t[2])/s};}
export function isTheatreInterior(p){const a=campusToTheatre(p);return Math.abs(a.x)<=15.4 && a.z>=-20 && a.z<=60 && (!Number.isFinite(p.y)||(a.y>=-.3 && a.y<=20));}
export function canWalkUnified(current,next,exteriorCanWalk,seats=[],level=1){
 const a=campusToTheatre(current),b=campusToTheatre(next),insideA=isTheatreInterior(current),insideB=isTheatreInterior(next);
 if(!insideA&&!insideB)return exteriorCanWalk(next.x,next.z);
 if(insideA!==insideB && !(Math.abs(a.x)<.85&&Math.abs(b.x)<.85&&a.z>=59.6&&b.z>=59.6))return false;
 if(!insideB)return exteriorCanWalk(next.x,next.z);
 const from=insideA?a:{...a,z:60};
 if(!canEnterTheatre(from.x,from.z,b.x,b.z,level))return false;
 return !seats.some(s=>s.level===level&&Math.abs(s.position[0]-b.x)<.32&&Math.abs(s.position[2]-b.z)<.35);
}
export function unifiedFloorHeight(p,level=1){const a=campusToTheatre(p);return THEATRE_PLACEMENT.position[1]+theatreFloorHeight(a.z,a.x,level)*THEATRE_PLACEMENT.scale;}
