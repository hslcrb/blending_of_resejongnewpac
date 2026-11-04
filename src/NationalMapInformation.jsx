import React, { useEffect, useState } from 'react';
import { describeNationalFeature } from './nationalMapRenderer.js';
import './national-map-information.css';

// [지도 원본 속성 / Source map attributes]
// 사용자가 선택한 후보의 모든 필드와 지리 좌표의 한계를 표시합니다.
// Expose every field of selected features and explain the coordinate limitations.
export function NationalMapInformation({ hits = [], status = '' }) {
    const [page,setPage]=useState(0);
    useEffect(()=>setPage(0),[hits]);
    const pages=Math.max(1,Math.ceil(hits.length/3)), current=Math.min(page,pages-1);
    return <section className="national-map-info" aria-label="백지도 지형과 시설 정보">
        <h2>백지도 · 지형과 시설 정보</h2>
        <p>사용자가 제공한 소축척 원본입니다. 제작 시점과 이용 허가가 확인되지 않았으며 위치·시설의 현재 상태와 다를 수 있습니다.</p>
        <p role="status" aria-live="polite">{status || `선택 지점 주변 ${hits.length.toLocaleString('ko-KR')}건 · ${current+1} / ${pages}쪽`}</p>
        {hits.length===0 && <p>돋보기로 지도나 지면을 선택하면 가까운 시설과 지형의 원본 속성이 표시됩니다.</p>}
        <div className="national-map-info-list">{hits.slice(current*3,current*3+3).map(({feature,distance,contains})=>{
            const data=describeNationalFeature(feature);
            return <article key={feature.id} className="national-map-info-card"><h3>{data.name}</h3>
                <p>{data.layer} · {contains ? '선택 지점 포함' : Number.isFinite(distance) ? `선택 지점에서 약 ${Math.round(distance).toLocaleString('ko-KR')}m` : '위치 미기재'}</p>
                <p>{data.anchorWgs84 ? `경도 ${data.anchorWgs84[0]}, 위도 ${data.anchorWgs84[1]}${feature.geometry?.type==='Point' ? '' : ' (도형 범위 중심)'}` : '좌표 미기재'}</p>
                <dl>{data.fields.map(field=><div key={field.name}><dt>{field.name}</dt><dd>{field.value}</dd></div>)}</dl>
                <p>원본 레이어 ID {data.id}</p></article>;
        })}</div>
        {hits.length>3&&<div className="national-map-info-controls" role="group" aria-label="지형과 시설 목록 페이지"><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>이전 시설</button><button type="button" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>다음 시설</button></div>}
    </section>;
}
