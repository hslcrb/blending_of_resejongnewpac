// 사진의 석재 로비와 황동 난간을 재해석합니다. / Recreate the stone lobby and brass gallery from the references.
export function createLobby(THREE,{textures=true}={}) {
 const group=new THREE.Group();group.name='GrandTheatreLobby';
 const makeTexture=()=>{
  if(!textures || typeof document==='undefined') return null;
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.fillStyle='#c1b7a4';ctx.fillRect(0,0,512,512);
  let seed=829;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let x=0;x<512;x+=64)for(let y=0;y<512;y+=64){const t=rand();ctx.fillStyle=t<.22?'#8b8173':t<.58?'#b3a898':'#d1c6b2';ctx.fillRect(x+1,y+1,62,62);ctx.strokeStyle='rgba(73,64,53,.2)';ctx.strokeRect(x+.5,y+.5,63,63);for(let i=0;i<5;i++){ctx.strokeStyle=`rgba(255,255,255,${rand()*.12})`;ctx.beginPath();let xx=x+rand()*64;ctx.moveTo(xx,y);ctx.lineTo(xx+rand()*18-9,y+64);ctx.stroke();}}
  const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,3);texture.colorSpace=THREE.SRGBColorSpace;return texture;
 };
 const marbleMap=makeTexture();
 const mats={stone:new THREE.MeshStandardMaterial({color:0xd2c3aa,roughness:.72}),floor:new THREE.MeshStandardMaterial({color:0xffffff,map:marbleMap,roughness:.72}),ceiling:new THREE.MeshStandardMaterial({color:0xe5d4b9,roughness:.8}),bronze:new THREE.MeshStandardMaterial({color:0x967444,metalness:.72,roughness:.32}),dark:new THREE.MeshStandardMaterial({color:0x231b20,metalness:.22,roughness:.48}),burgundy:new THREE.MeshStandardMaterial({color:0x432331,roughness:.65}),glass:new THREE.MeshStandardMaterial({color:0x526273,metalness:.35,roughness:.23}),red:new THREE.MeshStandardMaterial({color:0x761a29,roughness:.9}),light:new THREE.MeshBasicMaterial({color:0xffe8b2})};
 const box=(name,x,y,z,w,h,d,mat)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.name=name;o.position.set(x,y,z);o.receiveShadow=true;group.add(o);return o;};
 box('LobbyFloor',0,-.12,36.5,31,.24,13,mats.floor);
 const ramp=box('AuditoriumRamp',0,.98,33.5,6.8,.16,9.3,mats.floor);ramp.rotation.x=Math.atan(1.96/9);
 box('LobbyCeiling',0,11.35,36.5,31,.35,13,mats.ceiling);
 for(const x of [-15.4,15.4])box('LobbyOuterWall',x,5.5,36.5,.35,11,13,mats.stone);
 // 관객 출입을 위한 중앙 7m 출입구를 남깁니다. / Leave the central entrance open.
 for(const x of [-9.5,9.5])box('AuditoriumEntranceWall',x,5.5,30,12,11,.35,mats.stone);
 box('EntranceLintel',0,7.1,30,7,1.3,.4,mats.bronze);
 for(const x of [-3.7,3.7])box('EntranceFrame',x,3.35,30,.32,6.7,.5,mats.bronze);
 for(const x of [-11,-7,-3,3,7,11]){box('ExteriorGlazing',x,3,42.9,3.8,6,.16,mats.glass);box('ExteriorMullion',x-1.9,3,42.8,.12,6,.16,mats.bronze);}
 box('ExteriorTransom',0,6.1,42.8,31,.28,.3,mats.bronze);
 // 상부 관람 복도와 반복 무늬 난간 / Upper galleries and repeated decorative rails.
 for(const s of [-1,1]){
  box('GalleryFloor',s*11,3.85,36.5,9,.35,13,mats.stone);
  box('GalleryFascia',s*6.45,3.65,36.5,.25,1.2,13,mats.burgundy);
  box('GalleryGoldLine',s*6.28,4.25,36.5,.12,.09,13,mats.bronze);
  box('GalleryRailTop',s*6.4,5.05,36.5,.16,.12,13,mats.bronze);
  box('GalleryRailBase',s*6.4,4.22,36.5,.16,.1,13,mats.bronze);
  for(let i=0;i<=32;i++)box('GalleryLattice',s*6.4,4.64,30+i*.4,.055,.8,.055,mats.bronze);
  for(let i=0;i<16;i++){const ornament=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,5,12),mats.bronze);ornament.position.set(s*6.32,4.62,30.4+i*.8);ornament.rotation.y=Math.PI/2;group.add(ornament);}
  for(let z=31.5;z<42;z+=2.8){box('WallPanel',s*15.15,7.1,z,.12,3.3,2.45,mats.dark);box('WallPanelTrim',s*15.05,8.8,z,.1,.06,2.5,mats.bronze);}
  for(const z of [34,39]){
   box('MarbleColumn',s*10,5.65,z,1.35,11.3,1.35,mats.stone);
   box('ColumnBase',s*10,.12,z,1.6,.24,1.6,mats.bronze);
   box('ColumnCapital',s*10,10.85,z,1.62,.3,1.62,mats.bronze);
  }
  // 1층 로비의 붉은 계단을 양옆에 두어 중앙 동선을 지킵니다. / Keep the centre circulation clear.
  for(let i=0;i<12;i++)box('RedStair',s*13.2,.12+i*.30,41.4-i*.36,3,.24,.42,mats.red);
  box('StairRail',s*11.55,2.1,39.4,.1,.1,5,mats.bronze);
 }
 for(let z=31.5;z<43;z+=2){for(const x of [-4.5,4.5])box('CeilingLight',x,11.12,z,1.6,.08,.2,mats.light);}
 const lights=[];for(const z of [32,36,40]){const light=new THREE.PointLight(0xffe2b5,65,17,2);light.position.set(0,9,z);group.add(light);lights.push(light);}
 const dispose=()=>{const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());marbleMap?.dispose();};
 return {group,lights,dispose};
}
