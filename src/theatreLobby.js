// 사진의 석재 로비와 황동 난간을 재해석합니다. / Recreate the stone lobby and brass gallery from the references.
export function createLobby(THREE,{textures=true}={}) {
 const group=new THREE.Group();group.name='GrandTheatreLobby';
 const makeTexture=()=>{
  if(!textures || typeof document==='undefined') return null;
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.fillStyle='#c1b7a4';ctx.fillRect(0,0,512,512);
  let seed=829;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let x=0;x<512;x+=64)for(let y=0;y<512;y+=64){const t=rand();ctx.fillStyle=t<.22?'#a99e8e':t<.58?'#bdb09e':'#d2c5b1';ctx.fillRect(x+1,y+1,62,62);ctx.strokeStyle='rgba(73,64,53,.2)';ctx.strokeRect(x+.5,y+.5,63,63);for(let i=0;i<5;i++){ctx.strokeStyle=`rgba(255,255,255,${rand()*.12})`;ctx.beginPath();let xx=x+rand()*64;ctx.moveTo(xx,y);ctx.lineTo(xx+rand()*18-9,y+64);ctx.stroke();}}
  const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,3);texture.colorSpace=THREE.SRGBColorSpace;return texture;
 };
 const marbleMap=makeTexture();
 const makeStone=()=>{if(!textures||typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#f5ecdf';ctx.fillRect(0,0,512,512);let seed=731;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<110;i++){let x=rand()*512;ctx.strokeStyle=`rgba(108,91,73,${.025+rand()*.065})`;ctx.lineWidth=.4+rand()*2;ctx.beginPath();ctx.moveTo(x,-10);for(let y=0;y<=530;y+=30){x+=rand()*19-9;ctx.lineTo(x,y);}ctx.stroke();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,3);t.colorSpace=THREE.SRGBColorSpace;return t;};
 const stoneMap=makeStone();
 const mats={stone:new THREE.MeshStandardMaterial({color:0xd2c3aa,map:stoneMap,roughness:.72}),floor:new THREE.MeshStandardMaterial({color:0xffffff,map:marbleMap,roughness:.72}),ceiling:new THREE.MeshStandardMaterial({color:0xe5d4b9,roughness:.8}),bronze:new THREE.MeshStandardMaterial({color:0x967444,metalness:.72,roughness:.32}),dark:new THREE.MeshStandardMaterial({color:0x231b20,metalness:.22,roughness:.48}),burgundy:new THREE.MeshStandardMaterial({color:0x432331,roughness:.65}),glass:new THREE.MeshStandardMaterial({color:0x526273,metalness:.35,roughness:.23}),red:new THREE.MeshStandardMaterial({color:0x761a29,roughness:.9}),light:new THREE.MeshBasicMaterial({color:0xffe8b2})};
 const box=(name,x,y,z,w,h,d,mat)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.name=name;o.position.set(x,y,z);o.receiveShadow=true;group.add(o);return o;};
 box('LobbyFloor',0,-.12,45,31,.24,30,mats.floor);
 const ramp=box('AuditoriumRamp',0,.98,33.5,6.8,.16,9.3,mats.floor);ramp.rotation.x=Math.atan(1.96/9);
 box('LobbyCeiling',0,11.35,45,31,.35,30,mats.ceiling);
 for(const x of [-15.4,15.4])box('LobbyOuterWall',x,5.5,45,.35,11,30,mats.stone);
 // 관객 출입을 위한 중앙 7m 출입구를 남깁니다. / Leave the central entrance open.
 for(const x of [-9.5,9.5])box('AuditoriumEntranceWall',x,5.5,30,12,11,.35,mats.stone);
 box('EntranceLintel',0,7.1,30,7,1.3,.4,mats.bronze);
 for(const x of [-3.7,3.7])box('EntranceFrame',x,3.35,30,.32,6.7,.5,mats.bronze);
 for(const x of [-11,-7,-3,3,7,11]){box('ExteriorGlazing',x,3,59.9,3.8,6,.16,mats.glass);box('ExteriorMullion',x-1.9,3,59.8,.12,6,.16,mats.bronze);}
 box('ExteriorTransom',0,6.1,59.8,31,.28,.3,mats.bronze);
 // 상부 관람 복도와 반복 무늬 난간 / Upper galleries and repeated decorative rails.
 for(const s of [-1,1]){
  box('GalleryFloor',s*11,3.85,45,9,.35,30,mats.stone);
  box('GalleryFascia',s*6.45,3.65,45,.25,1.2,30,mats.burgundy);
  box('GalleryGoldLine',s*6.28,4.25,45,.12,.09,30,mats.bronze);
  box('GalleryRailTop',s*6.4,5.05,45,.16,.12,30,mats.bronze);
  box('GalleryRailBase',s*6.4,4.22,45,.16,.1,30,mats.bronze);
  const lattice=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.8,.055),mats.bronze,76);lattice.name='GalleryLattice';const lm=new THREE.Matrix4();for(let i=0;i<76;i++){lm.makeTranslation(s*6.4,4.64,30+i*.4);lattice.setMatrixAt(i,lm);}group.add(lattice);
  for(let i=0;i<37;i++){const ornament=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,5,12),mats.bronze);ornament.position.set(s*6.32,4.62,30.4+i*.8);ornament.rotation.y=Math.PI/2;group.add(ornament);}
  for(let z=31.5;z<59;z+=2.8){box('WallPanel',s*15.15,7.1,z,.12,3.3,2.45,mats.dark);box('WallPanelTrim',s*15.05,8.8,z,.1,.06,2.5,mats.bronze);}
  for(const z of [34,40,46,52,58]){
   box('MarbleColumn',s*10,5.65,z,1.35,11.3,1.35,mats.stone);
   box('ColumnBase',s*10,.12,z,1.6,.24,1.6,mats.bronze);
   box('ColumnCapital',s*10,10.85,z,1.62,.3,1.62,mats.bronze);
  }
  // 1층 로비의 붉은 계단을 양옆에 두어 중앙 동선을 지킵니다. / Keep the centre circulation clear.
  for(let i=0;i<12;i++)box('RedStair',s*13.2,.12+i*.30,58.4-i*.36,3,.24,.42,mats.red);
  box('StairRail',s*11.55,2.1,56.4,.1,.1,5,mats.bronze);
 }
 // 한쪽 상층의 금속 격자 화면 / A perforated bronze screen along the upper gallery.
 const latticeBars=new THREE.InstancedMesh(new THREE.BoxGeometry(.045,4.3,.045),mats.bronze,73);const matrix=new THREE.Matrix4();for(let i=0;i<73;i++){matrix.makeTranslation(-6.42,7.3,30.5+i*.4);latticeBars.setMatrixAt(i,matrix);}group.add(latticeBars);
 for(let y=5.2;y<=9.5;y+=.42)box('ScreenCrossbar',-6.42,y,45,.04,.04,29,mats.bronze);
 for(let z=31.5;z<60;z+=2){for(const x of [-4.5,4.5])box('CeilingLight',x,11.12,z,1.6,.08,.2,mats.light);}
 const lights=[];for(const z of [32,38,44,50,56]){const light=new THREE.PointLight(0xffe2b5,65,17,2);light.position.set(0,9,z);group.add(light);lights.push(light);}
 const dispose=()=>{const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());marbleMap?.dispose();stoneMap?.dispose();};
 return {group,lights,dispose};
}
