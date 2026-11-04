import React from 'react';

// [전국 도로 선택 / Nationwide road controls]
// 소축척 원본의 비용과 확대 조건을 사용자가 확인할 수 있게 표시합니다.
// Explain the source cost and zoom condition before loading road data.
export function NationalRoadControls({active,enabled,onEnabled,selected,onSelection,status,onRetry,onManual,restricted}) {
 if(!active)return null;
 const layers=[['expressway','고속국도'],['national','일반국도'],['local','지방도']];
 return <section className="national-map-controls" aria-label="전국 도로 레이어">
  <label><input type="checkbox" checked={enabled} onChange={e=>onEnabled(e.currentTarget.checked)}/> 전국 도로 3종 사용</label>
  <p>{restricted?'작은 화면 또는 낮은 메모리 기기는 데이터 사용량을 줄이기 위해 직접 켭니다.':'큰 화면에서는 전시천리안과 돋보기를 켜면 자동으로 사용합니다.'} 자동 표시는 가로·세로 10km 이내이고, 수동 표시는 50km 이내입니다. 걷기는 현재 위치 주변 10km만 표시합니다. 전국 타일 분석상 한 번에 최대 약 12.4MB를 내려받을 수 있고 메모리는 더 사용합니다.</p>
  {enabled && <fieldset><legend>표시할 전국 도로</legend><div className="national-map-options">{layers.map(([id,name])=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>onSelection(e.currentTarget.checked?[...selected,id]:selected.filter(x=>x!==id))}/>{name}</label>)}</div></fieldset>}
  <p role="status" aria-live="polite">{enabled?status.message:'전국 도로는 현재 꺼져 있습니다.'}</p>
  {enabled && status.state==='manual' && <button type="button" onClick={onManual}>이 범위의 전국 도로 직접 불러오기</button>}
  {enabled && status.state==='error' && <button type="button" onClick={onRetry}>전국 도로 다시 불러오기</button>}
  <p>사용자 제공 소축척 도로 원본입니다. 원출처·제작 시점·이용 조건과 현재 상태는 확인되지 않았습니다. 실제 도로 전체가 아닙니다.</p>
 </section>;
}
