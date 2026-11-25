import React from 'react';
import './unifiedTheatre.css';
// 외관과 같은 모형에서 실내 기능을 조작합니다. / Interior controls for the shared exterior model.
export default function UnifiedTheatreControls({state={},viewerRef,onWalk,initialOpen=false}){
 const ready=state.status==='ready',api=()=>viewerRef.current?.theatre;
 return <details className="unified-theatre" open={initialOpen||state.inside}>
  <summary>대극장 내부 · 같은 모형에서 입장</summary>
  <p role="status">{state.message||'유리 출입구를 지나 로비와 객석으로 직접 걸어 들어가세요.'}</p>
  <button type="button" onClick={onWalk}>유리 출입구를 향해 걷기</button>
  {state.status==='error'&&<button onClick={()=>void api()?.load().catch(()=>{})}>실내 다시 불러오기</button>}
  <div className="unified-theatre-controls">
   <div><h3>객석</h3><label>좌석 <select aria-label="대극장 좌석" value={state.seatId||''} disabled={!ready} onChange={e=>api()?.select(e.target.value)}>{(state.seats||[]).map(s=><option key={s.id} value={s.id}>{s.level}층 {s.row}열 · {s.id}</option>)}</select></label><div className="unified-buttons"><button disabled={!ready} onClick={()=>{onWalk(false);api()?.sit(state.seatId);}}>선택한 좌석에 앉기</button><button disabled={!ready} onClick={()=>{onWalk(false);api()?.sitNear();}}>가까운 좌석에 앉기</button><button disabled={!state.sitting} onClick={()=>api()?.stand()}>일어서기</button></div>{state.sitting&&<p>{state.sitting}에 앉아 있습니다.</p>}</div>
   <div><h3>무대</h3><div className="unified-buttons">{Object.entries({curtain:'공연막',open:'무대 전체',shell:'음향 반사판',projection:'영상 영사'}).map(([key,label])=><button key={key} disabled={!ready} aria-pressed={state.stage===key} onClick={()=>api()?.setStage(key)}>{label}</button>)}</div></div>
   <div><h3>영사와 공간 음향</h3><button disabled={!ready} onClick={()=>state.playing?api()?.pause():void api()?.play()}>{state.playing?'일시 정지':'영상 재생'}</button><label>음량 <input type="range" min="0" max="1" step=".05" disabled={!ready} value={state.volume??.8} onChange={e=>api()?.volume(Number(e.target.value))}/></label><label>재생 위치 <input type="range" min="0" max={state.duration||1} step=".1" disabled={!state.duration} value={Math.min(state.currentTime||0,state.duration||1)} onChange={e=>api()?.seek(Number(e.target.value))}/></label><label><input type="checkbox" disabled={!ready} checked={state.effects||false} onChange={e=>api()?.effects(e.target.checked)}/>영상에 반응하는 무대효과</label>{state.mediaMessage&&<p role="status">{state.mediaMessage}</p>}</div>
  </div>
  <p>화면을 끌어 둘러보고 W·A·S·D 또는 방향 버튼으로 이동합니다. 헤드폰을 사용하면 공간 음향을 더 잘 느낄 수 있습니다.</p>
 </details>;
}
