// [광역권 매칭 / Administrative region matching]
// 소축척 백지도와 2026년 행정동 자료의 광역 명칭·코드 차이를 연결합니다.
// Reconcile overview names and source codes with the 2026 administrative-dong release.
export const ALL_ADMIN_REGIONS = Object.freeze(['11','12','26','27','28','30','31','36','41','43','44','47','48','50','51','52']);
const NAMES = new Map([
    ['서울특별시','11'],['전남광주통합특별시','12'],['광주광역시','12'],['전라남도','12'],
    ['부산광역시','26'],['대구광역시','27'],['인천광역시','28'],['대전광역시','30'],['울산광역시','31'],
    ['세종특별자치시','36'],['경기도','41'],['충청북도','43'],['충청남도','44'],['경상북도','47'],
    ['경상남도','48'],['제주특별자치도','50'],['강원특별자치도','51'],['강원도','51'],['전북특별자치도','52'],['전라북도','52'],
]);
export function regionCodeFromName(name){ return NAMES.get(String(name||'').trim())||null; }
export function regionCodeFromBuilding(value){
    const raw=String(value||'').slice(0,2),code=({'29':'12','46':'12','42':'51','45':'52'})[raw]||raw;
    return ALL_ADMIN_REGIONS.includes(code)?code:null;
}
