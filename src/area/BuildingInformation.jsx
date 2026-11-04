import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BUILDING_FIELDS, BuildingStore, buildingAddress } from './building-store';
import { searchAllBuildings } from './building-search';
import './building-information.css';

// [조회 순서와 선택 / Inspection ordering and selection]
// 장면 조회와 전체 검색이 같은 세대를 사용해 오래된 응답이 선택을 덮지 않습니다.
// Share an ordering token between scene inspection and search result selection.
export function useBuildingInformation({ onSelected } = {}) {
    const [inspection, setInspection] = useState(null);
    const [inspectionState, setInspectionState] = useState({ state: 'idle', message: '' });
    const store = useRef(null), sequence = useRef(0), selectionLocked = useRef(false), selectedCallback = useRef(onSelected);
    selectedCallback.current = onSelected;
    useEffect(() => {
        const abort = new AbortController(); store.current = new BuildingStore(abort.signal);
        return () => { sequence.current++; abort.abort(); store.current = null; };
    }, []);
    const onStart = useCallback(kind => {
        if (kind === 'click') { sequence.current++; selectionLocked.current = true; }
        return sequence.current;
    }, []);
    const onInspection = useCallback((value, token) => {
        if (token !== sequence.current || (value.kind === 'view' && selectionLocked.current)) return;
        setInspection(value);
    }, []);
    const onState = useCallback((value, token) => {
        if ((token !== undefined && token !== sequence.current) || (value.kind === 'view' && selectionLocked.current)) return;
        setInspectionState(value);
    }, []);
    const resetSelection = useCallback(() => { sequence.current++; selectionLocked.current = false; }, []);
    const onSelectBuilding = useCallback(async value => {
        const token = ++sequence.current; selectionLocked.current = true;
        try {
            if (!store.current) throw new Error('건물 자료를 준비하지 못했습니다.');
            const building = (await store.current.tile(value.tileE, value.tileN)).find(item => item.id === value.id);
            if (token !== sequence.current) return false;
            if (!building) throw new Error('선택한 건물 정보를 찾지 못했습니다.');
            setInspection({ hits: [{ building, contains: false, distance: 0 }], easting: building.easting, northing: building.northing, kind: 'click' });
            setInspectionState({ state: 'ready', message: '선택한 건물 정보를 표시합니다.', kind: 'click' });
            selectedCallback.current?.(building);
            return true;
        } catch (error) {
            if (token !== sequence.current) return false;
            selectionLocked.current = false;
            throw error;
        }
    }, []);
    return { inspection, inspectionState, onStart, onInspection, onState, onSelectBuilding, resetSelection };
}

