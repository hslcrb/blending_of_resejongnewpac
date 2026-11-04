// 1층 로비보다 어두운 객석에 자연스럽게 눈이 적응하도록 노출을 보정합니다.
// Raise exposure smoothly from the bright lobby to the auditorium.
export function theatreExposure(z) {
 const t=Math.min(1,Math.max(0,(38-z)/8));
 return 1.18+.30*t;
}
