// 기존 산책과 정보 지도를 명확한 주소로 구분합니다. / Separate the walk from the information map.
export const isMapRoute = pathname => pathname.replace(/\/+$/, '') === '/map';
export const mapLink = () => '/map/';
export const exploreLink = embedded => embedded ? '/explore/?embed=1' : '/explore/';
