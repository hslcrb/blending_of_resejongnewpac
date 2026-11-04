import React, {useEffect, useMemo, useState} from 'react';
import {NationalBuildingStore} from './nationalBuildingStore.js';
import {FIELD_LABELS, NUMERIC_FIELDS, formatCulturalField} from './nationalCulturalData.js';
import './nationalCulturalExplorer.css';
import './nationalBuildingChanges.css';

export default function NationalBuildingChanges({inspection, active, sight}) {
 const store=useMemo(()=>new NationalBuildingStore(),[]);
 const [manifest,setManifest]=useState(null),[manifestError,setManifestError]=useState(''),[attempt,setAttempt]=useState(0);
 const [radius,setRadius]=useState(75),[page,setPage]=useState(0),[state,setState]=useState({status:'idle',hits:[]});
 useEffect(()=>()=>store.dispose(),[store]);
 useEffect(()=>{if(!active)return;let alive=true;setManifestError('');store.manifest().then(m=>{if(alive)setManifest(m);}).catch(e=>{if(alive)setManifestError(e.message);});return()=>{alive=false;};},[active,attempt,store]);
 const easting=inspection?.easting,northing=inspection?.northing;
 useEffect(()=>{
  const controller=new AbortController();setPage(0);
  if(!active||!Number.isFinite(easting)||!Number.isFinite(northing)){setState({status:'idle',hits:[]});return()=>controller.abort();}
  setState({status:'loading',hits:[]});
  const timer=setTimeout(()=>store.around(easting,northing,{radius,signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setState({status:'ready',hits:result.hits});}).catch(error=>{if(!controller.signal.aborted)setState({status:'error',hits:[],message:error.message});}),250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[active,easting,northing,radius,attempt,store]);
 if(!active)return null;
 const total=state.hits.length,pages=Math.max(1,Math.ceil(total/5)),items=state.hits.slice(page*5,page*5+5);
 return <section className="national-explorer national-changes" aria-label="전국 건물 변경 자료">
  <h2>전국 건물 변경 자료</h2><p>출처: CH_D010_00_20261103, 2026년 11월 3일 건물 신규·수정 변경분(I/U). 전체 건물 현황이 아니며 삭제(D) 자료는 제외됩니다. 원본 주소는 법정동·지번이며 값은 변경 당시 자료입니다.</p>
  {manifest&&<p>위치가 있는 변경 {manifest.totalRecords.toLocaleString('ko-KR')}건 · 위치 없는 자료 {manifest.unlocatedCount.toLocaleString('ko-KR')}건. 필드 설명은 원본 코드와 함께 표시합니다.</p>}
  {manifestError&&<div role="alert"><p>변경 자료 목록을 불러오지 못했습니다: {manifestError}</p><button onClick={()=>setAttempt(x=>x+1)}>다시 불러오기</button></div>}
  {sight&&manifest&&<details><summary>전국 변경 건물 분포 보기</summary><p>10km 격자별 변경 건수의 개략 분포입니다. 점의 위치는 격자 중심이며 개별 건물의 위치가 아닙니다. 목록만 사용하므로 전국 타일을 내려받지 않습니다.</p><RegionalMap tiles={manifest.tiles}/></details>}
  <label>선택 위치 주변 반경 <select value={radius} onChange={e=>setRadius(Number(e.target.value))}><option value={25}>25m</option><option value={75}>75m</option><option value={150}>150m</option></select></label>
  {state.status==='idle'&&<p>돋보기로 지점을 누르거나 전국 문화시설 위치를 선택하세요.</p>}
  {state.status==='loading'&&<p role="status">선택 위치 주변 변경 건물을 불러오는 중입니다.</p>}
  {state.status==='error'&&<div role="alert"><p>변경 건물 조회 실패: {state.message}</p><button onClick={()=>setAttempt(x=>x+1)}>다시 불러오기</button></div>}
  {state.status==='ready'&&<><p role="status">선택 지점에서 {radius}m 이내 변경 건물 {total.toLocaleString('ko-KR')}건</p>{total===0&&<p>이 범위에 기록된 변경 건물이 없습니다. 전체 건물이 없다는 뜻은 아닙니다.</p>}
   <ul className="national-list">{items.map(({building,distance,contains})=><li className="national-card" key={building.id}><h3>{building.fields[24]||'건물명 미기재'}</h3><p>{[building.fields[4],building.fields[5]].filter(Boolean).join(' ')||'지번 주소 미기재'}</p><p>{contains?'선택 지점 포함':`도형까지 ${distance.toFixed(1)}m`} · {building.fields[29]==='I'?'신규 변경':building.fields[29]==='U'?'수정 변경':'변경 유형 미확인'} · 원본 행 {building.id}</p><details><summary>원본 31개 필드 보기</summary><dl>{FIELD_LABELS.map((label,i)=><div key={i}><dt>{label} <span>(A{i})</span></dt><dd>{formatCulturalField(building.fields[i],NUMERIC_FIELDS.has(i))}</dd></div>)}</dl></details></li>)}</ul>
   {pages>1&&<nav className="national-pages" aria-label="변경 건물 페이지"><button disabled={!page} onClick={()=>setPage(page-1)}>이전 페이지</button><span>{page+1} / {pages}쪽</span><button disabled={page>=pages-1} onClick={()=>setPage(page+1)}>다음 페이지</button></nav>}</>}
 </section>;
}
function RegionalMap({tiles}) {
 if(!tiles.length)return <p>표시할 격자가 없습니다.</p>;
 const es=tiles.map(t=>t[0]),ns=tiles.map(t=>t[1]),minE=Math.min(...es),maxE=Math.max(...es),minN=Math.min(...ns),maxN=Math.max(...ns);
 const scale=Math.max(maxE-minE,maxN-minN,1),width=(maxE-minE+1)/scale*360,height=(maxN-minN+1)/scale*360;
 return <svg role="img" aria-label="전국 10km 격자별 건물 변경 분포" viewBox={`0 0 ${width} ${height}`}><rect width={width} height={height} fill="#e8f2ef"/>{tiles.map(([e,n,count])=><circle key={`${e}_${n}`} cx={(e-minE+0.5)/scale*360} cy={(maxN-n+0.5)/scale*360} r={Math.max(1,Math.min(4,Math.sqrt(count)/5))} fill="#8552a7" opacity=".8"><title>{`격자 ${e}, ${n}: ${count}건`}</title></circle>)}</svg>;
}
