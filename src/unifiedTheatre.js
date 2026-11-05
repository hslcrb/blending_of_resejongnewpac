import * as THREE from 'three';
import {createLobby} from './theatreLobby.js';
import {createTheatreMedia} from './theatreMedia.js';
import {nearestSeat,seatEyePosition,theatreFloorHeight,seatVisible} from './theatreNavigation.js';
import {THEATRE_PLACEMENT,theatreToCampus,campusToTheatre,isTheatreInterior,canWalkUnified,unifiedFloorHeight} from './theatrePlacement.js';
import {disposeModelResources} from './modelResources.js';

// 외관 뷰어의 scene와 camera를 그대로 사용합니다. / Reuse the exterior viewer's scene and camera.
export function createUnifiedTheatre({detail,camera,loadGltf,onState=()=>{},onLookAt=()=>{},fetcher=(...args)=>fetch(...args)}){
 const root=new THREE.Group();root.name='UnifiedGrandTheatre';root.position.fromArray(THEATRE_PLACEMENT.position);root.scale.setScalar(THEATRE_PLACEMENT.scale);detail.add(root);
 const lobby=createLobby(THREE);root.add(lobby.group);
 const lights=[];for(const z of [0,7,14,21,28])for(const x of [-7,7]){const l=new THREE.PointLight(0xffd6ad,190,28,2);l.position.set(x,9,z);root.add(l);lights.push(l);}
 const stageLights=[new THREE.PointLight(0xffba74,100,35,2),new THREE.PointLight(0xffd9ac,95,35,2)];stageLights[0].position.set(-8,8,-1);stageLights[1].position.set(8,8,-1);stageLights.forEach(l=>root.add(l));
 const beamGeometry=new THREE.BufferGeometry(),vertices=[],apex=[0,10.8,25],corners=[[-8,2.25,-1.12],[8,2.25,-1.12],[8,11.25,-1.12],[-8,11.25,-1.12]];for(let i=0;i<4;i++)vertices.push(...apex,...corners[i],...corners[(i+1)%4]);beamGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const beamMaterial=new THREE.MeshBasicMaterial({color:0xffefcf,transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});const beam=new THREE.Mesh(beamGeometry,beamMaterial);beam.visible=false;root.add(beam);
 const projector=new THREE.Mesh(new THREE.BoxGeometry(.8,.4,.9),new THREE.MeshStandardMaterial({color:0x242225,roughness:.58}));projector.position.set(...apex);root.add(projector);

 let disposed=false,promise=null,abort=new AbortController(),model=null,seatMesh=null,media=null,level=1,seated=null,lastProgress=0,wasInside=false;
 let stageNodes={},pendingModel=null;let state={status:'idle',message:'회관의 유리 출입구를 지나 로비와 객석으로 걸어 들어갈 수 있습니다.',seats:[],seatId:'',sitting:'',stage:'curtain',playing:false,effects:false,volume:.8,currentTime:0,duration:0,inside:false};
 const publish=patch=>{if(disposed)return;state={...state,...patch};onState(state);};
 const moveCamera=p=>{const c=theatreToCampus(p),world=detail.localToWorld(new THREE.Vector3(c.x,c.y,c.z));camera.position.copy(world);};
 const setStage=value=>{state.stage=value;beam.visible=value==='projection';if(stageNodes.curtain)stageNodes.curtain.visible=value==='curtain';if(stageNodes.shell)stageNodes.shell.visible=value==='shell';if(stageNodes.screen)stageNodes.screen.visible=value==='projection';publish({stage:value});};
 const sit=seat=>{if(!seat)return;seated=seat;level=seat.level;moveCamera(seatEyePosition(seat));const target=theatreToCampus({x:0,y:5,z:0});onLookAt(detail.localToWorld(new THREE.Vector3(target.x,target.y,target.z)));publish({seatId:seat.id,sitting:`${seat.level}층 ${seat.row}열 · ${seat.id}`,message:'선택한 좌석에 앉았습니다.'});};
 const stand=()=>{if(!seated)return;const [sx,,z]=seated.position;const x=[-8.4,0,8.4].reduce((best,a)=>Math.abs(a-sx)<Math.abs(best-sx)?a:best,0);moveCamera({x,y:theatreFloorHeight(z,x,level)+1.7/THEATRE_PLACEMENT.scale,z});seated=null;publish({sitting:'',message:'같은 층 통로에 섰습니다. 직접 걸어 이동할 수 있습니다.'});};
 const load=()=>{if(promise)return promise;publish({status:'loading'});promise=Promise.all([loadGltf('/model/grand-theatre/grand-theatre-campus.glb',{signal:abort.signal}).then(g=>{pendingModel=g.scene;return g;}),fetcher('/model/grand-theatre/layout.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('좌석 자료 요청 실패');return r.json();})]).then(([gltf,layout])=>{
  if(disposed){disposeModelResources(gltf.scene);return;}model=gltf.scene;root.add(model);const seats=layout.seats||[];stageNodes={curtain:model.getObjectByName('GrandCurtain'),shell:model.getObjectByName('GrandAcousticShell'),screen:model.getObjectByName('GrandProjectionScreen')};if(!seats.length||!stageNodes.screen)throw new Error('대극장 구성 자료가 없습니다.');
  seatMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.65,1.05,.75),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}),seats.length);seatMesh.name='UnifiedSeatTargets';const m=new THREE.Matrix4();seats.forEach((s,i)=>{m.makeTranslation(s.position[0],s.position[1]+.55,s.position[2]);seatMesh.setMatrixAt(i,m);});seatMesh.userData.seats=seats;seatMesh.frustumCulled=false;root.add(seatMesh);root.updateWorldMatrix(true,true);
  const chosen=seats.filter(s=>s.level===1).reduce((b,s)=>Math.abs(s.position[0])+Math.abs(s.position[2]-15)<Math.abs(b.position[0])+Math.abs(b.position[2]-15)?s:b);
  setStage('curtain');publish({status:'ready',seats,seatId:chosen.id});
 }).catch(e=>{promise=null;if(state.status!=='ready'&&pendingModel){pendingModel.removeFromParent();disposeModelResources(pendingModel);pendingModel=null;model=null;}if(!disposed&&e.name!=='AbortError')publish({status:'error',message:'실내를 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.'});throw e;});return promise;};
 const ensureMedia=()=>{if(media)return media;if(!stageNodes.screen)throw new Error('영사 화면을 준비 중입니다.');media=createTheatreMedia({THREE,camera,screen:stageNodes.screen,effectLights:stageLights,onStatus:message=>publish({mediaMessage:message,playing:message==='영상과 공간 음향 재생 중'})});media.setVolume(state.volume);media.setEffects(state.effects);return media;};
 return {
  root,load,getState:()=>state,
  reset(){seated=null;level=1;publish({sitting:''});},
  isInside:p=>isTheatreInterior(p),isSitting:()=>Boolean(seated),
  canMove(current,next,base){if(state.status!=='ready'&&isTheatreInterior(next))return false;const p=campusToTheatre(next);if(p.z<=-10.24&&(p.x< -7||p.x>14.8))return false;if(state.stage==='curtain'){const a=campusToTheatre(current);if((a.z-.35)*(p.z-.35)<0&&Math.abs(p.x)<12.8)return false;}return canWalkUnified(current,next,base,state.seats,level);},
  floor:p=>unifiedFloorHeight(p,level),
  sit:id=>sit(state.seats.find(s=>s.id===id)),stand,
  sitNear(){const p=campusToTheatre(detail.worldToLocal(camera.position.clone()));sit(nearestSeat(state.seats.filter(s=>s.level===level),p.x,p.z,2));},
  pick(event,element){if(!seatMesh || !isTheatreInterior(detail.worldToLocal(camera.position.clone())))return;const rect=element.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObject(seatMesh)[0];if(!hit)return;const solid=ray.intersectObjects([model,lobby.group],true).find(h=>{let n=h.object;while(n){if(!n.visible)return false;n=n.parent;}return true;});if(seatVisible(hit.distance,solid?.distance))sit(state.seats[hit.instanceId]);},
  setStage,select:id=>publish({seatId:id}),
  async play(){try{setStage('projection');await ensureMedia().play();}catch(e){publish({playing:false,mediaMessage:e.message});}},
  pause(){media?.pause();publish({playing:false});},
  effects(value){publish({effects:value});media?.setEffects(value);},volume(value){publish({volume:value});media?.setVolume(value);},seek(value){if(media)media.video.currentTime=value;publish({currentTime:value});},
  update(time,p){const inside=isTheatreInterior(p);if(inside!==wasInside){wasInside=inside;publish({inside,message:inside?'같은 회관 모형 안의 로비·객석입니다. 출입구로 다시 걸어 나갈 수 있습니다.':'회관 외부입니다. 유리 출입구를 통해 직접 들어가세요.'});}media?.update();if(media&&time-lastProgress>500){lastProgress=time;publish({currentTime:media.video.currentTime||0,duration:Number.isFinite(media.video.duration)?media.video.duration:0});}},
  dispose(){disposed=true;abort.abort();media?.dispose();seatMesh?.geometry.dispose();seatMesh?.material.dispose();if(model)disposeModelResources(model);beamGeometry.dispose();beamMaterial.dispose();projector.geometry.dispose();projector.material.dispose();lobby.dispose();root.removeFromParent();},
 };
}
