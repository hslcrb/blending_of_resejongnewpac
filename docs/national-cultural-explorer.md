# 전국 문화·집회 건물 변경 후보 탐색 컴포넌트

`src/NationalCulturalExplorer.jsx`는 `public/data/national-cultural-changes.geojson`의 건축물 변경 후보를 가져와 검색·지역 선택·페이지 탐색과 원본 31개 필드 확인을 제공한다. 전국 문화시설 전체 목록이나 운영이 확인된 시설 목록이 아니며, 첫 화면에서 이를 명시한다. 지번과 폴리곤 내부 대표점의 성격을 설명한다. 자료의 범위·필드·생성 절차는 [변경 자료 기록](national-cultural-changes.md)을 참고한다.

## 연결 계약

```jsx
import NationalCulturalExplorer from './NationalCulturalExplorer.jsx';

<NationalCulturalExplorer
  onSelectLocation={({ id, coordinates, fields }) => {
    // coordinates는 EPSG:4326 [경도, 위도] 대표점이다.
    // 화면 이동 등은 부모가 명시적으로 구현한다.
  }}
/>
```

- 기본 요청 경로는 `/data/national-cultural-changes.geojson`이다. 다른 경로는 `dataUrl` prop으로 지정한다. 요청 실패나 잘못된 응답을 표시하고 재시도할 수 있으며, unmount 또는 요청 주소 변경 시 이전 요청은 중단한다.
- `onSelectLocation`은 선택적인 함수로, 유효한 좌표가 있는 항목에서만 `{ id, coordinates: [longitude, latitude], fields }`를 받는다. 함수가 없으면 위치 버튼이 표시되지 않는다. `geometry: null`인 항목은 목록에서 보존하며 선택할 수 없음을 표시한다. 부모 화면이 이 좌표를 실제로 이동·표시하도록 연결해야 한다.
- 검색은 건물명·법정동·지번·용도명·원본 FID를 대상으로 하고, 지역과 함께 좁힌다. 지역 선택에는 17개 시도를 제공하며 현 변경 자료에 없는 지역은 자료에 후보가 없다고 표시한다. 과거 강원·전북 지역 코드 42·45는 현재 51·52로 묶는다.
- 10건씩 표시하며 상세 메뉴는 키보드로 열 수 있다. 원본은 `A0`~`A30`의 문자열 또는 null로 표시하고 0과 결측을 구분한다. 숫자형 원본의 별표는 범위 초과라고 표시하고 원문도 보여준다. 필드명은 유사 명세를 참고한 설명이므로 코드도 같이 표시한다.

## 검증

`node --test tests/national-cultural-explorer.test.js`는 검색과 지역·페이지·결측·범위 초과·잘못된 자료를 검사한다. 브라우저 검사는 Vite를 3142 포트로 띄우고 Playwright가 설치된 Node 환경에서 `node tests/national-ui-browser.cjs`를 실행한다. 실패와 재시도, 지역·검색, 31개 필드, 위치 콜백, 페이지, 320px 폭과 키보드 상세 열기를 검사했다. Playwright는 이 저장소의 현재 package.json에 없으므로 실행 환경에서 별도로 제공해야 한다. 390px 시각 확인: `national-cultural-mobile.png`.

이 컴포넌트는 메인 뷰어에 자동으로 삽입되지 않는다. 연결 담당자는 `src/main.jsx`에서 기존 GIS·3D 모드와의 위치 변환을 검토하고, 실제 운영 화면에서 후보를 선택했을 때의 동작을 따로 검증해야 한다.
