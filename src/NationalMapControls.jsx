import React from 'react';
import './national-map-controls.css';

// [전시천리안 백지도 선택 / All-seeing overview layer selection]
// 원본 레이어를 전부 선택한 상태에서 범주별 표시와 재시도를 제공합니다.
// Start with all source layers selected and allow per-layer visibility and retry.
export function NationalMapControls({active,manifest,manifestState,onManifestRetry,selected,onSelection,status,onRetry,onUnlocated,unlocatedState}) {
    if(!active)return null;
    const layers=manifest?.layers || [];
    return <section className="national-map-controls" aria-label="백지도 시설과 지형 레이어">
        {manifestState.state==='loading' && <p role="status">백지도 레이어 목록을 불러오고 있습니다.</p>}
        {manifestState.state==='error' && <p role="status">백지도 목록을 불러오지 못했습니다. <button type="button" onClick={onManifestRetry}>백지도 목록 다시 불러오기</button></p>}
        {manifest && <>
            <details><summary>백지도 시설·지형 선택 {selected.length} / {layers.length}개</summary>
                <div className="national-map-bulk"><button type="button" onClick={()=>onSelection(layers.map(layer=>layer.id))}>백지도 전체 선택</button><button type="button" onClick={()=>onSelection([])}>백지도 전체 해제</button></div>
                <fieldset><legend>표시할 원본 레이어</legend><div className="national-map-options">{layers.map(layer=><label key={layer.id}><input type="checkbox" checked={selected.includes(layer.id)} onChange={event=>onSelection(event.currentTarget.checked ? [...selected,layer.id] : selected.filter(id=>id!==layer.id))}/><span>{layer.name} <small>({layer.sourceCount.toLocaleString('ko-KR')}건)</small></span></label>)}</div></fieldset>
            </details>
            <p role="status" aria-live="polite">{status.message}</p>
            {status.state==='error' && <button type="button" onClick={onRetry}>백지도 자료 다시 불러오기</button>}
            <p>사용자 제공 소축척 백지도입니다. 원출처·제작 시점·이용 조건과 현재 상태는 확인되지 않았습니다. 선은 지적·법정 경계가 아닙니다. 이름은 기존 건물·행정구역 이름과 겹치지 않도록 일부만 표시합니다.</p>
            <button type="button" onClick={onUnlocated} disabled={unlocatedState.state==='loading'}>위치 미기재 스키장 원본 보기</button>
            <p role="status" aria-live="polite">{unlocatedState.message}</p>
        </>}
    </section>;
}
