import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createLobby} from './theatreLobby.js';
import {stepInside,nearestSeat,seatEyePosition,theatreFloorHeight} from './theatreNavigation.js';
import {createTheatreMedia} from './theatreMedia.js';
import {createEmbedBridge} from './embedBridge.js';
import './theatreExperience.css';

const MODEL='/model/grand-theatre/grand-theatre.glb';
const LAYOUT='/model/grand-theatre/layout.json';
const PLACES={lobby:[0,0,40],auditorium:[0,1.96,28],stage:[0,0,1.5],backstage:[0,0,-13]};
const STAGE_NAMES={curtain:'공연막',open:'무대 전체',shell:'음향 반사판',projection:'영상 영사'};
const disposeScene=root=>{const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());ts.forEach(x=>x.dispose());};

// 대극장 내부에서 로비·객석·무대 뒤를 직접 이동합니다. / Navigate the lobby, seating, stage and backstage.
export default function TheatreExperience(){
 const embedded=new URLSearchParams(location.search).get('embed')==='1';
 const root=useRef(null),canvas=useRef(null),engine=useRef(null),controls=useRef(new Set());
 const [status,setStatus]=useState('로비와 대극장을 불러오고 있습니다.');
 const [mediaStatus,setMediaStatus]=useState('');const [loaded,setLoaded]=useState(false),[seats,setSeats]=useState([]),[seatId,setSeatId]=useState('');
 const [sitting,setSitting]=useState(''),[stage,setStage]=useState('curtain'),[effects,setEffects]=useState(false),[volume,setVolume]=useState(.8),[playing,setPlaying]=useState(false);
 const [currentTime,setCurrentTime]=useState(0),[duration,setDuration]=useState(0);
 useEffect(()=>{if(!embedded || window.parent===window)return;return createEmbedBridge({root:root.current,parent:window.parent});},[embedded]);
 useEffect(()=>{
  let disposed=false,frame=0,readyModel=null,seatMesh=null,media=null,stageObjects={},walkSeats=[],standing=null,last=performance.now(),lastProgress=0,pointer=null;
  const keys=controls.current;const renderer=new THREE.WebGLRenderer({canvas:canvas.current,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x161318);
  const camera=new THREE.PerspectiveCamera(60,1,.08,160);camera.rotation.order='YXZ';camera.position.set(0,1.7,40);
  let yaw=0,pitch=-.02;camera.rotation.set(pitch,yaw,0);
  scene.add(new THREE.HemisphereLight(0xffefd8,0x79604d,1.35));
  const fill=new THREE.DirectionalLight(0xffe9ce,1.1);fill.position.set(8,18,24);scene.add(fill);
  const lobby=createLobby(THREE);scene.add(lobby.group);
  const effectLights=[new THREE.PointLight(0xffba74,70,28,2),new THREE.PointLight(0xffc5a2,65,28,2),new THREE.PointLight(0xffe3ba,55,25,2)];
  effectLights[0].position.set(-8,8,0);effectLights[1].position.set(8,8,0);effectLights[2].position.set(0,11,-8);effectLights.forEach(l=>scene.add(l));
  const resize=()=>{const rect=canvas.current?.getBoundingClientRect();if(!rect || !rect.width || !rect.height)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(canvas.current);resize();
  const setLook=(y,p)=>{yaw=y;pitch=Math.max(-1.1,Math.min(1.1,p));camera.rotation.set(pitch,yaw,0);};
  const faceStage=()=>{const direction=new THREE.Vector3(0,5,0).sub(camera.position);setLook(Math.atan2(-direction.x,-direction.z),Math.atan2(direction.y,Math.hypot(direction.x,direction.z)));};
  const stand=()=>{if(!standing)return;camera.position.copy(standing);standing=null;setSitting('');};
  const go=place=>{const p=PLACES[place];if(!p)return;standing=null;setSitting('');camera.position.set(p[0],p[1]+1.7,p[2]);setLook(place==='backstage'?Math.PI:0,0);setStatus({lobby:'1층 로비',auditorium:'객석 입구',stage:'대극장 무대',backstage:'무대 뒤편'}[place]);};
  const sit=seat=>{if(!seat)return;if(!standing)standing=camera.position.clone();const p=seatEyePosition(seat);camera.position.set(p.x,p.y,p.z);faceStage();setSitting(`${seat.level}층 ${seat.row}열 · ${seat.id}`);setSeatId(seat.id);setStatus('선택한 좌석에 앉았습니다.');};
  const setStageScene=value=>{if(stageObjects.curtain)stageObjects.curtain.visible=value==='curtain';if(stageObjects.shell)stageObjects.shell.visible=value==='shell';if(stageObjects.screen)stageObjects.screen.visible=value==='projection';};
  const key=(e,down)=>{if(e.target instanceof Element && e.target.closest('button,input,select,textarea,a'))return;const k=e.code;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(k)){e.preventDefault();if(down)keys.add(k);else keys.delete(k);}};
  const down=e=>key(e,true),up=e=>key(e,false),blur=()=>keys.clear();window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  const onPointerDown=e=>{if(e.button!==0 && e.pointerType==='mouse')return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.current.setPointerCapture(e.pointerId);canvas.current.focus();};
  const onPointerMove=e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>5)pointer.moved=true;if(pointer.moved)setLook(yaw-dx*.0035,pitch-dy*.003);};
  const onPointerUp=e=>{if(!pointer||pointer.id!==e.pointerId)return;const click=!pointer.moved;pointer=null;if(!click||!seatMesh)return;const rect=canvas.current.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObject(seatMesh)[0];if(hit && Number.isInteger(hit.instanceId)){const seat=seatMesh.userData.seats[hit.instanceId];sit(seat);}};
  const node=canvas.current;node.addEventListener('pointerdown',onPointerDown);node.addEventListener('pointermove',onPointerMove);node.addEventListener('pointerup',onPointerUp);node.addEventListener('pointercancel',onPointerUp);
  const tick=now=>{if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;
   if(!standing){let forward=0,side=0;if(keys.has('KeyW')||keys.has('ArrowUp')||keys.has('forward'))forward++;if(keys.has('KeyS')||keys.has('ArrowDown')||keys.has('back'))forward--;if(keys.has('KeyA')||keys.has('ArrowLeft')||keys.has('left'))side--;if(keys.has('KeyD')||keys.has('ArrowRight')||keys.has('right'))side++;
    if(forward||side){const len=Math.hypot(forward,side),speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?4:2.2)*dt;forward=forward/len*speed;side=side/len*speed;const dx=-Math.sin(yaw)*forward+Math.cos(yaw)*side,dz=-Math.cos(yaw)*forward-Math.sin(yaw)*side;let next=stepInside({x:camera.position.x,z:camera.position.z},{x:camera.position.x+dx,z:camera.position.z},walkSeats);camera.position.x=next.x;next=stepInside({x:camera.position.x,z:camera.position.z},{x:camera.position.x,z:camera.position.z+dz},walkSeats);camera.position.z=next.z;camera.position.y=theatreFloorHeight(camera.position.z)+1.7;}}
   if(media){media.update();if(!media.video.paused && now-lastProgress>=500){lastProgress=now;setCurrentTime(media.video.currentTime||0);setDuration(Number.isFinite(media.video.duration)?media.video.duration:0);}}
   renderer.render(scene,camera);
  };
  engine.current={go,stand,sit,near:()=>seatMesh?nearestSeat(seatMesh.userData.seats.filter(s=>s.level===1),camera.position.x,camera.position.z,2):null,setStage:setStageScene,getMedia:()=>media};
  Promise.all([new GLTFLoader().loadAsync(MODEL),fetch(LAYOUT).then(r=>{if(!r.ok)throw new Error(`좌석 자료 ${r.status}`);return r.json();})]).then(([gltf,layout])=>{
   if(disposed){disposeScene(gltf.scene);return;}readyModel=gltf.scene;scene.add(readyModel);
   const curtain=readyModel.getObjectByName('GrandCurtain'),shell=readyModel.getObjectByName('GrandAcousticShell'),screen=readyModel.getObjectByName('GrandProjectionScreen');stageObjects={curtain,shell,screen};
   const items=(layout.seats||[]).filter(s=>Array.isArray(s.position));if(!items.length||!screen||!curtain||!shell)throw new Error('좌석 또는 무대 구성 자료가 없습니다.');
   walkSeats=items.filter(s=>s.level===1);setSeats(items);setSeatId(items[0].id);
   const geometry=new THREE.BoxGeometry(.65,1.05,.75),material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});seatMesh=new THREE.InstancedMesh(geometry,material,items.length);seatMesh.name='SeatSelectionTargets';seatMesh.userData.seats=items;seatMesh.frustumCulled=false;const matrix=new THREE.Matrix4();items.forEach((seat,i)=>{const [x,y,z]=seat.position;matrix.makeTranslation(x,y+.55,z);seatMesh.setMatrixAt(i,matrix);});scene.add(seatMesh);
   setStageScene('curtain');try{media=createTheatreMedia({THREE,camera,screen,effectLights,onStatus:message=>{if(!disposed){setMediaStatus(message);if(message==='영상이 끝났습니다.')setPlaying(false);}}});}catch(error){setMediaStatus('공간 음향을 준비하지 못했습니다. 브라우저 오디오 설정을 확인해 주세요.');}
   setLoaded(true);setStatus('1층 로비에서 시작합니다. 화면을 끌어 둘러보고 W·A·S·D 또는 이동 버튼으로 걸어보세요.');
  }).catch(error=>{if(!disposed)setStatus(`대극장을 불러오지 못했습니다: ${error.message}. 새로고침해 다시 시도해 주세요.`);});
  frame=requestAnimationFrame(tick);
  return()=>{disposed=true;cancelAnimationFrame(frame);keys.clear();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);node.removeEventListener('pointerdown',onPointerDown);node.removeEventListener('pointermove',onPointerMove);node.removeEventListener('pointerup',onPointerUp);node.removeEventListener('pointercancel',onPointerUp);observer.disconnect();media?.dispose();if(seatMesh){seatMesh.geometry.dispose();seatMesh.material.dispose();}if(readyModel)disposeScene(readyModel);lobby.dispose();renderer.dispose();engine.current=null;};
 },[]);
 const changeStage=value=>{setStage(value);engine.current?.setStage(value);};
 const play=async()=>{const m=engine.current?.getMedia();if(!m){setMediaStatus('영사기를 준비하고 있습니다.');return;}changeStage('projection');try{await m.play();setPlaying(true);}catch{setPlaying(false);}};
 const pause=()=>{engine.current?.getMedia()?.pause();setPlaying(false);};
 const changeEffects=e=>{const enabled=e.target.checked;setEffects(enabled);engine.current?.getMedia()?.setEffects(enabled);};
 const changeVolume=e=>{const v=Number(e.target.value);setVolume(v);engine.current?.getMedia()?.setVolume(v);};
 const action=(direction,down)=>{if(down)controls.current.add(direction);else controls.current.delete(direction);};
 const moveButton=(label,direction)=><button type="button" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);action(direction,true);}} onPointerUp={()=>action(direction,false)} onPointerCancel={()=>action(direction,false)} onLostPointerCapture={()=>action(direction,false)}>{label}</button>;
 const selected=seats.find(s=>s.id===seatId);
 return <main ref={root} className={`theatre-page${embedded?' embedded':''}`}>
  <header className="theatre-header"><div><a href={embedded?'?embed=1':'?'}>← 건축 산책으로 돌아가기</a><h1>세종문화회관 대극장</h1><p>1층 로비에서 객석과 무대 뒤까지 둘러보세요.</p></div><p className="theatre-note">사진과 약도를 바탕으로 구성한 비공식 체험입니다. 확인되지 않은 뒤편 구조는 상상으로 표현했습니다.</p></header>
  <section className="theatre-visit" aria-label="대극장 내부 3D 체험">
   <div className="theatre-view"><canvas ref={canvas} tabIndex="0" aria-label="대극장 내부 3D 화면. 드래그하여 둘러보고 방향키 또는 W A S D로 이동하세요."/><div className="theatre-view-status" role="status">{status}</div></div>
   <div className="theatre-controls">
    <div className="theatre-control-group"><h2>공간 이동</h2><div className="theatre-buttons">{Object.entries({lobby:'1층 로비',auditorium:'객석 입구',stage:'무대',backstage:'무대 뒤편'}).map(([key,label])=><button key={key} disabled={!loaded} onClick={()=>engine.current?.go(key)}>{label}</button>)}</div><p>화면을 끌어 둘러보고 W·A·S·D 또는 아래 버튼으로 이동합니다.</p><div className="theatre-move" aria-label="이동 버튼">{moveButton('앞으로','forward')}<span>{moveButton('왼쪽','left')}{moveButton('뒤로','back')}{moveButton('오른쪽','right')}</span></div></div>
    <div className="theatre-control-group"><h2>객석에 앉기</h2><p>화면에서 좌석을 누르거나 아래 목록에서 선택하세요.</p><label>좌석 <select value={seatId} disabled={!loaded} onChange={e=>setSeatId(e.target.value)}>{seats.map(seat=><option key={seat.id} value={seat.id}>{seat.level}층 {seat.row}열 · {seat.id}</option>)}</select></label><div className="theatre-buttons"><button disabled={!loaded||!selected} onClick={()=>engine.current?.sit(selected)}>선택한 좌석에 앉기</button><button disabled={!loaded} onClick={()=>{const seat=engine.current?.near();if(seat)engine.current.sit(seat);else setStatus('가까운 객석으로 이동하거나 좌석을 선택해 주세요.');}}>가까운 좌석에 앉기</button><button disabled={!sitting} onClick={()=>engine.current?.stand()}>일어서기</button></div>{sitting&&<p role="status">{sitting}에 앉아 있습니다.</p>}</div>
    <div className="theatre-control-group"><h2>무대 장면</h2><div className="theatre-buttons">{Object.entries(STAGE_NAMES).map(([key,label])=><button key={key} disabled={!loaded} aria-pressed={stage===key} onClick={()=>changeStage(key)}>{label}</button>)}</div><p>공연막을 열면 무대와 그 뒤편을 볼 수 있습니다.</p></div>
    <div className="theatre-control-group"><h2>영상 영사와 공간 음향</h2><p>제공된 영상이 무대 스크린에 재생됩니다. 헤드폰을 사용하면 공간감을 더 잘 느낄 수 있습니다.</p><div className="theatre-buttons"><button disabled={!loaded} onClick={playing?pause:play}>{playing?'일시 정지':'영상 재생'}</button></div><label>음량 <input type="range" min="0" max="1" step="0.05" value={volume} onChange={changeVolume}/></label><label>재생 위치 <input type="range" min="0" max={duration||1} step="0.1" value={Math.min(currentTime,duration||1)} disabled={!duration} onChange={e=>{const v=Number(e.target.value),m=engine.current?.getMedia();if(m)m.video.currentTime=v;setCurrentTime(v);}}/></label><label className="theatre-check"><input type="checkbox" checked={effects} onChange={changeEffects}/>영상에 반응하는 무대효과</label>{mediaStatus&&<p role="status">{mediaStatus}</p>}</div>
   </div>
  </section>
 </main>;
}
