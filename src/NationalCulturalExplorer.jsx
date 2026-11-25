import React, { useEffect, useId, useMemo, useState } from 'react';
import { FIELD_LABELS, NUMERIC_FIELDS, CULTURAL_REGIONS, culturalRegion, filterCulturalCandidates, formatCulturalField, pageCulturalCandidates, parseCulturalCollection } from './nationalCulturalData.js';
import './nationalCulturalExplorer.css';

// 변경 자료의 필드 이름은 원본 코드와 함께 표시합니다.
// Keep source codes visible beside the provisional field descriptions.
const PAGE_SIZE = 10;

/**
 * Shows candidate records from a building change dataset, not a venue directory.
 * onSelectLocation receives {id, coordinates: [longitude, latitude], fields}.
 * When no callback is supplied, no location-action button is shown.
 */
export default function NationalCulturalExplorer({ onSelectLocation, dataUrl = '/data/national-cultural-changes.geojson' }) {
    const id = useId();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ status: 'loading', features: [] });
    const [region, setRegion] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);

    // 불러오기와 오류 복구 / Loading and retry
    useEffect(() => {
        const controller = new AbortController();
        setState({ status: 'loading', features: [] });
        fetch(dataUrl, { signal: controller.signal }).then(response => {
            if (!response.ok) throw new Error('bad response');
            return response.json();
        }).then(data => {
            if (!controller.signal.aborted) setState({ status: 'ready', features: parseCulturalCollection(data) });
        }).catch(() => {
            if (!controller.signal.aborted) setState({ status: 'error', features: [] });
        });
        return () => controller.abort();
    }, [dataUrl, attempt]);

    const matches = useMemo(() => filterCulturalCandidates(state.features, query, region), [state.features, query, region]);
    const current = pageCulturalCandidates(matches, page, PAGE_SIZE);
    const setRegionFilter = event => { setRegion(event.target.value); setPage(0); };
    const setQueryFilter = event => { setQuery(event.target.value); setPage(0); };

    return <section className="national-explorer" aria-labelledby={`${id}-heading`}>
        <div className="national-intro">
            <p className="national-kicker">전국 문화공간 살펴보기</p>
            <h2 id={`${id}-heading`}>다른 지역의 문화·집회 건물 후보</h2>
            <p>2026년 11월 3일 건축물 변경 자료에서 찾은 후보입니다. 전국 전체 목록이 아니며 실제 운영 여부는 확인되지 않았습니다.</p>
            <p>주소는 법정동과 지번이며, 위치는 건물 윤곽 안의 대표점입니다. 표시된 정보는 변경 당시 원본 값일 수 있습니다.</p>
        </div>
        {state.status === 'loading' && <p role="status">전국 변경 자료를 불러오고 있습니다.</p>}
        {state.status === 'error' && <div className="national-error" role="alert"><p>전국 변경 자료를 불러오지 못했습니다.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></div>}
        {state.status === 'ready' && <>
            <div className="national-filters">
                <div><label htmlFor={`${id}-region`}>지역</label><select id={`${id}-region`} value={region} onChange={setRegionFilter}>
                    <option value="">전체 지역</option>
                    {CULTURAL_REGIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select></div>
                <div><label htmlFor={`${id}-search`}>건물명 또는 지번 검색</label><input id={`${id}-search`} type="search" value={query} onChange={setQueryFilter} placeholder="건물명, 동 이름 또는 지번" /></div>
            </div>
            <p className="national-results" role="status" aria-live="polite">변경 자료 후보 {state.features.length.toLocaleString('ko-KR')}건 · 현재 조건 {matches.length.toLocaleString('ko-KR')}건 · {current.page + 1} / {current.pages}쪽</p>
            {matches.length === 0 ? <p className="national-empty">{region && !query.trim() ? '이 자료에 후보가 없습니다.' : '검색 조건에 맞는 후보가 없습니다.'}</p> : <ul className="national-list">
                {current.items.map(feature => {
                    const fields = feature.properties.fields;
                    const address = [fields.A4, fields.A5].filter(Boolean).join(' ') || '지번 주소 미기재';
                    return <li className="national-card" key={feature.id}>
                        <div className="national-card-heading"><div><span>{culturalRegion(fields.A30)}</span><h3>{fields.A24 || '건물명 미기재'}</h3></div><span className="national-type">{fields.A29 === 'I' ? '신규 변경' : fields.A29 === 'U' ? '수정 변경' : '변경 유형 미확인'}</span></div>
                        <p>{address}</p><p>용도: {formatCulturalField(fields.A9, false)} · 원본 도형 행 번호 {feature.id}</p>
                        {typeof onSelectLocation === 'function' && (feature.geometry ? <button type="button" onClick={() => onSelectLocation({ id: feature.id, coordinates: feature.geometry.coordinates.slice(), fields: { ...fields } })}>이 후보의 위치 보기</button> : <p>위치 정보 미기재</p>)}
                        <details><summary>원본 31개 필드 보기</summary><dl>
                            {FIELD_LABELS.map((label, index) => <div key={index}><dt>{label} <span>(A{index})</span></dt><dd>{formatCulturalField(fields[`A${index}`], NUMERIC_FIELDS.has(index))}</dd></div>)}
                        </dl></details>
                    </li>;
                })}
            </ul>}
            <nav className="national-pages" aria-label="후보 페이지">
                <button type="button" disabled={current.page === 0} onClick={() => setPage(current.page - 1)}>이전 페이지</button>
                <span>{current.page + 1} / {current.pages}쪽</span>
                <button type="button" disabled={current.page >= current.pages - 1} onClick={() => setPage(current.page + 1)}>다음 페이지</button>
            </nav>
        </>}
    </section>;
}
