import React, {useEffect, useState} from 'react';
import {GEOGRAPHY_CATEGORIES} from './geographyLayer.js';
import './geography-information.css';

// [경계와 지면 원본 속성 / Boundary and ground source attributes]
// 선택 지점의 모든 후보를 페이지로 나누고 각 원본 필드를 생략 없이 표시합니다.
// Paginate all candidates and show every original field for each one.
export default function GeographyInformation({inspection, state}) {
    const [page,setPage]=useState(0);
    useEffect(()=>setPage(0),[inspection]);
    const hits=inspection?.hits||[],size=3,pages=Math.max(1,Math.ceil(hits.length/size)),current=Math.min(page,pages-1);
    const show=value=>value===null||value===undefined||value===''?'미기재':typeof value==='object'?JSON.stringify(value):String(value);
    return <section className="geography-info" aria-labelledby="geography-information-title">
        <header><h2 id="geography-information-title">행정경계 · 지면 정보</h2>
            <p>행정동은 법정동 주소나 지적·필지 경계가 아닙니다. 행정동 자료는 2026년 10월 1일 기준 가공 자료이며 QGIS 백지도는 소축척입니다.</p>
            <p>출처: <a href="https://sgis.kostat.go.kr">국가데이터처 통계지리정보서비스(SGIS)</a> · 가공: <a href="https://github.com/vuski/admdongkor">vuski/admdongkor</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · 추가 가공: 광역별 분할 및 서울 자치구 합집합. 사용자 제공 QGIS 백지도의 원출처와 이용조건은 확인되지 않았습니다.</p>
        </header>
        {state?.state==='loading' && <p role="status">선택 지점의 경계 정보를 불러오고 있습니다.</p>}
        {state?.state==='error' && <p role="status">선택 지점의 경계 정보를 불러오지 못했습니다. 경계 자료 다시 불러오기를 사용해 주세요.</p>}
        {!inspection && state?.state!=='loading' && <p>돋보기로 지점을 선택하거나 현재 중심을 조회하면 경계와 주변 지면 정보를 볼 수 있습니다.</p>}
        {inspection && <><p>{hits.length.toLocaleString('ko-KR')}건 · {current+1} / {pages}쪽 · 선택 반경 {inspection.radius}m</p>
            <div className="geography-info-list">{hits.slice(current*size,current*size+size).map((hit,index)=>{
                const properties=hit.feature.properties||{},fields=properties.fields||properties;
                const name=properties.adm_nm||properties.name||fields.MNG_NAM||fields.ROAD_NAME||GEOGRAPHY_CATEGORIES[hit.category]?.label||'지면 정보';
                return <article key={`${hit.dataset}:${hit.feature.id??index}`}>
                    <h3>{name}</h3><p>{GEOGRAPHY_CATEGORIES[hit.category]?.label||hit.category}{hit.contains?' · 선택 지점 포함':` · ${Math.round(hit.distance)}m`}</p>
                    <dl>{Object.entries(fields).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{show(value)}</dd></div>)}</dl>
                </article>;
            })}</div>
            {pages>1&&<nav className="geography-info-pages" aria-label="경계 정보 페이지"><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>이전 정보</button><span>{current+1} / {pages}</span><button type="button" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>다음 정보</button></nav>}
        </>}
    </section>;
}
