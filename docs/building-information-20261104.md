# 독립 건물정보 패널 — 2026-11-04

`src/area/BuildingInformation.jsx`는 기존 장면과 분리된 두 내보내기를 제공한다. `useBuildingInformation`은 돋보기·검색 조회 순서와 현재 선택을 관리하고, `BuildingInformationPanel`은 근처 건물·서울 전체 목록과 검색을 보여준다. 독립 스타일은 `src/area/building-information.css`에 있다. 이 모듈은 페이지를 임의로 수정하거나 장면에 직접 접근하지 않는다.

## 장면 연결

```jsx
import { BuildingInformationPanel, useBuildingInformation } from './area/BuildingInformation.jsx';

const info = useBuildingInformation({ onSelected: building => {
    // 선택 건물로 카메라를 옮기려면 여기서 구현한다. 선택 사항이다.
} });
// createBuildingExplorer 호출 시:
// onStart: info.onStart, onInspection: info.onInspection, onState: info.onState
// 사용자가 현재 중심을 직접 조회하기 전: info.resetSelection(); explorer.center();

<BuildingInformationPanel
    sight={sight}
    inspection={info.inspection}
    onSelectBuilding={info.onSelectBuilding}
/>
```

`onStart(kind)`가 돌려준 토큰을 각 비동기 `onInspection(result, token)` 및 `onState(state, token)`에 그대로 전달해야 한다. 클릭과 검색 선택을 같은 세대로 관리해 느린 이전 응답과 자동 화면 중심 조회가 최신 선택을 덮지 않는다. 새 중심 조회를 명시적으로 시작할 때 `resetSelection()`을 먼저 호출한다. 에러와 로딩 문구는 `info.inspectionState`로 제공한다. `onSelected`는 실제 검색 결과 건물을 받은 뒤 호출되는 선택적 콜백이며, 사용하지 않아도 목록을 볼 수 있다.

## 데이터와 한계

원본 GIS 695,753건을 664개 1km 공간 타일별로 탐색하고 선택 결과마다 원본 필드 29개를 표시한다. 지번 주소이며 없는 값은 `미기재`로 표시한다. 전역 주소·이름 검색은 사용자의 요청 시 25개 구별 색인을 순차적으로 불러오고 최대 200건을 표시한다. 화면 위의 모든 라벨을 한 번에 늘어놓는 대신 전체 속성을 페이지별 목록에서 확인한다. 서울 범위 밖 좌표 이상치 2건도 전체 목록에 포함된다. 원본은 현재 상태와 차이가 있을 수 있다.

타일과 검색이 실패하면 사용자에게 알리고 재시도할 수 있다. 비동기 로딩은 컴포넌트 해제 시 중단하며 키보드 버튼, 레이블과 상태 알림을 제공한다.

## 검증

실제 로컬 GIS 데이터를 이용한 `tests/building-info-browser.cjs`는 390px 화면의 가로 넘침, 664개 지역, 29개 필드, 페이지 이동, 지번 검색, 느린 이전 클릭과 검색 선택 응답의 순서, 색인 실패 및 타일 목록 재시도를 확인한다. 실행 시 Vite 개발 서버를 5188 포트에서 띄우고 Playwright 모듈이 설치된 환경에서 `node tests/building-info-browser.cjs`를 실행한다. 다른 경로에 설치되어 있으면 `PLAYWRIGHT_PATH`를 해당 모듈 경로로, Chrome 경로가 다르면 `CHROME_PATH`를 지정한다. [모바일 검사 화면](building-info-mobile-20261104.png)은 독립 테스트 하네스 화면이다.

공간 질의·좌표 단위 검사 5개와 Vite 빌드가 통과했다. 전체 Node 테스트는 이 개발 worktree가 sparse checkout이라 `public/model`, `public/gis`, `public/data`, `functions`의 기존 필수 파일이 없어 5개 테스트를 시작하지 못했다. 전체 저장소로 통합한 뒤 다시 확인해야 한다. 빌드는 기존 큰 JavaScript 청크 경고를 출력한다.