// [건물 속성 및 검색 / Building attributes and search]
// 모든 원본 필드는 카드에서 확인하고 전 지역은 타일별로 읽습니다.
// Show every original field and load the city catalog one spatial tile at a time.
export function BuildingInformationPanel({ sight, inspection, onSelectBuilding }) {
    const suffix = useId();
    const searchId = `building-search-${suffix}`, tileId = `building-tile-${suffix}`, filterId = `building-filter-${suffix}`, titleId = `building-title-${suffix}`;
    const [browse, setBrowse] = useState('nearby'), [manifest, setManifest] = useState(null), [tileIndex, setTileIndex] = useState(-1);
    const [allBuildings, setAllBuildings] = useState([]), [catalogState, setCatalogState] = useState(''), [catalogFailed, setCatalogFailed] = useState(false), [catalogAttempt, setCatalogAttempt] = useState(0);
    const [page, setPage] = useState(0), [query, setQuery] = useState('');
    const [globalQuery, setGlobalQuery] = useState(''), [searchResults, setSearchResults] = useState([]), [searchStatus, setSearchStatus] = useState(''), [searching, setSearching] = useState(false);
    const store = useRef(null), searchAbort = useRef(null);
    const effectiveBrowse = sight ? browse : 'nearby';
    useEffect(() => {
        const abort = new AbortController(); store.current = new BuildingStore(abort.signal);
        return () => { abort.abort(); searchAbort.current?.abort(); store.current = null; };
    }, []);
    useEffect(() => { if (inspection?.kind === 'click') { setBrowse('nearby'); setPage(0); setQuery(''); } }, [inspection]);
    useEffect(() => {
        if (effectiveBrowse !== 'all' || !store.current) return;
        let active = true; const current = store.current;
        setCatalogFailed(false); setCatalogState('전체 건물 자료를 불러오고 있습니다.');
        current.manifest().then(async value => {
            if (!active) return;
            setManifest(value);
            if (tileIndex < 0) {
                const initial = value.tiles.findIndex(tile => tile[0] === 197 && tile[1] === 552);
                setTileIndex(Math.max(0, initial)); return;
            }
            const tile = value.tiles[tileIndex];
            if (!tile) throw new Error('지역을 찾을 수 없습니다.');
            setAllBuildings([]);
            const buildings = await current.tile(tile[0], tile[1]);
            if (active) { setAllBuildings(buildings); setPage(0); setCatalogState(`선택 지역 ${buildings.length.toLocaleString('ko-KR')}건`); }
        }).catch(() => { if (active) { setAllBuildings([]); setCatalogFailed(true); setCatalogState('전체 건물 자료를 불러오지 못했습니다. 다시 시도해 주세요.'); } });
        return () => { active = false; };
    }, [effectiveBrowse, tileIndex, catalogAttempt]);
    const runSearch = async () => {
        searchAbort.current?.abort();
        const abort = new AbortController(); searchAbort.current = abort;
        setSearching(true); setSearchResults([]); setSearchStatus('서울 전체 자료를 검색하고 있습니다.');
        try {
            const result = await searchAllBuildings(globalQuery, abort.signal, (done, total) => {
                if (!abort.signal.aborted) setSearchStatus(`서울 전체 검색 ${done} / ${total}개 구역`);
            });
            if (abort.signal.aborted) return;
            setSearchResults(result.results);
            setSearchStatus(result.limited ? '200건까지 표시합니다. 더 자세한 주소나 이름으로 검색해 주세요.' : `검색 결과 ${result.results.length}건`);
        } catch (error) {
            if (!abort.signal.aborted) setSearchStatus(error instanceof TypeError ? '검색 색인을 불러오지 못했습니다. 다시 시도해 주세요.' : (error instanceof Error ? error.message : '검색하지 못했습니다.'));
        } finally { if (!abort.signal.aborted) setSearching(false); }
    };
    const selectResult = async value => {
        try { if (await onSelectBuilding(value)) setSearchStatus('선택한 건물의 모든 필드를 아래에 표시합니다.'); }
        catch { setSearchStatus('선택한 건물 정보를 불러오지 못했습니다. 다시 선택해 주세요.'); }
    };
    const entries = effectiveBrowse === 'all' ? allBuildings.map(building => ({ building, contains: false, distance: 0 })) : inspection?.hits || [];
    const needle = query.trim().toLocaleLowerCase();
    const filtered = entries.filter(({ building }) => !needle || [buildingAddress(building), ...building.fields].some(value => String(value ?? '').toLocaleLowerCase().includes(needle)));
    const pageCount = Math.max(1, Math.ceil(filtered.length / 3)), safePage = Math.min(page, pageCount - 1);
    const changeBrowse = value => { setBrowse(value); setPage(0); setQuery(''); };
    return <section className="building-info" aria-labelledby={titleId}>
        <header><h2 id={titleId}>{sight ? '전시천리안 · 건물 정보' : '돋보기 · 건물 정보'}</h2>
            <p>GIS 지번 주소와 원본 29개 필드입니다. 비어 있는 값은 미기재로 표시합니다. 모형 위치는 근사치이며 원본 날짜와 값은 현재와 다를 수 있습니다.</p></header>
        <form className="building-info-search" onSubmit={event => { event.preventDefault(); void runSearch(); }}>
            <label htmlFor={searchId}>서울 전체 주소·건물명 검색<input id={searchId} value={globalQuery} onChange={event => setGlobalQuery(event.currentTarget.value)} placeholder="예: 세종로 81-3" /></label>
            <button type="submit" disabled={searching}>전체 검색</button>
            {searching && <button type="button" onClick={() => { searchAbort.current?.abort(); setSearching(false); setSearchStatus('검색을 중단했습니다.'); }}>검색 중단</button>}
        </form>
        <p role="status" aria-live="polite">{searchStatus}</p>
        {searchResults.length > 0 && <ul className="building-info-results" aria-label="서울 전체 검색 결과">{searchResults.map(value => <li key={value.id}><button type="button" data-tile={`${value.tileE}_${value.tileN}`} data-building-id={value.id} onClick={() => void selectResult(value)}>{value.name || value.address}{value.name && value.address ? ` · ${value.address}` : ''}</button></li>)}</ul>}
        {sight && <div className="building-info-controls" role="group" aria-label="건물 목록 범위">
            <button type="button" aria-pressed={effectiveBrowse === 'nearby'} onClick={() => changeBrowse('nearby')}>현재 주변</button>
            <button type="button" aria-pressed={effectiveBrowse === 'all'} onClick={() => changeBrowse('all')}>서울 전체 자료</button>
        </div>}
        {effectiveBrowse === 'all' && <>
            <p>전체 {(manifest?.totalRecords || 695753).toLocaleString('ko-KR')}건을 지역별로 찾아볼 수 있습니다. 좌표 이상치 2건도 원본 목록에 포함합니다.</p>
            {manifest && <label htmlFor={tileId}>자료 지역 선택<select id={tileId} value={tileIndex} onChange={event => { setTileIndex(Number(event.currentTarget.value)); setPage(0); setQuery(''); }}>
                {manifest.tiles.map(([e,n,count], index) => <option key={`${e}_${n}`} value={index}>동쪽 {e}km · 북쪽 {n}km · {count.toLocaleString('ko-KR')}건</option>)}
            </select></label>}
            <p role="status" aria-live="polite">{catalogState}</p>
            {catalogFailed && <button type="button" onClick={() => setCatalogAttempt(value => value + 1)}>자료 다시 불러오기</button>}
        </>}
        {effectiveBrowse === 'nearby' && <p>{inspection ? `${inspection.kind === 'click' ? '선택 지점' : '화면 중심'} 주변 ${inspection.hits.length.toLocaleString('ko-KR')}건` : '돋보기로 화면을 선택하거나 현재 중심 건물을 조회하세요.'}</p>}
        {entries.length > 0 && <label htmlFor={filterId}>현재 목록에서 찾기<input id={filterId} value={query} onChange={event => { setQuery(event.currentTarget.value); setPage(0); }} placeholder="주소, 건물명, 용도 검색" /></label>}
        <p>{filtered.length.toLocaleString('ko-KR')}건 · {safePage + 1} / {pageCount}쪽</p>
        <div className="building-info-list">{filtered.slice(safePage * 3, safePage * 3 + 3).map(({ building, contains }) => <article className="building-info-card" key={building.id}>
            <h3>{String(building.fields[24] || buildingAddress(building))}</h3><p>{buildingAddress(building)}{contains ? ' · 선택 지점 포함' : ''}</p>
            <dl>{BUILDING_FIELDS.map((label, index) => <div key={label}><dt>{label}</dt><dd>{building.fields[index] === null || building.fields[index] === '' || building.fields[index] === undefined ? '미기재' : String(building.fields[index])}</dd></div>)}</dl>
            <p>원본 도형 행 번호 {building.id}</p></article>)}</div>
        {filtered.length > 3 && <div className="building-info-controls" role="group" aria-label="건물 목록 페이지"><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>이전 건물</button><button type="button" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>다음 건물</button></div>}
    </section>;
}
